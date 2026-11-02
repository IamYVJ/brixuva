# Brixuva

A minimal brick-breaker. Move the paddle with mouse/touch/arrow keys, launch with a tap or space.
60 levels with different board types (sliding rows, creeping descent, explosive bricks, varied grids), power-ups (wide, slow, multi-ball, extra life, laser, sticky, fireball), synthesised sound with a mute toggle (M), light/dark theme toggle, 1–3 star ratings per level, score and progress saved in `localStorage`.

Deployed to GitHub Pages by `.github/workflows/pages.yml` (Settings → Pages → Source: GitHub Actions).
Each deploy stamps a unique version into `index.html` and `version.json`; on load the game fetches
`version.json` uncached and, if it differs from the running version, clears caches and the service worker and reloads.
