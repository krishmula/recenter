const APPS = {
  x: { name: 'Twitter / X', matches: ['https://*.x.com/*', 'https://*.twitter.com/*'] },
  instagram: { name: 'Instagram', matches: ['https://*.instagram.com/*'] }
};
const DEFAULTS = { minutes: 10, enabled: true };
const COOLDOWN = 3 * 60 * 60 * 1000;
let queue = Promise.resolve();
function enqueue(task) {
  const result = queue.then(task);
  queue = result.catch(error => console.error('Recenter:', error));
  return result;
}
function appFor(url) {
  try {
    const host = new URL(url).hostname;
    const matches = domain => host === domain || host.endsWith('.' + domain);
    return matches('x.com') || matches('twitter.com') ? 'x' : matches('instagram.com') ? 'instagram' : null;
  } catch { return null; }
}
async function read() {
  const data = await chrome.storage.local.get(['settings', 'sessions']);
  return { settings: { ...DEFAULTS, ...data.settings }, sessions: data.sessions || {} };
}
async function reconcile() {
  const { settings, sessions } = await read();
  const allTabs = [];
  for (const [app, config] of Object.entries(APPS)) {
    const tabs = await chrome.tabs.query({ url: config.matches });
    allTabs.push(...tabs.map(tab => ({ ...tab, app })));
    let session = sessions[app] || null;
    // Migrate existing running sessions without resetting their allowance.
    if (session && !session.notified && session.budgetMs == null) session.budgetMs = session.deadline - session.startedAt;
    const alarm = 'recenter-' + app;
    // An expired session stays stored even after its tabs close or reminders pause.
    if (session && !session.notified && (session.remainingMs === 0 || (session.remainingMs == null && session.deadline <= Date.now()))) {
      const deadline = session.remainingMs === 0 ? Date.now() : session.deadline;
      session = { ...session, deadline, remainingMs: null, notified: true, blockedUntil: deadline + COOLDOWN };
      sessions[app] = session;
      await chrome.storage.local.set({ sessions });
      if (settings.enabled && tabs.length && session.blockedUntil > Date.now()) {
        await chrome.notifications.create(alarm, {
          type: 'basic', iconUrl: 'icon.png', title: `Time to close ${config.name}`,
          message: 'Your scrolling time is up. Take a breath and close this app. Reopening within 3 hours brings this reminder back.',
          priority: 2, requireInteraction: true
        }).catch(error => console.warn('Desktop notification unavailable:', error));
      }
    }
    if (session?.notified && session.blockedUntil <= Date.now()) session = null;
    if (!settings.enabled || !tabs.length) {
      if (session && !session.notified && session.remainingMs == null) {
        session = { ...session, remainingMs: Math.max(0, session.deadline - Date.now()), deadline: null };
      }
      await chrome.notifications.clear(alarm);
    } else if (!session) {
      const startedAt = Date.now();
      session = { startedAt, budgetMs: settings.minutes * 60000, deadline: startedAt + settings.minutes * 60000, remainingMs: null, notified: false };
    } else if (!session.notified && session.remainingMs != null) {
      session = { ...session, deadline: Date.now() + session.remainingMs, remainingMs: null };
    }
    sessions[app] = session;
    if (session && (session.notified || session.remainingMs == null)) await chrome.alarms.create(alarm, { when: session.notified ? session.blockedUntil : session.deadline });
    else await chrome.alarms.clear(alarm);
  }
  const activeApps = [...new Set(allTabs.map(tab => tab.app))];
  await chrome.storage.local.set({ sessions, activeApps, session: null });
  const visible = settings.enabled ? Object.values(sessions).filter(session => session && (session.notified || session.remainingMs == null)) : [];
  await chrome.action.setBadgeBackgroundColor({ color: '#346653' });
  await chrome.action.setBadgeText({ text: visible.some(session => session.notified) ? '!' : visible.length ? 'ON' : '' });
  await Promise.all(allTabs.map(tab => chrome.tabs.sendMessage(tab.id, {
    type: 'state', app: tab.app, session: settings.enabled ? sessions[tab.app] : null
  }).catch(() => {})));
  return { settings, sessions, activeApps };
}
chrome.tabs.onCreated.addListener(() => enqueue(reconcile));
chrome.tabs.onUpdated.addListener((_id, change) => { if (change.url || change.status === 'complete') enqueue(reconcile); });
chrome.tabs.onRemoved.addListener(() => enqueue(reconcile));
chrome.alarms.onAlarm.addListener(alarm => { if (Object.keys(APPS).some(app => alarm.name === 'recenter-' + app)) enqueue(reconcile); });
chrome.runtime.onInstalled.addListener(() => enqueue(reconcile));
chrome.runtime.onStartup.addListener(() => enqueue(reconcile));
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (!['get-state', 'settings', 'leave'].includes(message.type)) return false;
  enqueue(async () => {
    if (message.type === 'settings') {
      const minutes = Number(message.minutes);
      if (!Number.isInteger(minutes) || minutes < 5 || minutes > 15 || typeof message.enabled !== 'boolean') throw new Error('Invalid settings');
      const current = await reconcile();
      if (current.activeApps.length && minutes > current.settings.minutes) {
        throw new Error('Close X and Instagram before increasing the timer. While either is open, you can only shorten it.');
      }
      if (minutes < current.settings.minutes) {
        for (const session of Object.values(current.sessions)) {
          if (session && !session.notified) {
            const budgetMs = Math.min(session.budgetMs, minutes * 60000);
            const reduction = session.budgetMs - budgetMs;
            if (session.remainingMs != null) session.remainingMs = Math.max(0, session.remainingMs - reduction);
            else session.deadline = Math.max(Date.now(), session.deadline - reduction);
            session.budgetMs = budgetMs;
          }
        }
        await chrome.storage.local.set({ sessions: current.sessions });
      }
      await chrome.storage.local.set({ settings: { minutes, enabled: message.enabled } });
    }
    if (message.type === 'leave' && sender.tab) {
      const app = appFor(sender.tab.url);
      if (app) {
        const tabs = await chrome.tabs.query({ url: APPS[app].matches });
        if (tabs.length) await chrome.tabs.remove(tabs.map(tab => tab.id));
      }
    }
    const state = await reconcile();
    const app = appFor(sender.tab?.url);
    return { ...state, app, session: app && state.settings.enabled ? state.sessions[app] : null };
  }).then(respond, error => respond({ error: error.message }));
  return true;
});
