# String Art Dnipro Mobile

The mobile application uses Capacitor 8 and opens the production generator at
`https://stringartdnipro.com/create`. The native projects are kept in `ios/` and
`android/`; the existing Next.js application remains the source of the UI and
server functionality during the prototype stage.

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

Run `pnpm mobile:sync` after changing Capacitor plugins or native configuration.

## Native integrations

- Photo upload opens the platform photo library instead of the browser file picker.
- PNG export writes a temporary native file and opens the system share sheet, where
  the artwork can be saved to Photos or Files or sent to another application.
- Projects and build progress are written to IndexedDB first. Interrupted cloud
  updates stay in a local queue and are retried automatically when the device is
  online again.
- Browser builds keep the existing file-picker and download behavior.

## Links

The apps accept the custom scheme `stringartdnipro://` and Android App Links for
`https://stringartdnipro.com/s/...`. Full Universal Link verification requires
store signing identifiers and will be enabled before TestFlight and Play testing.

## Store release boundary

The current remote-server shell is intended for device testing. Before store
submission, the generator and build-mode client UI will be bundled with the app,
then platform authentication will be connected. Local-first drafts now protect
work while the app is already open and the network is unstable; bundling the UI is
still required for a completely offline cold start.
