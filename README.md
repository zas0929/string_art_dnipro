# String Art Generator

A Next.js application for generating String Art patterns and guiding users
through the artwork assembly process. The Reference v7 mathematical core runs
entirely in the browser, so source photos are not sent to a server.

## Current Features

- Reference v7 portrait generation with `240` pins and up to `5000` lines.
- Responsive desktop and mobile interface.
- Photo crop, drag, mouse-wheel zoom, pinch zoom, sharpness, and clarity controls.
- Selectable `3500`, `4000`, `4500`, and `5000` line previews.
- Multiple thread thickness presets from `0.11 mm` to `0.30 mm`.
- TXT pattern import and export, plus PNG artwork export.
- Build Mode with animated progress, manual seeking, adjustable speed, voice
  guidance, automatic progress restoration, and the "I'm lost" route finder.
- Separate printable cover and instruction documents with configurable ranges,
  rows, preview image, sticker step, and English or Ukrainian copy.
- English and Ukrainian application UI. Ukrainian is used by default, and the
  selected language is saved in the browser.

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
artwork diameter. The main completed preview defaults to `4000` lines, while
`3500`, `4000`, `4500`, and `5000` line variants remain available for
comparison.

Route calculation runs in a Web Worker. The interface stays responsive while
progress updates arrive in batches.

## Architecture

- `components/StringArtGenerator.jsx` composes the React workspace and settings panel.
- `components/useStringArtController.js` manages controller mount and cleanup in the React lifecycle.
- `app.js` exports `mountStringArtApp(root)`, owns the current generation state, removes DOM listeners during cleanup, and terminates an active worker.
- `core/reference-thread-planner.js` contains the single Reference v7 route-planning core.
- `core/i18n.js` contains the English and Ukrainian UI dictionaries.
- `workers/reference-worker.js` performs the expensive calculation outside the main UI thread.
- `core/scheme-format.js` handles TXT and CSV pattern import and export.
- `storage/local-project-store.js` stores the latest pattern and Build Mode progress in IndexedDB.
- `/` opens the generator and imports existing TXT or CSV patterns.
- `/build` opens Build Mode with voice guidance, playback speed, seeking, and IndexedDB progress restoration.
- `/print` creates configurable cover and instruction PDFs in English or Ukrainian.

This separation is safe under React Strict Mode: repeated mounts do not create
duplicate event listeners.

Next.js is the only supported application entry point. The standalone static
version is no longer maintained.

## Running Next.js

Node.js `22.13` or newer and pnpm are required. The repository currently uses
`pnpm 11.9.0`.

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
Google Chrome browser. They cover desktop and mobile generation, pattern
import, Build Mode persistence, language switching, and printable PDF page
counts.

For a quick mechanical check, temporarily use `180-240` pins and `800-2000`
lines. For a final portrait, use the default `240` pins and compare the
available high-line-count previews.

After uploading a photo, drag it with a mouse or touch gesture to adjust the
crop. Use the Photo zoom slider, its plus and minus controls, a mouse wheel, or
a two-finger pinch gesture to change scale. Optional photo enhancements can
increase sharpness and clarity before the Reference v7 calculation starts.

## Local Data

The application currently has no backend or user accounts. The latest pattern,
Build Mode progress, and selected interface language are stored locally in the
browser. Clearing browser storage removes this local state.

Source photos and route calculation data stay on the device. A future backend
milestone will add authenticated projects, cloud persistence, account limits,
subscriptions, and administrator access.

## Printing

The cover and instruction table are printed as separate documents. Instruction
pages use four columns, include a wider left margin for binder attachment, and
avoid generating an extra blank page. For manual double-sided printing, print
even pages first, turn the sheets over, and then print odd pages.

## Comparing Patterns

Compare route metrics from two TXT patterns with:

```bash
node tools/compare-schemes.mjs reference.txt candidate.txt
```

The script reports average transition length, pin and direction distributions,
repeated chords, parallel lines, and immediate reversals.
