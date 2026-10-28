# Recenter

An automatic browser extension for X, Twitter, and Instagram. Each app has its own 10-minute timer, adjustable from 5 to 15 minutes. No start button, account, server, or analytics.

## Install once

For Chrome, Brave, Edge, or another Chromium browser:

1. Open `chrome://extensions` (in Edge, `edge://extensions`).
2. Enable **Developer mode**.
3. Click **Load unpacked** and select the `extension` folder beside this README.
4. Open X or Instagram. Existing social tabs may need one refresh after installation.

If upgrading an installed copy, click **Reload** on Recenter’s extension card, then refresh your social tabs. The old shared timer is replaced by new separate timers; upgrading from version 1.0 starts each app’s first separate session fresh.

You can pin Recenter for quick access to settings, but it works without being pinned. This package is for Chromium browsers; Safari and Firefox need a separate package. If using the ZIP, extract it and load the `recenter` folder.

## Timers and reminders

- **Separate timers:** Twitter and X are the same app. Instagram has its own independent timer. Multiple tabs for one app share that app’s timer.
- **Automatic start:** Opening an app starts its timer. Background tabs count; these are elapsed-time timers, not active-use counters.
- **Visible countdown:** A small bottom-right indicator on each app’s page says “X is on” or “Instagram is on” and counts down in minutes and seconds. It updates every second and turns amber in the final minute. The extension popup also shows each open app and its countdown.
- **Refresh protection:** Refreshing, switching tabs, or navigating within an app does not reset its timer.
- **Prominent reminder:** At the deadline, a full-page overlay says **“It’s time to close Twitter / X”** or **“It’s time to close Instagram.”** A desktop notification also appears when permitted. There is no snooze button.
- **Close the app:** The overlay’s button closes all tabs for that app, leaving the other app and unrelated tabs alone.
- **Three-hour window:** From that app’s original deadline, its reminder remains active for three hours. Closing and reopening it during that window immediately shows the overlay again. Refreshes and browser restarts do not clear it; reopening does not extend it. The overlay shows the time until a fresh timer is available.
- **Fresh session:** At the end of the three-hour window, that app can start a new timer. If still open, its new timer starts automatically. Before its timer expires, closing all tabs for that app pauses and saves the remaining time. Reopening resumes that same unfinished session, even after a long break. Closing only one of several tabs leaves the timer running. Saved unfinished sessions do not reset automatically.
- **Settings:** Lowering the 5–15 minute duration immediately shortens both apps’ running timers, based on the time already used in each app, excluding breaks while all its tabs are closed. If you have already used the shorter allowance, the close reminder appears immediately and its three-hour window starts then. While any X or Instagram tab is open, you can only reduce the duration; close all tabs for both apps before increasing it for future sessions. Increasing the setting never extends an existing saved session. Expired reminders are preserved. The popup displays their statuses separately. Pausing removes overlays and saves unfinished timers as well as existing three-hour windows. Turning reminders back on resumes saved timers and restores those windows.
- **Sleep:** Deadlines are stored locally. Sleeping through a deadline shows the reminder on wake if still within the three-hour window. Time continues while a social tab stays open, including during sleep. Saved paused sessions survive browser restarts; if the browser exits without reporting its tabs closing, its last running deadline is used. The extension cannot wake your laptop. Browser alarm delivery can be delayed by sleep or scheduling.

Permissions are limited to storage, alarms, notifications, and the three supported domains. No page content or browsing history is collected or transmitted.

## Verify

Run `bun test tests` for service-worker checks. For browser UI checks, serve this folder locally and open `tests/browser.html`; this test page simulates extension APIs and is not packaged in the extension.

For installed end-to-end verification, choose 5 minutes, open X, wait a minute, then open Instagram. Confirm each app expires independently. Use the close button on X and reopen X to confirm the immediate reminder. Refresh and restart the browser to confirm persistence.

Chrome API references: [alarms](https://developer.chrome.com/docs/extensions/reference/api/alarms), [notifications](https://developer.chrome.com/docs/extensions/how-to/ui/notifications).
