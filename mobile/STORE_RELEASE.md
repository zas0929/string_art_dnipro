# Store release guide

This checklist prepares the same offline-capable Capacitor application for
TestFlight and Google Play testing. The public bundle identifier is
`com.stringartdnipro.app` on both platforms.

## 1. One-time Apple setup

1. Join the Apple Developer Program and open `ios/App/App.xcodeproj` in Xcode.
2. Select the App target, then Signing & Capabilities, and choose your team.
3. Register the bundle ID `com.stringartdnipro.app` if Xcode does not create it.
4. Create the app in App Store Connect with the name `String Art Dnipro`.
5. Enable Associated Domains for the identifier. The project already contains
   `applinks:stringartdnipro.com` and `applinks:www.stringartdnipro.com`.
6. Set this Vercel variable for Production:

   ```text
   APPLE_APP_ID=<APPLE_TEAM_ID>.com.stringartdnipro.app
   ```

The Apple Team ID is shown at developer.apple.com/account under Membership.

## 2. One-time Android signing

Create one upload key and keep both the file and passwords outside Git:

```bash
mkdir -p android/release
keytool -genkeypair -v \
  -keystore android/release/string-art-dnipro-upload.jks \
  -alias string-art-dnipro \
  -keyalg RSA -keysize 2048 -validity 10000
cp android/keystore.properties.example android/keystore.properties
```

Fill in `android/keystore.properties`. Its `storeFile` is relative to `android/`,
so the example value is `release/string-art-dnipro-upload.jks`. Back up the key
and passwords in a password manager. Google Play App Signing protects the final
distribution key, but this upload key is still required for updates.

Create the application in Play Console with package name
`com.stringartdnipro.app`, enable Play App Signing, and upload the AAB generated
by the release command below.

After Play Console shows the app-signing certificate, copy its SHA-256
fingerprint into this Vercel Production variable:

```text
ANDROID_SHA256_CERT_FINGERPRINTS=AA:BB:CC:...
```

For an Internal App Sharing build signed with another certificate, add both
fingerprints separated by commas.

## 3. Verify domain links

Redeploy Vercel after adding the variables, then verify that both endpoints
return JSON without redirects:

```text
https://www.stringartdnipro.com/.well-known/apple-app-site-association
https://www.stringartdnipro.com/.well-known/assetlinks.json
```

Shared pattern URLs under `/s/...` will then open the installed app. Without the
app they continue to open the website.

## 4. Build TestFlight

```bash
pnpm mobile:release:ios
```

In Xcode select `Any iOS Device (arm64)`, run Product > Archive, then Distribute
App > App Store Connect > Upload. Increment `CURRENT_PROJECT_VERSION` before
every upload. Increment `MARKETING_VERSION` for a new public version.

## 5. Build Google Play

```bash
pnpm mobile:release:android
```

The signed bundle is written to:

```text
android/app/build/outputs/bundle/release/app-release.aab
```

Increment `versionCode` before every Play upload. Change `versionName` for a new
public version. Upload the first build to Internal testing, add testers, and only
then promote it to Closed testing or Production.

## 6. Store declarations

Before review, complete the privacy forms using the actual production behavior:

- account email and authentication identifiers are processed by Supabase;
- saved projects and build progress sync to Supabase for signed-in users;
- selected photos and generated patterns are user content;
- camera/photo-library access is user initiated;
- the application does not use advertising or cross-app tracking;
- the app must link to the privacy policy and account deletion instructions.

Use screenshots from a release build, not the browser. Test sign-up, Google login,
password recovery, photo import, generation, cloud save, shared links, build-mode
audio, wake lock, PNG sharing, offline restart, and sign-out on real devices.

## 7. Release commands

```bash
pnpm test
pnpm build
pnpm mobile:release:check
pnpm mobile:release:ios
pnpm mobile:release:android
```

`mobile:release:check` never prints signing secrets. The Android release command
fails before Gradle starts when the upload key is missing. The release check also
runs the mobile production-bundle smoke suite before validating native signing
and domain-link configuration.
