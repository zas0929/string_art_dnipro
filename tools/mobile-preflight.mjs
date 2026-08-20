import { execFileSync } from "node:child_process";

const platform = process.argv[2];

function fail(message) {
  console.error(`\nMobile preflight failed:\n${message}\n`);
  process.exit(1);
}

if (platform === "ios") {
  if (process.platform !== "darwin") {
    fail("iOS builds require macOS and Xcode.");
  }

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
