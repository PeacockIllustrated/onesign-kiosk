# Onesign Kiosk (Static PWA)

Zero-build, mobile‑first kiosk prototype. Tailwind via CDN keeps the **exact** visual/behavioural parity from the MVP.

## Run locally (no build step)
- Option A: double‑click `index.html`
- Option B (recommended for SW/PWA): serve over HTTP
  ```bash
  npx http-server . -p 5173
  # or
  python3 -m http.server 5173
  ```
  Then open http://localhost:5173

## Add to repo
```bash
git init
git add .
git commit -m "chore: seed Onesign kiosk static PWA"
git branch -M main
# then create remote and push
```

## Deploy
- Netlify/Drag‑and‑drop folder
- Vercel/Static output
- GitHub Pages (enable Pages on the repo, set root)

## Replace icons
Swap `assets/icons/icon-*.png` with real PNGs. The SVG icon is used by most modern platforms.

## Notes
- Service worker is minimal (cache‑first). Remove `sw.js` + registration if you don’t want offline.
- All transitions & logic are embedded in `index.html` to keep behaviour **untouched**.
- Tested viewport: 360×800 through 430×932. Lock portrait for kiosk.
