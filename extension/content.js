(() => {
  const hostname = location.hostname;
  const app = hostname === 'instagram.com' || hostname.endsWith('.instagram.com') ? 'instagram' : 'x';
  const appName = app === 'instagram' ? 'Instagram' : 'Twitter / X';
  let host;
  let countdown;
  function render(session) {
    clearInterval(countdown);
    host?.remove(); host = null;
    if (!session || (session.notified && session.blockedUntil <= Date.now())) return;
    if (!session.notified) {
      host = document.createElement('div');
      host.dataset.recenter = 'countdown';
      host.style.cssText = 'position:fixed!important;bottom:20px!important;right:20px!important;z-index:2147483646!important;display:block!important;pointer-events:none!important';
      const root = host.attachShadow({ mode: 'closed' });
      root.innerHTML = `<style>:host{all:initial}*{box-sizing:border-box}.timer{display:flex;align-items:center;gap:16px;background:#f8f7f1;color:#233c32;border:1px solid #c9d7cb;border-radius:14px;padding:14px 18px;box-shadow:0 6px 30px #0002;font:13px system-ui}.label{font-weight:600}.label:before{content:'';display:inline-block;width:7px;height:7px;border-radius:50%;background:#346653;margin-right:8px}.caption{font-size:11px;color:#65756c;margin-top:4px}.time{font:600 25px system-ui;font-variant-numeric:tabular-nums;letter-spacing:1px}.soon{border-color:#b88637}.soon .time{color:#94651f}</style><div class="timer"><div><div class="label">${app === 'x' ? 'X' : 'Instagram'} is on</div><div class="caption">Time until your break</div></div><span class="time" role="timer" aria-label="Time remaining"></span></div>`;
      document.documentElement.appendChild(host);
      let syncing = false;
      function tick() {
        const seconds = Math.max(0, Math.ceil((session.deadline - Date.now()) / 1000));
        root.querySelector('.time').textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
        root.querySelector('.timer').classList.toggle('soon', seconds <= 60);
        if (!seconds && !syncing) {
          syncing = true;
          // Show the reminder promptly even if the background alarm is delayed.
          render({ ...session, notified: true, blockedUntil: session.deadline + 3 * 60 * 60 * 1000 });
          chrome.runtime.sendMessage({ type: 'get-state' }).then(state => render(state.session)).catch(() => {});
        }
      }
      countdown = setInterval(tick, 1000);
      tick();
      return;
    }
    host = document.createElement('div');
    host.dataset.recenter = 'reminder';
    host.style.cssText = 'position:fixed!important;inset:0!important;z-index:2147483647!important;display:block!important';
    const root = host.attachShadow({ mode: 'closed' });
    root.innerHTML = `<style>
      :host{all:initial}*{box-sizing:border-box}.veil{position:fixed;inset:0;background:#142e26e6;backdrop-filter:blur(12px);display:grid;place-items:center;padding:24px;font:16px system-ui;color:#233c32;overflow:auto}
      .card{width:min(560px,100%);padding:44px;background:#f8f7f1;border-radius:24px;box-shadow:0 24px 80px #0003;text-align:center}
      .mark{font-size:44px;color:#346653;margin-bottom:20px}h1{font:42px/1.1 Georgia,serif;margin:0 0 20px}p{line-height:1.6;color:#65756c;margin:0 0 24px}
      button{font:600 18px system-ui;cursor:pointer;width:100%;padding:18px;border-radius:12px;border:0;background:#346653;color:white}button:focus-visible{outline:3px solid #b88637;outline-offset:3px}.eyebrow{font-size:11px;letter-spacing:2px;margin-bottom:18px}.cooldown{margin:20px 0 0;font-size:13px}
      @media(max-width:480px){.card{padding:28px}h1{font-size:34px}}
    </style><div class="veil"><section class="card" role="dialog" aria-modal="true" aria-labelledby="recenter-title" tabindex="-1"><div class="eyebrow">RECENTER · TIME IS UP</div><div class="mark" aria-hidden="true">✳</div><h1 id="recenter-title">It’s time to close ${appName}.</h1><p>You’ve reached your scrolling limit.<br>Take a breath, relax your shoulders,<br>and come back to what matters to you.</p><button id="leave">Close ${appName} tabs</button><p class="cooldown">Reopening this app brings this reminder back.<br><span id="remaining"></span></p><p id="error" role="alert" style="margin:12px 0 0;font-size:13px"></p></section></div>`;
    document.documentElement.appendChild(host);
    const leave = root.getElementById('leave');
    function tick() {
      const remaining = session.blockedUntil - Date.now();
      if (remaining <= 0) {
        render(null);
        chrome.runtime.sendMessage({ type: 'get-state' }).then(state => render(state.session)).catch(() => {});
        return;
      }
      const minutes = Math.ceil(remaining / 60000);
      root.getElementById('remaining').textContent = `Fresh timer available in ${Math.floor(minutes / 60)}h ${minutes % 60}m.`;
    }
    tick(); countdown = setInterval(tick, 1000);
    leave.onclick = async () => {
      try {
        const result = await chrome.runtime.sendMessage({ type: 'leave' });
        if (result?.error) throw new Error(result.error);
      } catch { root.getElementById('error').textContent = 'Close this tab manually, or reload to reconnect to Recenter.'; }
    };
    root.addEventListener('keydown', event => {
      if (event.key === 'Tab') { event.preventDefault(); leave.focus(); }
    });
    leave.focus();
  }
  chrome.runtime.onMessage.addListener(message => { if (message.type === 'state' && message.app === app) render(message.session); });
  // Ask the worker for effective state, including whether reminders are paused.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.settings) chrome.runtime.sendMessage({ type: 'get-state' }).then(state => render(state.session)).catch(() => {});
  });
  chrome.runtime.sendMessage({ type: 'get-state' }).then(state => render(state.session)).catch(() => {});
})();
