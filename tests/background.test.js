import { test, expect } from 'bun:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../extension/background.js', import.meta.url), 'utf8');
function harness({ notificationsAvailable = true, browserAPI = false } = {}) {
  let now = 1_000_000;
  const data = {};
  const alarms = new Map();
  const notifications = [];
  const delivered = [];
  const tabs = [];
  const listeners = {};
  const event = key => ({ addListener(fn) { listeners[key] = fn; } });
  const chrome = {
    storage: { local: {
      get: async () => structuredClone(data),
      set: async value => Object.assign(data, structuredClone(value))
    } },
    tabs: {
      query: async ({ url }) => tabs.filter(tab => url.some(pattern => { const domain = pattern.split('*.')[1].split('/')[0]; const host = new URL(tab.url).hostname; return host === domain || host.endsWith('.' + domain); })),
      sendMessage: async (id, message) => { delivered.push({ id, ...message }); },
      remove: async ids => { for (let i = tabs.length - 1; i >= 0; i--) if (ids.includes(tabs[i].id)) tabs.splice(i, 1); },
      onCreated: event('created'), onUpdated: event('updated'), onRemoved: event('removed')
    },
    action: { setBadgeText: async () => {}, setBadgeBackgroundColor: async () => {} },
    alarms: { create: async (name, alarm) => alarms.set(name, alarm), clear: async name => alarms.delete(name), onAlarm: event('alarm') },
    notifications: { create: async (id, payload) => notifications.push({ id, ...payload }), clear: async () => {} },
    runtime: { onInstalled: event('installed'), onStartup: event('startup'), onMessage: event('message') }
  };
  if (!notificationsAvailable) delete chrome.notifications;
  function reload() {
    class Clock extends Date { static now() { return now; } }
    vm.runInNewContext(source, { [browserAPI ? 'browser' : 'chrome']: chrome, Date: Clock, console, URL });
  }
  reload();
  const message = (payload, sender = {}) => new Promise(resolve => listeners.message(payload, sender, resolve));
  return { data, alarms, notifications, delivered, tabs, chrome, reload, message, listeners, advance: ms => { now += ms; } };
}

const X = { id: 1, url: 'https://x.com/home' };
const IG = { id: 2, url: 'https://www.instagram.com/' };
const state = h => h.message({ type: 'get-state' });

test('separate automatic timers; Twitter and X share one app; refresh preserves deadline', async () => {
  const h = harness(); h.tabs.push(X); h.listeners.created();
  const first = await state(h);
  expect(first.sessions.x.deadline - first.sessions.x.startedAt).toBe(600000);
  expect(first.sessions.instagram).toBeNull();
  expect(first.activeApps).toEqual(['x']);
  h.advance(120000); h.tabs.push(IG, { id: 3, url: 'https://twitter.com/home' });
  h.listeners.updated(1, { status: 'complete' });
  const second = await state(h);
  expect(second.sessions.x.deadline).toBe(first.sessions.x.deadline);
  expect(second.sessions.instagram.deadline).toBe(first.sessions.x.deadline + 120000);
  expect(h.alarms.size).toBe(2);
  expect(second.activeApps).toEqual(['x', 'instagram']);
});

test('only expired app gets notification and prominent reminder; worker restarts preserve state', async () => {
  const h = harness(); h.tabs.push(X); await state(h);
  h.advance(120000); h.tabs.push(IG); await state(h);
  h.advance(480001); h.reload(); h.listeners.alarm({ name: 'recenter-x' });
  const expired = await state(h);
  expect(expired.sessions.x.notified).toBe(true);
  expect(expired.sessions.instagram.notified).toBe(false);
  expect(h.notifications).toHaveLength(1);
  expect(h.notifications[0].title).toBe('Time to close Twitter / X');
  expect(h.delivered.filter(m => m.id === X.id).at(-1).session.notified).toBe(true);
  expect(h.delivered.filter(m => m.id === IG.id).at(-1).session.notified).toBe(false);
  h.reload(); await state(h); expect(h.notifications).toHaveLength(1);
});

test('reopening within three hours immediately repeats reminder, even after restart', async () => {
  const h = harness(); h.tabs.push(X); await state(h); h.advance(600001);
  const expired = await state(h);
  const until = expired.sessions.x.blockedUntil;
  h.tabs.pop(); h.listeners.removed(); await state(h);
  h.advance(2 * 60 * 60 * 1000); h.reload(); h.tabs.push(X); h.listeners.created();
  const reopened = await h.message({ type: 'get-state' }, { tab: X });
  expect(reopened.session.notified).toBe(true);
  expect(reopened.session.blockedUntil).toBe(until);
  expect(h.delivered.at(-1).session.notified).toBe(true);
  expect(h.notifications).toHaveLength(1);
});

