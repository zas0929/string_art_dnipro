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

The Android Emulator reaches the host machine through `10.0.2.2`. A physical
device needs a reachable LAN URL, for example:

```bash
CAPACITOR_SERVER_URL=http://192.168.1.20:3000 pnpm mobile:run:ios
```

Run `pnpm mobile:sync` after changing Capacitor plugins or native configuration.

## Links

The apps accept the custom scheme `stringartdnipro://` and Android App Links for
`https://stringartdnipro.com/s/...`. Full Universal Link verification requires
store signing identifiers and will be enabled before TestFlight and Play testing.

## Store release boundary

The current remote-server shell is intended for device testing. Before store
submission, the generator and build-mode client UI will be bundled with the app
and the native photo picker, sharing, offline drafts, and platform authentication
will be connected. This keeps the app useful when the network is unstable and
gives it native functionality beyond a website wrapper.
