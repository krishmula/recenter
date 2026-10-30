# Recenter

## Summary

Automatic timers for X and Instagram, with visible countdowns and reminders to close the app.

## Detailed description

A scroll. Then a breath.

Recenter automatically starts a timer when you open Twitter/X or Instagram. No manual start button, account, or setup routine.

• Separate timers for Twitter/X and Instagram. Multiple tabs for the same app share one timer.
• Set a scrolling allowance from 5 to 15 minutes. Default: 10 minutes.
• See a live countdown on the page and in the extension panel.
• When time is up, a prominent full-page reminder tells you it’s time to close the app. One button closes that app’s tabs.
• Reopening within three hours brings the close reminder back immediately.
• Close an app before time is up and its countdown keeps running. Reopening preserves the original deadline.
• Shorten running timers whenever you want. While X or Instagram is open, you cannot increase the duration. Increasing it after closing both apps applies to future sessions, without extending existing sessions.

Recenter runs locally. It does not send app activity, timer settings, or session information to the developer or third parties. It has no analytics or advertising.

Timers count continuous elapsed time after an app opens, including tab closures, browser restarts, and computer sleep. Only turning reminders off explicitly pauses unfinished timers. Turning reminders back on resumes them even with no tabs open. A timer that expires while closed keeps its three-hour window anchored to its deadline.

Version 1.4.0 saved remaining time on tab closure and lost the original deadline. Version 1.5.0 converts that balance once into a deadline from the current time when reminders are enabled. It does not grant a full new allowance. Disabled saved sessions wait until reminders are enabled. Desktop notification availability depends on browser and system settings; the on-page reminder works independently.

## Suggested category

Productivity. Use the closest current dashboard category for focus or wellbeing tools.

## Single purpose

Help users limit scrolling on Twitter/X and Instagram through automatic per-app timers, live countdowns, and close-app reminders.

## Permission justifications

- storage: Save local duration preferences, timer deadlines and explicitly paused balances, and three-hour reminder deadlines across tab closures and browser restarts.
- alarms: Deliver deadline and reminder-window events even when the service worker is suspended.
- notifications: Display a desktop reminder when an app’s timer expires.
- https://*.x.com/* and https://*.twitter.com/*: Detect this app’s open tabs, deliver its on-page countdown/reminder, and close only its tabs when the user presses the close button.
- https://*.instagram.com/*: Detect this app’s open tabs, deliver its on-page countdown/reminder, and close only its tabs when the user presses the close button.
- Remote code: None. All executable code is bundled in the extension.

## Privacy disclosure notes

The extension uses matching tab URLs locally to identify supported apps and saves app-specific timing state. Do not claim it never accesses browsing activity. It sends no user data to the developer or third parties, and does not save a full browsing-history log or page contents. Complete dashboard disclosures against the live form and the privacy policy; local handling still needs a privacy policy.

## Reviewer instructions

No login or payment is required to use Recenter. Install the extension, set the duration to 5 minutes, and open https://x.com or https://www.instagram.com. The countdown and reminder do not require signing into those sites. Open the other site later to verify independent timers. Close all tabs for one app before the timer finishes, wait, then reopen to verify the original deadline and reduced countdown. Let the timer finish to verify the full-page close reminder; close and reopen that app to verify the three-hour reminder. Shortening the duration below time already used should show the reminder immediately.

## Submission fields still needed

- Confirm public or unlisted distribution.
- Publisher account, display name, and verified contact details.
- A public HTTPS URL serving PRIVACY.md or equivalent rendered page.
- Review the prepared promotional image and UI screenshots, captured using a local adapter. Verify against the installed extension before submission.
- Final installed-extension check, including desktop notifications and browser restart behavior.
