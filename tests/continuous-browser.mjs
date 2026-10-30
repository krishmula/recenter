import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '../release/tooling/node_modules/playwright/index.mjs');
const extension = fileURLToPath(new URL('../extension', import.meta.url));
const profile = await mkdtemp(path.join(tmpdir(), 'recenter-continuous-'));
const context = await chromium.launchPersistentContext(profile, {
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : { channel: 'chromium' }),
  headless: true,
  args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
});
try {
  await context.route(/^https:\/\/(x\.com|www\.instagram\.com|example\.com)\//, route => route.fulfill({
    contentType: 'text/html', body: '<html><body><h1>Recenter extension integration check</h1></body></html>',
  }));
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  const control = await context.newPage();
  await control.goto(`chrome-extension://${new URL(worker.url()).host}/popup.html`);
  const sync = () => control.evaluate(() => chrome.runtime.sendMessage({ type: 'get-state' }));
  const read = () => worker.evaluate(async () => (await chrome.storage.local.get('sessions')).sessions);
  const open = async url => {
    const page = await context.newPage();
    await page.goto(url);
    await page.waitForSelector('[data-recenter="countdown"], [data-recenter="reminder"]');
    return page;
  };
  for (const [app, url] of [['x', 'https://x.com/home'], ['instagram', 'https://www.instagram.com/']]) {
    let page = await open(url);
    const original = (await read())[app];
    const duplicate = await open(url);
    await duplicate.close();
    assert.equal((await read())[app].deadline, original.deadline);
    await page.close();
    await new Promise(resolve => setTimeout(resolve, 1200));
    const closed = (await read())[app];
    assert.equal(closed.deadline, original.deadline, `${app}: closing must preserve the deadline`);
    const alarm = await worker.evaluate(name => chrome.alarms.get(`recenter-${name}`), app);
    assert.equal(alarm.scheduledTime, original.deadline);
    page = await open(url);
    assert.equal((await read())[app].deadline, original.deadline, `${app}: reopening must preserve the deadline`);
    await page.goto('https://example.com');
    await new Promise(resolve => setTimeout(resolve, 100));
    assert.equal((await read())[app].deadline, original.deadline, `${app}: navigation must preserve the deadline`);
    await page.close();
    await sync();
    const deadline = await worker.evaluate(async name => {
      const { sessions } = await chrome.storage.local.get('sessions');
      sessions[name].deadline = Date.now() + 500;
      await chrome.storage.local.set({ sessions });
      return sessions[name].deadline;
    }, app);
    await sync();
    assert.equal((await read())[app].deadline, deadline);
    await new Promise(resolve => setTimeout(resolve, 700));
    await sync();
    page = await open(url);
    await page.waitForSelector('[data-recenter="reminder"]');
    const expired = (await read())[app];
    assert.equal(expired.notified, true);
    assert.equal(expired.blockedUntil, deadline + 3 * 60 * 60 * 1000);
    await page.close();
    page = await open(url);
    await page.waitForSelector('[data-recenter="reminder"]');
    assert.equal((await read())[app].blockedUntil, expired.blockedUntil);
    await page.close();
    console.log(`PASS: ${app} keeps its deadline across close/reopen and navigation; expiry and three-hour reminder survive reopening.`);
  }
} finally {
  await context.close();
  await rm(profile, { recursive: true, force: true });
}
