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
- `storage/cloud-project-store.js` is the authenticated Supabase adapter for projects, previews, and Build Mode progress.
- `lib/supabase/` contains optional browser/server clients and cookie-based session refresh.
- `supabase/migrations/` contains the database schema, row-level security policies, private preview storage, and the free-plan project limit.
- `/` opens the bilingual product landing page.
- `/create` opens the generator and imports existing TXT or CSV patterns.
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

## Project Data

Guest projects, Build Mode progress, and the selected language are stored
locally in the browser. Authenticated users use Supabase for projects and build
progress while IndexedDB remains a local active-project cache for Build Mode
and printing. On the first authenticated visit, local projects that do not
already exist in the account are migrated to the cloud.

Account access supports email registration, confirmation, sign-in, sign-out,
and password recovery through Supabase Auth.

Route calculation stays on the device. The cloud schema stores the generated
pin sequence and settings, while source and artwork previews use a private
Storage bucket with signed URLs. Free users are limited to five projects;
profiles marked as `admin` or using the `unlimited` plan bypass that limit.

## Supabase Setup

1. Create a Supabase project.
2. Run `supabase/migrations/202607280001_initial_projects.sql` in the Supabase
   SQL editor or apply it with the Supabase CLI.
3. Copy `.env.example` to `.env.local` and set the project URL and publishable
   key.
4. Restart Next.js after changing environment variables.

```bash
cp .env.example .env.local
pnpm dev
```

When the environment variables are absent, the application deliberately runs
without Supabase and does not attempt to refresh an auth session. Never expose
the Supabase service-role key in this application.

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
