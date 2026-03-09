# VisionTrace — Next.js PWA

> Digital light box for tracing. Overlay any reference image on your live camera feed.  
> **100% offline · No login · AMOLED dark · Works on any phone browser**

---

## Features

- 📷 Live camera background (back camera on phones)
- 🖼 Load reference image from your gallery (no permissions needed)
- ✋ Pinch-to-zoom, rotate, drag with 2 fingers
- 🔒 Tracing Lock — freezes image completely. Long-press to unlock
- ⊞ Grid overlay — 3×3 (rule of thirds) or 10×10
- ⬡ Perspective Fix — 4 draggable corner handles to de-skew
- ◑ Opacity slider — vertical, right edge
- 🌑 Auto-hiding HUD (fades after 3.5s inactivity)
- 📱 PWA — install to home screen, works offline

---

## Running Locally (Development)

Since you know Next.js, this is exactly what you already know:

```bash
# 1. Unzip the project
unzip visiontrace-web.zip
cd visiontrace-web

# 2. Install dependencies
npm install

# 3. Start dev server
npm run dev
```

Open http://localhost:3000 in your browser.

> **Important for camera on mobile:** Camera only works on HTTPS or localhost.
> To test on your phone during development, use:
> ```bash
> npm run dev -- --hostname 0.0.0.0
> ```
> Then open `http://YOUR_COMPUTER_IP:3000` on your phone.
> Find your IP with `ipconfig` (Windows) or `ifconfig` (Mac/Linux).

---

## Production Build

```bash
# Build for production
npm run build

# Start production server
npm start
```

---

## Deploying (Free Options)

### Option 1 — Vercel (Easiest, recommended)

Vercel is made by the creators of Next.js. Free forever for personal projects.

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy (follow the prompts)
vercel

# Your app gets a live URL like: https://visiontrace.vercel.app
```

Or:
1. Push your code to GitHub
2. Go to vercel.com → Import project → Connect your repo
3. Click Deploy → done. Every `git push` auto-deploys.

> Camera and PWA work perfectly on Vercel because it serves over HTTPS automatically.

### Option 2 — Netlify

```bash
npm install -g netlify-cli
npm run build
netlify deploy --prod --dir=.next
```

### Option 3 — Self-hosted (VPS / your own server)

```bash
npm run build
npm start  # runs on port 3000

# Use nginx to proxy port 3000 → port 80/443
# You need HTTPS for camera to work on mobile (get a free cert via Let's Encrypt)
```

---

## How the PWA Install Works

Once deployed on HTTPS:

1. User opens the URL in Chrome (Android) or Safari (iPhone)
2. Android: Chrome shows "Add to Home Screen" banner automatically
3. iPhone: tap Share → "Add to Home Screen"
4. App installs with the VisionTrace icon
5. Opens full screen, no browser bar — feels like a native app
6. Works offline after first load (service worker caches assets)

---

## Project Structure

```
visiontrace-web/
├── app/
│   ├── layout.tsx      ← PWA meta tags, fonts
│   ├── page.tsx        ← The entire app (main screen)
│   └── globals.css     ← AMOLED theme, resets
├── components/
│   ├── GridOverlay.tsx     ← SVG grid (3x3 / 10x10)
│   ├── PerspectiveOverlay.tsx ← Draggable corner handles
│   └── HudButton.tsx       ← Reusable HUD button
├── hooks/
│   ├── useCamera.ts    ← Camera stream access
│   ├── useAutoHide.ts  ← 3.5s UI fade timer
│   └── usePWA.ts       ← Service worker registration
├── public/
│   ├── manifest.json   ← PWA config (name, icons, colors)
│   └── sw.js           ← Service worker (offline support)
└── next.config.js      ← Next.js + security headers
```

---

## Adding Icons (for PWA)

The manifest references `icon-192.png` and `icon-512.png`.
Create these and put them in `/public/`:

- 192×192px PNG — used on Android home screen
- 512×512px PNG — used for splash screen

Use any image editor or a free tool like https://favicon.io to generate them.

---

## Notes

- **No Manga Mode** in this version (not selected — can be added later with Canvas API)
- **Privacy:** No data ever leaves the device. No analytics. No server processing. Images stay local.
- **iOS Safari:** Camera works but PWA support is slightly more limited than Android Chrome. Install via Share → Add to Home Screen still works great.