test('fresh timer starts at the three-hour boundary without extending cooldown on reopen', async () => {
  const h = harness(); h.tabs.push(X); const first = await state(h);
  h.advance(600000); const expired = await state(h);
  h.tabs.pop(); await state(h); h.advance(3 * 60 * 60 * 1000 - 1); h.tabs.push(X);
  expect((await state(h)).sessions.x.blockedUntil).toBe(expired.sessions.x.blockedUntil);
  h.advance(1); h.listeners.alarm({ name: 'recenter-x' });
  const fresh = await state(h);
  expect(fresh.sessions.x.notified).toBe(false);
  expect(fresh.sessions.x.startedAt).toBe(first.sessions.x.deadline + 3 * 60 * 60 * 1000);
  expect(fresh.sessions.x.deadline - fresh.sessions.x.startedAt).toBe(600000);
});

test('closing an app keeps its timer and alarm without affecting the other app', async () => {
  const h = harness(); h.tabs.push(X, IG); const original = await state(h);
  h.advance(1000); h.tabs.shift();
  const closed = await state(h);
  expect(closed.sessions.x.remainingMs).toBeNull();
  expect(closed.sessions.x.deadline).toBe(original.sessions.x.deadline);
  expect(h.alarms.get('recenter-x').when).toBe(original.sessions.x.deadline);
  expect(closed.activeApps).toEqual(['instagram']);
  expect(closed.sessions.instagram.deadline).toBe(original.sessions.instagram.deadline);
  h.advance(60000);
  h.tabs.push(X); expect((await state(h)).sessions.x.deadline).toBe(original.sessions.x.deadline);
});

test('close-app button closes all tabs for that app and preserves its three-hour reminder', async () => {
  const h = harness(); h.tabs.push(X, IG, { id: 3, url: 'https://twitter.com/' });
  await state(h); h.advance(600001); await state(h);
  const closed = await h.message({ type: 'leave' }, { tab: X });
  expect(h.tabs).toEqual([IG]);
  expect(closed.sessions.x.notified).toBe(true);
  h.tabs.push(X); expect((await state(h)).sessions.x.notified).toBe(true);
});

test('lowering duration shortens running timers and disabling does not erase cooldown', async () => {
  const h = harness(); h.tabs.push(X); const first = await state(h);
  expect((await h.message({ type: 'settings', minutes: 16, enabled: true })).error).toBeTruthy();
  const edited = await h.message({ type: 'settings', minutes: 5, enabled: true });
  expect(edited.sessions.x.deadline).toBe(first.sessions.x.startedAt + 300000);
  h.advance(600001); const expired = await state(h);
  await h.message({ type: 'settings', minutes: 5, enabled: false });
  expect(h.delivered.at(-1).session).toBeNull();
  const resumed = await h.message({ type: 'settings', minutes: 5, enabled: true });
  expect(resumed.sessions.x.blockedUntil).toBe(expired.sessions.x.blockedUntil);
  h.tabs.push(IG); expect((await state(h)).sessions.instagram.deadline - (await state(h)).sessions.instagram.startedAt).toBe(300000);
});

test('desktop notification failure cannot prevent the on-page reminder', async () => {
  const h = harness(); h.tabs.push(X); await state(h);
  h.chrome.notifications.create = async () => { throw new Error('blocked'); };
  h.advance(600001); await state(h);
  expect(h.delivered.at(-1).session.notified).toBe(true);
});

test('closing at the deadline and sleep past cooldown do not retain stale reminders', async () => {
  const h = harness(); h.tabs.push(X); await state(h);
  h.advance(600000); h.tabs.pop();
  expect((await state(h)).sessions.x.notified).toBe(true);
  h.advance(3 * 60 * 60 * 1000 + 1); h.tabs.push(X);
  expect((await state(h)).sessions.x.notified).toBe(false);
});

