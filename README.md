# String Art Generator

A Next.js application for generating String Art patterns and guiding users
through the artwork assembly process. The Reference v7 mathematical core runs
entirely in the browser, so source photos are not sent to a server.

## How It Works

1. Loads a source image.
2. Lets the user crop the photo by zooming and dragging.
3. Places numbered pins around a circle.
4. Builds a route with the Reference v7 core by measuring residual darkness
   along every valid chord, selecting the best line, and subtracting its
   contribution from the residual image.
5. Excludes recently used pins and respects the configured minimum pin gap.
6. Produces an artwork preview and a pin-by-pin assembly sequence.

The defaults are `0.19 mm` thread, `240` pins, `5000` lines, and a `47 cm`
artwork diameter. Completed results expose `3500`, `4000`, `4500`, and `5000`
line previews when those variants are available.

Route calculation runs in a Web Worker. The interface stays responsive while
progress updates arrive in batches.

## Architecture

- `components/StringArtGenerator.jsx` composes the React workspace and settings panel.
- `components/useStringArtController.js` manages controller mount and cleanup in the React lifecycle.
- `app.js` exports `mountStringArtApp(root)`, owns the current generation state, removes DOM listeners during cleanup, and terminates an active worker.
- `core/reference-thread-planner.js` contains the single Reference v7 route-planning core.
- `workers/reference-worker.js` performs the expensive calculation outside the main UI thread.
- `core/scheme-format.js` handles TXT and CSV pattern import and export.
- `/` opens the generator and imports existing TXT or CSV patterns.
- `/build` opens Build Mode with voice guidance, playback speed, seeking, and IndexedDB progress restoration.
- `/print` creates configurable cover and instruction PDFs in English or Ukrainian.

This separation is safe under React Strict Mode: repeated mounts do not create
duplicate event listeners.

Next.js is the only supported application entry point. The standalone static
version is no longer maintained.

## Running Next.js

Node.js `20.9` or newer and pnpm are required.

```bash
pnpm install
pnpm dev
```

Then open the address printed by Next.js, usually
`http://localhost:3000/`.

Production build and tests:

```bash
pnpm build
pnpm test
pnpm test:smoke
```

Smoke tests start Next.js at `http://127.0.0.1:3100` and use an installed
Google Chrome browser.

For a quick mechanical check, temporarily use `180-240` pins and `800-2000`
lines. For a final portrait, use the default `240` pins and compare the
available high-line-count previews.

After uploading a photo, drag it with a mouse or touch gesture to adjust the
crop. Use the Photo zoom slider, its plus and minus controls, a mouse wheel, or
a two-finger pinch gesture to change scale.

## Comparing Patterns

Compare route metrics from two TXT patterns with:

```bash
node tools/compare-schemes.mjs reference.txt candidate.txt
```

The script reports average transition length, pin and direction distributions,
repeated chords, parallel lines, and immediate reversals.
