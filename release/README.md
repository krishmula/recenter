# Publishing Recenter

## Prepared

- `recenter-1.4.0-chrome-web-store.zip`: Upload this file to the Chrome Web Store. Unlike the local installation ZIP, it has manifest.json at the archive root and contains only extension assets.
- `store/LISTING.md`: Draft listing, single-purpose statement, permission explanations, and reviewer instructions.
- `store/PRIVACY.md`: Local draft. Add a support contact and host it publicly before submitting.
- `store/promo-440x280.png`: Small promotional image.
- `store/screenshot-countdown.png` and `store/screenshot-reminder.png`: 1280×800 captures of the actual UI code using the local test adapter. Timing data is simulated; confirm the installed experience before submitting these.
- `build.py`: Run `python3 release/build.py` from the project to rebuild the store package.

## Remaining

1. Confirm public or unlisted distribution.
2. Sign into a registered Chrome Web Store developer account. A one-time registration fee applies to new accounts; complete registration yourself.
3. Host the final privacy policy at a public HTTPS URL.
4. Review the prepared promo and two screenshots; replace the local-adapter captures with installed-extension captures if their experience differs.
5. Complete an installed-extension smoke test on X and Instagram, including notification delivery, close/reopen, timer adjustments, and browser restart. Automated service-worker and simulated browser checks do not replace this.
6. Upload the store ZIP, enter the reviewed listing and disclosures, and submit for review. Publishing is subject to Google review.

No dashboard draft has been created, no ZIP uploaded, and no submission made yet. The dashboard currently requires sign-in. Draft assets are local.

References checked October 12, 2026:

- https://developer.chrome.com/docs/webstore/publish/
- https://developer.chrome.com/docs/webstore/register/
- https://developer.chrome.com/docs/webstore/images/
- https://developer.chrome.com/docs/webstore/program-policies/user-data-faq/
