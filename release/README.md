# Build browser packages

Run commands from the repository root. These builds use version 1.5.0 from `extension/manifest.json`. The public GitHub 1.4.0 release remains unchanged. The new packages are local, unsigned developer artifacts, not public store releases.

## Build and verify the archives

```sh
python3 release/build.py
(cd release && shasum -a 256 -c SHA256SUMS)
```

The build selects manifest overrides from `release/browsers.json` and copies the same extension assets for every browser. It verifies each ZIP member against the source bytes. ZIP entries have sorted names, fixed timestamps, and fixed file permissions. Identical inputs produce identical archives with the same Python and compression runtime.

The generated files are:

- `release/recenter-1.5.0.zip`: Chromium manual-install package with a `recenter` folder, README, and MIT license.
- `release/recenter-1.5.0-chrome-web-store.zip`: Chrome store upload candidate with `manifest.json` at its root and the MIT license.
- `release/recenter-1.5.0-firefox-unsigned.zip`: Firefox signing candidate with `manifest.json` at its root and the MIT license.
- `release/recenter-1.5.0-safari-unsigned.zip`: Safari extension resources for conversion, with `manifest.json` at its root and the MIT license. This ZIP is not an installable Safari app.
- `release/unpacked/chrome`, `release/unpacked/firefox`, and `release/unpacked/safari`: developer resources.
- `release/build-manifest.json`: package SHA-256 hashes and per-browser file hashes.
- `release/SHA256SUMS`: archive hashes for `shasum` verification.

All generated files are ignored by Git. Rebuild after source changes. The build refuses unexpected files in an unpacked browser directory to avoid packaging stale assets.

## Validate Firefox

```sh
python3 release/build.py
bun install --cwd release/tooling --frozen-lockfile
bun run --cwd release/tooling lint:firefox
```

The isolated tooling pins `web-ext` in `release/tooling/bun.lock`. Bun runs its JavaScript entry point directly, so Node is not required. Dependencies stay in ignored `release/tooling/node_modules`.

Firefox uses a Manifest V3 background script, the Gecko ID `recenter@krishmula.github.io`, and desktop minimum version 140.0. Its data collection declaration is `required: ["none"]`, as required for new submissions since November 3, 2025. See [Mozilla's manifest reference](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/browser_specific_settings).

The October 29, 2026 lint run with web-ext 10.8.0 reported zero errors, zero notices, and three warnings. Two warnings concern existing dynamic `innerHTML` assignments in `content.js`. The third concerns Firefox Android before 142, which does not support the data collection declaration. This package targets desktop Firefox. The two HTML warnings interpolate fixed app labels, not page content or external input. Decide Android support and review these warnings before submission. Lint does not prove runtime behavior. Installed Firefox checks passed for both app countdowns, reopening, original deadlines, expiry while closed, and three-hour reminders.

For temporary developer installation, load `release/unpacked/firefox/manifest.json` through `about:debugging#/runtime/this-firefox`. Firefox removes it on exit. Permanent installation in standard Firefox requires Mozilla signing. No Mozilla upload, signing request, or listing has been made.

## Run installed-extension checks

Install the pinned tooling and its matching browsers:

```sh
bun install --cwd release/tooling --frozen-lockfile
(cd release/tooling && bun node_modules/playwright/cli.js install chromium firefox)
python3 release/build.py
bun run --cwd release/tooling test:chromium
bun run --cwd release/tooling test:firefox
```

The checks use isolated browser profiles and temporarily install the real extension. Network routes supply minimal X and Instagram pages, so no social account or local web server is needed. They check the stored deadline across closing and reopening, expiry while closed, and the three-hour reminder. Expiry is accelerated through the extension's storage to avoid waiting for a five-minute allowance. Temporary profiles are removed when the checks finish.

Set `CHROMIUM_PATH` or `FIREFOX_PATH` to test an existing compatible browser binary. The October 29 Chromium check passed for both apps. The Firefox check also passed for both apps. Its temporary copy adds a messaging probe on an intercepted control page because Firefox debugging does not expose the extension popup as a normal automation page. The original extension scripts are unchanged, and the probe is not part of any distributed package. These checks do not verify system notification appearance or Safari runtime behavior.

## Build the unsigned Safari app

On macOS with Xcode installed:

```sh
sh release/build-safari.sh
```

The script builds the archives, then invokes Apple's converter with Swift, macOS only, no prompt, and no Xcode launch:

```sh
xcrun safari-web-extension-converter release/unpacked/safari \
	--project-location release/safari-project --app-name Recenter \
	--bundle-identifier io.github.krishmula.recenter --swift --macos-only \
	--copy-resources --no-open --no-prompt --force
```

The converter is also called `safari-web-extension-packager` in newer Apple documentation. The script corrects the generated app identifier's capitalization in Xcode 26.5 so that the app and embedded extension share the required prefix. It then runs:

```sh
xcodebuild -project release/safari-project/Recenter/Recenter.xcodeproj \
	-scheme Recenter -configuration Debug -sdk macosx \
	-destination 'generic/platform=macOS' \
	-derivedDataPath release/safari-derived-data CODE_SIGNING_ALLOWED=NO build
```

The October 29, 2026 macOS build succeeded. Xcode reported an out-of-date CoreSimulator, but the macOS targets built successfully.

The generated project is `release/safari-project/Recenter/Recenter.xcodeproj`. The app is `release/safari-derived-data/Build/Products/Debug/Recenter.app`. Repeating the script replaces the generated project, so keep source changes outside that directory. The project, app, and derived data are ignored by Git.

With `CODE_SIGNING_ALLOWED=NO`, the app has no Apple signing identity or team. The Mach-O linker still emits an ad hoc signature, which does not make the app a signed distribution build.

Safari uses a background script and omits the unsupported `notifications` permission. Host permissions, countdowns, and page overlays use the shared source. No desktop notification is expected in Safari. The script does not change browser settings, install or run the app, sign, or upload anything.

Follow Apple's [local unsigned extension instructions](https://developer.apple.com/documentation/safariservices/building-a-safari-app-extension) for a developer test. Safari runtime behavior has not been verified. Public distribution still needs Apple signing and the applicable review. See Apple's [packaging](https://developer.apple.com/documentation/safariservices/packaging-a-web-extension-for-safari) and [distribution](https://developer.apple.com/documentation/safariservices/distributing-your-safari-web-extension) guides.

## Prepare store submissions

The Chrome drafts remain in `release/store/`:

- `LISTING.md`: listing, permission explanations, and reviewer instructions.
- `PRIVACY.md`: privacy policy draft. Add a support contact and host it publicly before submission.
- `promo-440x280.png`: promotional image.
- `screenshot-countdown.png` and `screenshot-reminder.png`: local-adapter captures with simulated timing. Replace them if installed behavior differs.

Before distribution, verify each installed browser on X and Instagram. Check notification delivery where supported, close and reopen, duration changes, browser restart, sleep, and persistence. Review each store's disclosures and signing requirements. No ZIP upload or store submission is part of this build.
