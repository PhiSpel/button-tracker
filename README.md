# Button Tracker

A minimal progressive web app for logging red and green button presses with optional comments and timestamps. All data is stored locally in IndexedDB — nothing is ever sent to a server.

## Features

- Two large tap targets: red and green buttons
- Optional comment field per press (enter text before tapping)
- **Log tab** — daily totals and 3-hourly breakdowns (all days / weekdays / weekends)
- **Export tab** — download or share all entries as a CSV file (`button-log.csv`)
- Works fully offline after the first load (service worker caches all assets)
- Installable as a PWA via "Add to Home Screen" in any modern mobile browser

## Privacy

All data lives on your device in browser storage. The app has no backend, no analytics, no cookies, and no external requests of any kind. The strict Content Security Policy (see `_headers`) blocks any such requests even if code were injected.

The hosting provider (Cloudflare Pages) sees connection metadata — your IP address and browser — when the page loads, as with any website. To prevent even that, use a VPN or Tor Browser before visiting.

## How to use

1. Tap a button (red or green) to log a press with the current timestamp.
2. Optionally type a comment in the text field before tapping — it is saved with the entry and cleared automatically.
3. Open the **Log** tab to review daily totals and 3-hourly breakdowns. Tap a comment count in a row to expand the individual entries.
4. Open the **Export** tab to download all entries as a CSV, or share the file directly on mobile.
5. To install: use your browser's "Add to Home Screen" or install prompt.

## Self-hosting / deployment

The app is pure static files — no build step, no server-side logic. It can be deployed to any static host (GitHub Pages, Netlify, Vercel, etc.).

**Cloudflare Pages:**

1. Connect this repository to a Cloudflare Pages project.
2. Leave the build command blank.
3. Set the publish directory to `/` (repository root).
4. Deploy. The `_headers` file is picked up automatically by Cloudflare Pages and applies the security headers on every response.

## Development

No dependencies, no build tooling. Edit `index.html`, `style.css`, and `app.js` directly.

After making changes, bump the cache name in `sw.js`:

```js
const CACHE = 'tracker-v6'; // increment the version number
```

This causes the service worker to activate the new version and drop the old cache, so returning users receive the update immediately.

## Security headers

Configured in `_headers` for Cloudflare Pages:

| Header | Value |
|---|---|
| `Content-Security-Policy` | `default-src 'self'` — no inline scripts, no external resources |
| `Referrer-Policy` | `no-referrer` |
| `Permissions-Policy` | camera, microphone, geolocation, payment, and USB all disabled |
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |

## Issues / feedback

[Open an issue on GitHub](https://github.com/phispel/button-tracker/issues)
