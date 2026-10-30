const api = globalThis.browser ?? globalThis.chrome;
const enabled = document.getElementById('enabled');
const minutes = document.getElementById('minutes');
let sessions = {};
let activeApps = [];
let savedMinutes = 10;
let ready = false;
function updateLimit() {
  const maximum = activeApps.length ? savedMinutes : 15;
  minutes.max = maximum;
  minutes.disabled = !ready || maximum === 5;
  document.getElementById('maximum').textContent = `${maximum} min`;
  document.getElementById('timer-note').textContent = activeApps.length
    ? 'Changes shorten running timers now. Close X and Instagram before increasing the time.'
    : 'Choose 5–15 minutes for your next sessions.';
}
function describe(app, session) {
  const name = app === 'x' ? 'X' : 'Instagram';
  const prefix = activeApps.includes(app) ? `${name} is on · ` : '';
  if (!enabled.checked) return prefix + 'Reminders paused';
  if (!session) return 'Ready when you open it';
  if (session.notified) {
    const left = Math.max(0, Math.ceil((session.blockedUntil - Date.now()) / 60000));
    return prefix + (left ? `Time to close · ${Math.floor(left / 60)}h ${left % 60}m until reset` : 'Ready for a fresh timer');
  }
  const paused = session.remainingMs != null;
  const seconds = Math.max(0, Math.ceil((paused ? session.remainingMs : session.deadline - Date.now()) / 1000));
  return `${prefix}${paused ? 'Paused · ' : ''}${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')} remaining`;
}
function paint() {
  document.getElementById('duration').textContent = `${minutes.value} min`;
  document.getElementById('status').textContent = enabled.checked ? 'Separate automatic timers' : 'Reminders are paused';
  document.getElementById('detail').textContent = enabled.checked ? 'Each app keeps its reminder for 3 hours after time is up.' : 'Turn on to resume. The 3-hour reminders are preserved.';
  document.getElementById('x-state').textContent = describe('x', sessions.x);
  document.getElementById('instagram-state').textContent = describe('instagram', sessions.instagram);
}
async function save() {
  try {
    const result = await api.runtime.sendMessage({ type: 'settings', enabled: enabled.checked, minutes: Number(minutes.value) });
    if (result.error) throw new Error(result.error);
    sessions = result.sessions;
    activeApps = result.activeApps;
    savedMinutes = result.settings.minutes;
    minutes.value = savedMinutes;
    updateLimit();
    document.getElementById('error').textContent = '';
  } catch (error) {
    minutes.value = savedMinutes;
    document.getElementById('error').textContent = error.message || 'Could not save. Close and reopen this panel to retry.';
  }
  paint();
}
enabled.addEventListener('change', save);
minutes.addEventListener('input', paint);
minutes.addEventListener('change', save);
api.runtime.sendMessage({ type: 'get-state' }).then(result => {
  enabled.checked = result.settings.enabled; minutes.value = result.settings.minutes; savedMinutes = result.settings.minutes; sessions = result.sessions; activeApps = result.activeApps; ready = true; updateLimit(); paint();
}).catch(() => { document.getElementById('error').textContent = 'Could not connect to Recenter. Reload the extension.'; });
api.storage.onChanged.addListener(changes => {
  if (changes.sessions) sessions = changes.sessions.newValue || {};
  if (changes.activeApps) activeApps = changes.activeApps.newValue || [];
  if (changes.settings) {
    savedMinutes = changes.settings.newValue.minutes;
    minutes.value = savedMinutes;
    enabled.checked = changes.settings.newValue.enabled;
  }
  if (changes.activeApps || changes.settings) updateLimit();
  paint();
});
setInterval(paint, 1000);