test('timer increases are rejected while either app is open, including while paused', async () => {
  const h = harness(); h.tabs.push(X); await state(h);
  const blocked = await h.message({ type: 'settings', minutes: 15, enabled: true });
  expect(blocked.error).toContain('only shorten');
  await h.message({ type: 'settings', minutes: 7, enabled: true });
  expect((await h.message({ type: 'settings', minutes: 10, enabled: true })).error).toBeTruthy();
  await h.message({ type: 'settings', minutes: 7, enabled: false });
  expect((await h.message({ type: 'settings', minutes: 10, enabled: false })).error).toBeTruthy();
  h.tabs.splice(0, 1, IG);
  expect((await h.message({ type: 'settings', minutes: 10, enabled: true })).error).toBeTruthy();
  h.tabs.pop();
  const allowed = await h.message({ type: 'settings', minutes: 15, enabled: true });
  expect(allowed.settings.minutes).toBe(15);
});

test('lowering below elapsed time expires immediately and keeps a full three-hour window', async () => {
  const h = harness(); h.tabs.push(X); const first = await state(h);
  h.advance(6 * 60000);
  const lowered = await h.message({ type: 'settings', minutes: 5, enabled: true });
  expect(lowered.sessions.x.notified).toBe(true);
  expect(lowered.sessions.x.deadline).toBe(first.sessions.x.startedAt + 6 * 60000);
  expect(lowered.sessions.x.blockedUntil - lowered.sessions.x.deadline).toBe(3 * 60 * 60000);
  expect(h.delivered.at(-1).session.notified).toBe(true);
  const cooldown = lowered.sessions.x.blockedUntil;
  await h.message({ type: 'settings', minutes: 5, enabled: true });
  expect((await state(h)).sessions.x.blockedUntil).toBe(cooldown);
});

test('lowering duration preserves separate start times and updates both app deadlines', async () => {
  const h = harness(); h.tabs.push(X); await state(h); h.advance(60000); h.tabs.push(IG);
  const original = await state(h);
  const shorter = await h.message({ type: 'settings', minutes: 7, enabled: true });
  expect(shorter.sessions.x.deadline).toBe(original.sessions.x.startedAt + 7 * 60000);
  expect(shorter.sessions.instagram.deadline).toBe(original.sessions.instagram.startedAt + 7 * 60000);
  expect(h.alarms.get('recenter-x').when).toBe(shorter.sessions.x.deadline);
});

test('running timer survives restart with no tabs and expires while closed', async () => {
  const h = harness(); h.tabs.push(X); const first = await state(h);
  h.advance(4 * 60000); h.tabs.pop(); await state(h); h.reload();
  expect((await state(h)).sessions.x.deadline).toBe(first.sessions.x.deadline);
  h.advance(7 * 60000); const expired = await state(h);
  expect(expired.sessions.x.blockedUntil).toBe(first.sessions.x.deadline + 3 * 60 * 60000);
  expect(h.notifications).toHaveLength(0);
  h.tabs.push(X);
  const reopened = await h.message({ type: 'get-state' }, { tab: X });
  expect(reopened.session.notified).toBe(true);
  expect(reopened.session.blockedUntil).toBe(expired.sessions.x.blockedUntil);
});

test('long closure clears elapsed cooldown without creating a session until tabs open', async () => {
  const h = harness(); h.tabs.push(X); await state(h);
  h.tabs.pop(); await state(h); h.advance(24 * 60 * 60000); h.reload();
  expect((await state(h)).sessions.x).toBeNull();
  expect(h.alarms.has('recenter-x')).toBe(false);
  expect(h.notifications).toHaveLength(0);
  h.tabs.push(X); const fresh = await state(h);
  expect(fresh.sessions.x.deadline - fresh.sessions.x.startedAt).toBe(600000);
  expect(fresh.sessions.x.notified).toBe(false);
});

test('reopening after a long closure starts fresh even if no closed-tab alarm ran', async () => {
  const h = harness(); h.tabs.push(X); const first = await state(h);
  h.tabs.pop(); await state(h); h.advance(24 * 60 * 60000); h.reload(); h.tabs.push(X);
  const reopened = await state(h);
  expect(reopened.sessions.x.startedAt).toBe(first.sessions.x.startedAt + 24 * 60 * 60000);
  expect(reopened.sessions.x.deadline - reopened.sessions.x.startedAt).toBe(600000);
  expect(h.notifications).toHaveLength(0);
});

