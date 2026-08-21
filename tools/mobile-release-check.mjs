import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const expectedBundleId = "com.stringartdnipro.app";
const requireAndroidSigning = process.argv.includes("--android");
const preparingIos = process.argv.includes("--ios");
const errors = [];
const warnings = [];

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

function check(condition, message) {
  if (!condition) errors.push(message);
}

function warn(condition, message) {
  if (!condition) warnings.push(message);
}

function pngDimensions(relativePath) {
  const filePath = path.join(root, relativePath);
  check(fs.existsSync(filePath), `Missing image: ${relativePath}`);
  if (!fs.existsSync(filePath)) return null;

  const data = fs.readFileSync(filePath);
  check(data.subarray(1, 4).toString("ascii") === "PNG", `${relativePath} is not a PNG file`);
  if (data.length < 24) return null;

  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
}

function parseProperties(source) {
  return Object.fromEntries(
    source
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const separator = line.indexOf("=");
        return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
      }),
  );
}

const capacitorSource = read("capacitor.config.ts");
const androidGradle = read("android/app/build.gradle");
const androidManifest = read("android/app/src/main/AndroidManifest.xml");
const xcodeProject = read("ios/App/App.xcodeproj/project.pbxproj");
const entitlements = read("ios/App/App/App.entitlements");
const privacyManifest = read("ios/App/App/PrivacyInfo.xcprivacy");
const androidConfig = readJson("android/app/src/main/assets/capacitor.config.json");
const iosConfig = readJson("ios/App/App/capacitor.config.json");

check(capacitorSource.includes(`appId: "${expectedBundleId}"`), "Capacitor appId is incorrect");
check(androidGradle.includes(`applicationId "${expectedBundleId}"`), "Android applicationId is incorrect");
check(xcodeProject.includes(`PRODUCT_BUNDLE_IDENTIFIER = ${expectedBundleId};`), "iOS bundle identifier is incorrect");
check(androidConfig.appId === expectedBundleId, "Synced Android appId is incorrect");
check(iosConfig.appId === expectedBundleId, "Synced iOS appId is incorrect");
check(!androidConfig.server?.url, "Android bundle still contains a development server URL");
check(!iosConfig.server?.url, "iOS bundle still contains a development server URL");
check(fs.existsSync(path.join(root, "mobile-dist/index.html")), "mobile-dist is missing; run pnpm mobile:sync");

check(androidManifest.includes('android:host="stringartdnipro.com"'), "Android App Link root domain is missing");
check(androidManifest.includes('android:host="www.stringartdnipro.com"'), "Android App Link www domain is missing");
check(entitlements.includes("applinks:stringartdnipro.com"), "iOS root associated domain is missing");
check(entitlements.includes("applinks:www.stringartdnipro.com"), "iOS www associated domain is missing");
check(xcodeProject.includes("CODE_SIGN_ENTITLEMENTS = App/App.entitlements;"), "iOS entitlements are not assigned to the target");
check(privacyManifest.includes("NSPrivacyTracking"), "iOS privacy manifest is incomplete");

const iosIcon = pngDimensions("ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png");
const androidIcon = pngDimensions("android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png");
check(iosIcon?.width === 1024 && iosIcon?.height === 1024, "iOS store icon must be 1024x1024");
check(androidIcon?.width === 192 && androidIcon?.height === 192, "Android xxxhdpi icon must be 192x192");

const androidVersion = androidGradle.match(/versionCode\s+(\d+)[\s\S]*?versionName\s+"([^"]+)"/);
const iosBuild = xcodeProject.match(/CURRENT_PROJECT_VERSION = (\d+);/);
const iosVersion = xcodeProject.match(/MARKETING_VERSION = ([^;]+);/);
check(Boolean(androidVersion), "Android versionCode/versionName is missing");
check(Boolean(iosBuild && iosVersion), "iOS build/version is missing");
check(Number(androidVersion?.[1]) > 0, "Android versionCode must be positive");
check(Number(iosBuild?.[1]) > 0, "iOS build number must be positive");

const keystoreFile = path.join(root, "android/keystore.properties");
const keyProperties = fs.existsSync(keystoreFile) ? parseProperties(fs.readFileSync(keystoreFile, "utf8")) : {};
const signing = {
  storeFile: process.env.ANDROID_KEYSTORE_FILE || keyProperties.storeFile,
  storePassword: process.env.ANDROID_KEYSTORE_PASSWORD || keyProperties.storePassword,
  keyAlias: process.env.ANDROID_KEY_ALIAS || keyProperties.keyAlias,
  keyPassword: process.env.ANDROID_KEY_PASSWORD || keyProperties.keyPassword,
};
const hasAndroidSigning = Object.values(signing).every(Boolean);

if (hasAndroidSigning) {
  const storePath = path.resolve(root, "android", signing.storeFile);
  check(fs.existsSync(storePath), `Android keystore does not exist: ${storePath}`);
}
if (requireAndroidSigning) {
  check(hasAndroidSigning, "Android release signing is not configured; see mobile/STORE_RELEASE.md");
} else {
  warn(hasAndroidSigning, "Android release signing is not configured yet");
}

warn(Boolean(process.env.APPLE_APP_ID || process.env.APPLE_TEAM_ID), "APPLE_APP_ID is not present in this shell; configure it in Vercel");
warn(Boolean(process.env.ANDROID_SHA256_CERT_FINGERPRINTS), "ANDROID_SHA256_CERT_FINGERPRINTS is not present in this shell; configure it in Vercel");
if (preparingIos) {
  warn(Boolean(process.env.APPLE_TEAM_ID), "Select your Apple Development Team in Xcode before archiving");
}

for (const message of warnings) console.warn(`WARN  ${message}`);
for (const message of errors) console.error(`ERROR ${message}`);

if (errors.length) {
  console.error(`\nMobile release check failed with ${errors.length} error(s).`);
  process.exit(1);
}

console.log("\nMobile release configuration is valid.");
console.log(`Android ${androidVersion?.[2]} (${androidVersion?.[1]})`);
console.log(`iOS ${iosVersion?.[1]} (${iosBuild?.[1]})`);
