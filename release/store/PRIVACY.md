# Recenter privacy policy

Draft for version 1.5.0, prepared October 29, 2026. Add the publisher’s support contact and host this policy at a public HTTPS URL before submitting the extension.

## What Recenter handles

Recenter checks open tabs matching Twitter/X and Instagram to determine which supported app is open. Tab URLs are processed temporarily on your device for this purpose and to close an app’s tabs when you press its close button. Recenter does not store a full browsing history, read posts or messages, or access account credentials.

Recenter stores the following locally in your browser’s extension storage:

- Your selected timer duration and whether reminders are enabled.
- Which supported apps have open tabs.
- Per-app session start times, scrolling allowances, countdown deadlines, and remaining time for explicitly paused sessions.
- Whether an app’s timer expired and when its three-hour reminder window ends.

## How it uses this information

This information is used only to provide continuous timers, explicit pause controls, live countdowns, and reminders to stop scrolling. It also ensures opening another tab, refreshing, or reopening an app does not reset the relevant session.

## Transmission and sharing

The extension does not transmit this information to the developer or third parties. It has no server, advertising, analytics, tracking SDKs, or remote executable code. Extension messages stay within your browser, and desktop notifications are handled by the browser and operating system.

Recenter does not sell user data, use it for advertising, or use it for purposes unrelated to its timer and reminder features.

## Storage and retention

Preferences and unfinished sessions stay in local extension storage until replaced or the extension’s data is removed. Expired reminder state is cleared after its three-hour window ends, when the extension next processes an event. No user-data backup or developer-controlled copy is created.

Running deadlines continue across tab closures and browser restarts. If a timer expires while closed, its reminder window ends three hours after that deadline. Version 1.4.0 saved remaining time on closure without its original deadline. Version 1.5.0 converts that saved balance once to a deadline when reminders are enabled. If reminders are disabled, the balance stays paused until you enable them. Browser or operating-system behavior can affect when timers are processed.

## Your controls

You can adjust the timer duration and pause reminders from the extension panel. Turning reminders off pauses unfinished sessions. Turning them on resumes those sessions even with no tabs open. Existing reminder windows keep their end times. Removing Recenter through the browser’s extension management page removes its local extension storage under normal browser behavior.

## Contact

Before publication, the publisher must add a monitored support contact here and in the store listing.
