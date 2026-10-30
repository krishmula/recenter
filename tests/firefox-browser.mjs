import assert from 'node:assert/strict';
import { firefox } from '../release/tooling/node_modules/playwright/index.mjs';
import { connectWithMaxRetries, findFreeTcpPort } from '../release/tooling/node_modules/web-ext/lib/firefox/remote.js';
import { mkdtemp, rm, cp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const workspace = await mkdtemp(path.join(tmpdir(), 'recenter-firefox-'));
const profile = path.join(workspace, 'profile');
const extension = path.join(workspace, 'extension');
await cp(fileURLToPath(new URL('../release/unpacked/firefox', import.meta.url)), extension, { recursive: true });
const manifestPath = path.join(extension, 'manifest.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
manifest.host_permissions.push('https://example.com/*');
manifest.content_scripts.push({ matches: ['https://example.com/*'], js: ['test-probe.js'] });
await writeFile(manifestPath, JSON.stringify(manifest));
await writeFile(path.join(extension, 'test-probe.js'), `
  document.addEventListener('recenter-test-request', async () => {
    try {
      const request = JSON.parse(document.documentElement.dataset.recenterRequest);
      let deadline;
      if (request.type === 'expire') {
        const { sessions } = await browser.storage.local.get('sessions');
        deadline = sessions[request.app].deadline = Date.now() + 500;
        await browser.storage.local.set({ sessions });
      }
      const state = await browser.runtime.sendMessage({ type: 'get-state' });
      document.documentElement.dataset.recenterResult = JSON.stringify({ ...state, deadline });
    } catch (error) {
      document.documentElement.dataset.recenterResult = JSON.stringify({ error: error.message });
    }
  });
  document.documentElement.dataset.recenterProbeReady = 'true';
`);
const port = await findFreeTcpPort();
const context = await firefox.launchPersistentContext(profile, {
  ...(process.env.FIREFOX_PATH ? { executablePath: process.env.FIREFOX_PATH } : {}),
  headless: true,
  viewport: null,
  firefoxUserPrefs: { 'devtools.debugger.remote-enabled': true, 'devtools.debugger.prompt-connection': false },
  args: ['--start-debugger-server', String(port)],
});
let remote;
try {
  remote = await connectWithMaxRetries({ port, maxRetries: 30 });
  await remote.installTemporaryAddon(extension);
  await context.route(/^https:\/\/(x\.com|www\.instagram\.com|example\.com)\//, route => route.fulfill({
    contentType: 'text/html', body: '<html><body><h1>Recenter Firefox integration check</h1></body></html>',
  }));
  const control = await context.newPage();
  await control.goto('https://example.com');
  await control.waitForFunction(() => document.documentElement.dataset.recenterProbeReady);
  const command = async request => {
    await control.evaluate(value => {
      delete document.documentElement.dataset.recenterResult;
      document.documentElement.dataset.recenterRequest = JSON.stringify(value);
      document.dispatchEvent(new Event('recenter-test-request'));
    }, request);
    await control.waitForFunction(() => document.documentElement.dataset.recenterResult);
    const result = await control.evaluate(() => JSON.parse(document.documentElement.dataset.recenterResult));
    assert.equal(result.error, undefined);
    return result;
  };
  const sync = () => command({ type: 'read' });
  const read = async () => (await sync()).sessions;
  const open = async url => {
    const page = await context.newPage();
    await page.goto(url);
    await page.waitForSelector('[data-recenter="countdown"], [data-recenter="reminder"]');
    return page;
  };
  for (const [app, url] of [['x', 'https://x.com/home'], ['instagram', 'https://www.instagram.com/']]) {
    let page = await open(url);
    const original = (await read())[app];
    await page.close();
    await new Promise(resolve => setTimeout(resolve, 1200));
    await sync();
    assert.equal((await read())[app].deadline, original.deadline);
    page = await open(url);
    assert.equal((await read())[app].deadline, original.deadline);
    await page.close();
    await sync();
    const { deadline } = await command({ type: 'expire', app });
    await sync();
    await new Promise(resolve => setTimeout(resolve, 700));
    await sync();
    page = await open(url);
    await page.waitForSelector('[data-recenter="reminder"]');
    const expired = (await read())[app];
    assert.equal(expired.blockedUntil, deadline + 3 * 60 * 60 * 1000);
    await page.close();
    page = await open(url);
    await page.waitForSelector('[data-recenter="reminder"]');
    assert.equal((await read())[app].blockedUntil, expired.blockedUntil);
    await page.close();
    console.log(`PASS: Firefox ${app} preserves its deadline across reopening; expiry and three-hour reminders work.`);
  }
} finally {
  remote?.disconnect();
  await context.close();
  await rm(workspace, { recursive: true, force: true });
}
