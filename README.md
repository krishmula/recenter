# Recenter

An automatic browser extension for X, Twitter, and Instagram. Each app has its own 10-minute timer, adjustable from 5 to 15 minutes. No start button, account, server, or analytics.

## Install once

For Chrome, Brave, Edge, or another Chromium browser:

1. Download [Recenter 1.4.0](https://github.com/krishmula/recenter/releases/download/v1.4.0/recenter-1.4.0.zip) and extract the ZIP.
2. Open `chrome://extensions` (in Edge, `edge://extensions`).
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the extracted `recenter` folder. If you cloned this repository instead, select its `extension` folder.
5. Open X or Instagram. Existing social tabs may need one refresh after installation.

If upgrading an installed copy, click **Reload** on Recenter’s extension card, then refresh your social tabs. Version 1.5.0 keeps timers running across tab closures. Version 1.4.0 saved remaining time when an app closed and discarded its original deadline. On upgrade, Recenter converts that saved balance once into a deadline from the current time, without granting a full allowance. If reminders are paused, conversion waits until you enable them. Upgrading from version 1.0 starts each app’s first separate session fresh.

You can pin Recenter for quick access to settings, but it works without being pinned. This package is for Chromium browsers; Safari and Firefox need a separate package. If using the ZIP, extract it and load the `recenter` folder.

Recenter is distributed through GitHub. It is not yet listed in the Chrome Web Store, so installation requires Developer mode.

## Firefox developer install

The source includes an unsigned Firefox package for desktop Firefox 140 or later. It is not published on Mozilla Add-ons. The published 1.4.0 download above is for Chromium browsers.

1. Clone this repository and run `python3 release/build.py`.
2. Open `about:debugging#/runtime/this-firefox` in Firefox.
3. Click **Load Temporary Add-on** and select `release/unpacked/firefox/manifest.json`.
4. Grant access to the supported sites if Firefox asks, then refresh X or Instagram.

Firefox removes temporary add-ons when it exits. The build also creates `release/recenter-1.5.0-firefox-unsigned.zip` for review and signing. Normal permanent installation requires Mozilla signing. The temporary Firefox add-on passed installed-browser checks for both app countdowns, close-and-reopen deadline preservation, expiry while closed, and the three-hour reminder.

## Safari developer build

The source can generate a macOS Safari Web Extension Xcode project and an unsigned app. It is not published on the App Store. Safari cannot install the Chromium ZIP or load the unpacked extension directly.

1. On a Mac with Xcode installed, run `sh release/build-safari.sh`.
2. Open `release/safari-project/Recenter/Recenter.xcodeproj` to inspect the generated app and extension.
3. For a local test, follow Apple's [unsigned extension instructions](https://developer.apple.com/documentation/safariservices/building-a-safari-app-extension), then run the app and enable Recenter in Safari's extension settings.
4. Allow Recenter access to X, Twitter, and Instagram, then refresh those tabs.

The unsigned app is at `release/safari-derived-data/Build/Products/Debug/Recenter.app`. The script does not install or launch it, change Safari settings, or sign it. Safari uses the page countdown and overlay without desktop notifications. Safari runtime behavior still needs an installed-browser check. Public distribution requires Apple signing and the applicable distribution review.

See [browser packaging commands](release/README.md) for reproducible builds and validation.

## Timers and reminders

- **Separate timers:** Twitter and X are the same app. Instagram has its own independent timer. Multiple tabs for one app share that app’s timer.
- **Automatic start:** Opening an app starts its timer. Once started, the timer counts continuous elapsed time across background tabs, tab closures, browser restarts, and sleep. Reopening preserves the original deadline.
- **Visible countdown:** A small bottom-right indicator on each app’s page says “X is on” or “Instagram is on” and counts down in minutes and seconds. It updates every second and turns amber in the final minute. The extension popup also shows each app’s countdown, including when its tabs are closed.
- **Refresh protection:** Refreshing, switching tabs, or navigating within an app does not reset its timer.
- **Prominent reminder:** At the deadline, a full-page overlay says **“It’s time to close Twitter / X”** or **“It’s time to close Instagram.”** A desktop notification also appears when permitted. There is no snooze button.
- **Close the app:** The overlay’s button closes all tabs for that app, leaving the other app and unrelated tabs alone.
- **Three-hour window:** From that app’s original deadline, its reminder remains active for three hours. Closing and reopening it during that window immediately shows the overlay again. Refreshes and browser restarts do not clear it; reopening does not extend it. The overlay shows the time until a fresh timer is available.
- **Fresh session:** At the end of the three-hour window, that app can start a new timer. If still open, its new timer starts automatically. Otherwise it starts when you next open the app. Closing an app before its deadline does not pause or reset its timer. If it expires while closed, the three-hour window still starts at that deadline. Reopening after the whole window has elapsed starts a fresh timer.
- **Settings:** Lowering the 5–15 minute duration immediately shortens existing unfinished timers, including closed apps. If the shorter allowance is already used, the close reminder starts immediately with a three-hour window. While any X or Instagram tab is open, you can only reduce the duration. Close both apps before increasing it for future sessions. Increasing the setting never extends an existing session. Existing cooldowns do not change.
- **Explicit pause:** Turning reminders off in the popup pauses unfinished timers and hides reminders. Turning them back on resumes the saved remaining time once, even if both apps are closed. Existing three-hour windows keep their original end times while reminders are off.
- **Sleep:** Deadlines are stored locally. Sleeping through a deadline shows the reminder on wake if still within the three-hour window. The extension cannot wake your laptop. Browser alarm delivery can be delayed by sleep or scheduling. Desktop reminders are suppressed while an app has no open tabs, but its deadline and cooldown still advance.

Permissions are limited to storage, alarms, notifications, and the three supported domains. No page content or browsing history is collected or transmitted.

## Verify

Run `bun test tests` for service-worker checks. For browser UI checks, serve this folder locally and open `tests/browser.html`; this test page simulates extension APIs and is not packaged in the extension.

For installed end-to-end verification, choose 5 minutes, open X, wait a minute, then open Instagram. Confirm each app expires independently. Close X before its deadline, wait, and reopen it to confirm the countdown kept running. Use the close button after expiry and reopen X to confirm the immediate reminder. Refresh and restart the browser to confirm persistence.

Chrome API references: [alarms](https://developer.chrome.com/docs/extensions/reference/api/alarms), [notifications](https://developer.chrome.com/docs/extensions/how-to/ui/notifications).

## License

Recenter is available under the [MIT License](LICENSE). You can use, modify, and redistribute it under that license.
