import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const androidPath = path.join(root, "android/app/build.gradle");
const iosPath = path.join(root, "ios/App/App.xcodeproj/project.pbxproj");

function fail(message) {
  console.error(`ERROR ${message}`);
  process.exit(1);
}

function readVersions() {
  const androidSource = fs.readFileSync(androidPath, "utf8");
  const iosSource = fs.readFileSync(iosPath, "utf8");
  const android = androidSource.match(/versionCode\s+(\d+)[\s\S]*?versionName\s+"([^"]+)"/);
  const iosBuilds = [...iosSource.matchAll(/CURRENT_PROJECT_VERSION = (\d+);/g)];
  const iosVersions = [...iosSource.matchAll(/MARKETING_VERSION = ([^;]+);/g)];

  if (!android || !iosBuilds.length || !iosVersions.length) {
    fail("Could not read native application versions");
  }

  const iosBuildValues = new Set(iosBuilds.map((match) => match[1]));
  const iosVersionValues = new Set(iosVersions.map((match) => match[1].trim()));
  if (iosBuildValues.size !== 1 || iosVersionValues.size !== 1) {
    fail("The iOS target contains inconsistent build or marketing versions");
  }

  return {
    androidSource,
    iosSource,
    androidBuild: Number(android[1]),
    androidVersion: android[2],
    iosBuild: Number(iosBuilds[0][1]),
    iosVersion: iosVersions[0][1].trim(),
  };
}

function validateVersion(version) {
  if (!/^\d+\.\d+(?:\.\d+)?$/.test(version)) {
    fail(`Invalid public version "${version}". Use a value such as 1.1 or 1.1.0`);
  }
}

function validateBuild(build) {
  if (!Number.isSafeInteger(build) || build < 1) {
    fail("Build number must be a positive integer");
  }
}

function writeVersions(current, version, build) {
  validateVersion(version);
  validateBuild(build);

  const androidSource = current.androidSource
    .replace(/versionCode\s+\d+/, `versionCode ${build}`)
    .replace(/versionName\s+"[^"]+"/, `versionName "${version}"`);
  const iosSource = current.iosSource
    .replace(/CURRENT_PROJECT_VERSION = \d+;/g, `CURRENT_PROJECT_VERSION = ${build};`)
    .replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${version};`);

  fs.writeFileSync(androidPath, androidSource);
  fs.writeFileSync(iosPath, iosSource);
  console.log(`Mobile version updated to ${version} (${build}) on Android and iOS.`);
}

function printVersions(versions) {
  console.log(`Android ${versions.androidVersion} (${versions.androidBuild})`);
  console.log(`iOS     ${versions.iosVersion} (${versions.iosBuild})`);
  if (
    versions.androidVersion !== versions.iosVersion
    || versions.androidBuild !== versions.iosBuild
  ) {
    console.log("Status  native versions are not synchronized");
    process.exitCode = 1;
  } else {
    console.log("Status  synchronized");
  }
}

const [command = "show", value] = process.argv.slice(2);
const current = readVersions();

switch (command) {
  case "show":
    printVersions(current);
    break;
  case "build": {
    const nextBuild = value === undefined
      ? Math.max(current.androidBuild, current.iosBuild) + 1
      : Number(value);
    writeVersions(current, current.androidVersion, nextBuild);
    break;
  }
  case "version":
    if (!value) fail("Provide a public version, for example: pnpm mobile:version:set 1.1.0");
    writeVersions(current, value, Math.max(current.androidBuild, current.iosBuild) + 1);
    break;
  default:
    fail(`Unknown command "${command}". Use show, build, or version`);
}