test('shortening an explicitly paused session subtracts time and increasing never extends it', async () => {
  const h = harness(); h.tabs.push(X); await state(h); h.advance(4 * 60000);
  await h.message({ type: 'settings', minutes: 10, enabled: false }); h.tabs.pop();
  const shorter = await h.message({ type: 'settings', minutes: 7, enabled: false });
  expect(shorter.sessions.x.remainingMs).toBe(3 * 60000);
  const increased = await h.message({ type: 'settings', minutes: 15, enabled: false });
  expect(increased.sessions.x.remainingMs).toBe(3 * 60000);
  h.advance(60000);
  const resumed = await h.message({ type: 'settings', minutes: 15, enabled: true });
  expect(resumed.sessions.x.deadline).toBe(1_000_000 + 8 * 60000);
  expect(resumed.sessions.x.remainingMs).toBeNull();
  expect(resumed.sessions.instagram).toBeNull();
  expect(h.alarms.get('recenter-x').when).toBe(resumed.sessions.x.deadline);
  h.advance(60000); expect((await state(h)).sessions.x.deadline).toBe(resumed.sessions.x.deadline);
  h.advance(2 * 60000); expect((await state(h)).sessions.x.notified).toBe(true);
});

test('legacy saved remaining time converts once while enabled even with no tabs', async () => {
  const h = harness();
  h.data.sessions = { x: { startedAt: 100, budgetMs: 600000, deadline: null, remainingMs: 120000, notified: false } };
  const migrated = await state(h);
  expect(migrated.sessions.x.deadline).toBe(1_120_000);
  expect(h.data.sessions.x.remainingMs).toBeNull();
  h.advance(60000); h.reload();
  expect((await state(h)).sessions.x.deadline).toBe(1_120_000);
  expect(h.data.sessions.x.budgetMs).toBe(600000);
});

test('disabled legacy saved remaining time stays paused until enabled', async () => {
  const h = harness();
  h.data.settings = { minutes: 10, enabled: false };
  h.data.sessions = { x: { startedAt: 100, budgetMs: 600000, deadline: null, remainingMs: 120000, notified: false } };
  await state(h); h.advance(60000); h.reload();
  expect((await state(h)).sessions.x.remainingMs).toBe(120000);
  expect(h.data.sessions.x.deadline).toBeNull();
  expect(h.alarms.has('recenter-x')).toBe(false);
  const resumed = await h.message({ type: 'settings', minutes: 10, enabled: true });
  expect(resumed.sessions.x.deadline).toBe(1_180_000);
});

test('lowering duration leaves an existing cooldown unchanged', async () => {
  const h = harness(); h.tabs.push(X); await state(h); h.advance(600000);
  const expired = await state(h);
  const lowered = await h.message({ type: 'settings', minutes: 5, enabled: true });
  expect(lowered.sessions.x.deadline).toBe(expired.sessions.x.deadline);
  expect(lowered.sessions.x.blockedUntil).toBe(expired.sessions.x.blockedUntil);
});

test('missing notifications API preserves timers and on-page reminders using browser API', async () => {
  const h = harness({ notificationsAvailable: false, browserAPI: true });
  h.tabs.push(X); await state(h); h.advance(600000);
  const expired = await state(h);
  expect(expired.sessions.x.notified).toBe(true);
  expect(h.delivered.at(-1).session.notified).toBe(true);
  h.tabs.pop(); await state(h);
  expect(h.alarms.get('recenter-x').when).toBe(expired.sessions.x.blockedUntil);
});

test('closing only one tab keeps the app timer running; disabling saves unfinished time', async () => {
  const h = harness(); h.tabs.push(X, { id: 3, url: 'https://twitter.com/' });
  const first = await state(h); h.advance(2 * 60000); h.tabs.pop();
  expect((await state(h)).sessions.x.deadline).toBe(first.sessions.x.deadline);
  const paused = await h.message({ type: 'settings', minutes: 10, enabled: false });
  expect(paused.sessions.x.remainingMs).toBe(8 * 60000);
  h.advance(60 * 60000);
  const resumed = await h.message({ type: 'settings', minutes: 10, enabled: true });
  expect(resumed.sessions.x.deadline - resumed.sessions.x.startedAt).toBe(70 * 60000);
});

test('closing and reopening an app preserves its original wall-clock deadline', async () => {
  const h = harness(); h.tabs.push(X); const first = await state(h);
  h.advance(2 * 60000); h.tabs.pop(); await state(h);
  h.advance(3 * 60000); h.reload(); h.tabs.push(X);
  const reopened = await state(h);
  expect(reopened.sessions.x.deadline).toBe(first.sessions.x.deadline);
  expect(reopened.sessions.x.deadline - (first.sessions.x.startedAt + 5 * 60000)).toBe(5 * 60000);
});
