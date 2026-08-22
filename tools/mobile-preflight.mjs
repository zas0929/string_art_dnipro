import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const platform = process.argv[2];

function fail(message) {
  console.error(`\nMobile preflight failed:\n${message}\n`);
  process.exit(1);
}

function canRun(command, args = ["--version"]) {
  try {
    execFileSync(command, args, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function findAndroidSdk() {
  const candidates = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    process.platform === "darwin" ? path.join(os.homedir(), "Library/Android/sdk") : null,
    process.platform === "win32" && process.env.LOCALAPPDATA
      ? path.join(process.env.LOCALAPPDATA, "Android/Sdk")
      : null,
    process.platform === "linux" ? path.join(os.homedir(), "Android/Sdk") : null,
  ].filter(Boolean);

  return candidates.find((candidate) => fs.existsSync(candidate));
}

if (platform === "android") {
  const sdk = findAndroidSdk();
  if (!sdk) {
    fail(
      "Android SDK was not found. Install Android Studio, open SDK Manager, " +
        "install Android SDK Platform and Platform-Tools, then set ANDROID_HOME. " +
        "On macOS the usual value is `$HOME/Library/Android/sdk`.",
    );
  }

  const adbName = process.platform === "win32" ? "adb.exe" : "adb";
  if (!fs.existsSync(path.join(sdk, "platform-tools", adbName))) {
    fail(
      `Android SDK was found at ${sdk}, but Platform-Tools are missing. ` +
        "Install Android SDK Platform-Tools from Android Studio > SDK Manager.",
    );
  }

  if (!canRun("java")) {
    fail(
      "Java is unavailable. Configure Android Studio's bundled JDK or set JAVA_HOME " +
        "before running the Android build.",
    );
  }
}

if (platform === "ios" || platform === "ios-device" || platform === "ios-release") {
  if (process.platform !== "darwin") {
    fail("iOS builds require macOS and Xcode.");
  }

  let developerDirectory = "";
  try {
    developerDirectory = execFileSync("xcode-select", ["-p"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch {
    // The message below also covers a missing xcode-select installation.
  }

  if (!developerDirectory || developerDirectory.includes("CommandLineTools")) {
    fail(
      "Full Xcode is not selected. Install Xcode from the App Store, open it once, " +
        "then run `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer` " +
        "and `sudo xcodebuild -runFirstLaunch`.",
    );
  }

  if (platform === "ios-device" || platform === "ios-release") process.exit(0);

  let output;
  try {
    output = execFileSync("xcrun", ["simctl", "list", "runtimes", "--json"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    fail(
      "Xcode command-line tools are unavailable. Open Xcode once and run " +
        "`sudo xcodebuild -runFirstLaunch`.",
    );
  }

  const { runtimes = [] } = JSON.parse(output);
  const hasIosRuntime = runtimes.some(
    (runtime) =>
      runtime.identifier?.includes("SimRuntime.iOS") &&
      runtime.isAvailable !== false,
  );

  if (!hasIosRuntime) {
    fail(
      "No iOS Simulator runtime is installed. Open Xcode > Settings > " +
        "Components and install the latest iOS Simulator, or run " +
        "`xcodebuild -downloadPlatform iOS`.",
    );
  }
}

if (!new Set(["android", "ios", "ios-device", "ios-release"]).has(platform)) {
  fail("Choose a supported platform: android, ios, ios-device, or ios-release.");
}
