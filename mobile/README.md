# String Art Dnipro Mobile

The mobile application uses Capacitor 8 and bundles the generator, projects,
build mode, and shared build links inside the native application. The native
projects are kept in `ios/` and `android/`; the same React components and String
Art core are shared with the Next.js website.

## Requirements

- Node.js 22 or newer
- pnpm 11
- Xcode 16 or newer for iOS
- Android Studio with Android SDK 36 for Android

## First run

```bash
pnpm install
pnpm mobile:sync
pnpm mobile:doctor
```

Open a native project:

```bash
pnpm mobile:ios
pnpm mobile:android
```

## Local development

Start Next.js first:

```bash
pnpm dev
```

Then run an iOS Simulator or Android Emulator build:

```bash
pnpm mobile:dev:ios
pnpm mobile:dev:android
```

If the iOS command reports that no simulator runtime is installed, open
Xcode > Settings > Components and install the latest iOS Simulator. The same
download can be started from Terminal with:

```bash
xcodebuild -downloadPlatform iOS
```

The Android Emulator reaches the host machine through `10.0.2.2`. A physical
device needs a reachable LAN URL, for example:

```bash
CAPACITOR_SERVER_URL=http://192.168.1.20:3000 pnpm mobile:run:ios
```

Run `pnpm mobile:sync` after changing the shared UI, generator core, Capacitor
plugins, or native configuration. The command builds `mobile-dist/` first and
then copies it into both native projects.

## Native integrations

- Photo upload opens the platform photo library instead of the browser file picker.
- PNG export writes a temporary native file and opens the system share sheet, where
  the artwork can be saved to Photos or Files or sent to another application.
- Email/password and Google authentication use the same Supabase account as the
  website. The session is restored after an application restart, and signing out
  switches the workspace back to local guest projects.
- Signed-in projects and build progress sync with the cloud. Local changes remain
  available offline and are retried when the connection returns.
- The installed bundle can cold-start without a network connection. Projects and
  build progress are written to IndexedDB first. Interrupted cloud
  updates stay in a local queue and are retried automatically when the device is
  online again.
- Browser builds keep the existing file-picker and download behavior.

### Supabase authentication setup

Add this URL to Authentication > URL Configuration > Redirect URLs in Supabase:

```text
stringartdnipro://auth/confirm
```

Google OAuth still uses the Supabase callback configured in Google Cloud. The
custom scheme is the final redirect from Supabase back into the installed app.
Email confirmation and password recovery continue on `stringartdnipro.com`, so
users can complete those flows in the browser and then sign in to the app.

## Links

The apps accept the custom scheme `stringartdnipro://` and Android App Links for
`https://stringartdnipro.com/s/...`. Full Universal Link verification requires
store signing identifiers and will be enabled before TestFlight and Play testing.

## Store release boundary

The core workspace now runs from the installed bundle and supports a completely
offline cold start. Platform authentication and cloud project synchronization are
connected. Full Universal Link verification, native store signing, and release
metadata remain before TestFlight and Google Play testing.
