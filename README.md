# Brixuva

A minimal brick-breaker. Move the paddle with mouse/touch/arrow keys, launch with a tap or space.
12 levels, score and progress saved in `localStorage`.

Deployed to GitHub Pages by `.github/workflows/pages.yml` (Settings → Pages → Source: GitHub Actions).
Each deploy stamps a unique version into `index.html` and `version.json`; on load the game fetches
`version.json` uncached and, if it differs from the running version, clears caches and the service worker and reloads.
