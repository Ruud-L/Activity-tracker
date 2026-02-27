# Activity Tracker Download Hub

Static one-page GitHub Pages site with local i18n JSON files (22 languages).

## GitHub Pages setup

1. Open repository settings on GitHub.
2. Go to **Pages**.
3. Set **Source** to `Deploy from a branch`.
4. Select branch `main`.
5. Select folder `/site`.
6. Save.

## Download file

The download button points to:

- `site/Activity_Tracker_Setup.exe`

If you publish a new build, replace this file with the new installer (same filename), then push to `main`.

## Placeholder to replace

1. In `site/index.html`, replace the support URL placeholder:
   - `<PAYPAL_URL>`
