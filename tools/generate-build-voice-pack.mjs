import { execFile } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { MAX_POINT_COUNT } from "../core/limits.js";

const run = promisify(execFile);
const projectRoot = path.resolve(import.meta.dirname, "..");
const outputRoot = path.join(projectRoot, "public", "audio", "build");
const concurrency = 6;
const voices = [
  { language: "uk", name: "Lesya" },
  { language: "en", name: "Samantha" },
];

await Promise.all(voices.map(({ language }) => (
  mkdir(path.join(outputRoot, language), { recursive: true })
)));

const jobs = voices.flatMap((voice) => (
  Array.from({ length: MAX_POINT_COUNT }, (_, index) => ({
    ...voice,
    point: index + 1,
  }))
));

let cursor = 0;
let completed = 0;

await Promise.all(Array.from({ length: concurrency }, async () => {
  while (cursor < jobs.length) {
    const job = jobs[cursor];
    cursor += 1;
    await generatePoint(job);
    completed += 1;
    if (completed % 100 === 0 || completed === jobs.length) {
      process.stdout.write(`Generated ${completed}/${jobs.length}\n`);
    }
  }
}));

async function generatePoint({ language, name, point }) {
  const stem = `string-art-${language}-${point}-${process.pid}`;
  const sourcePath = path.join(os.tmpdir(), `${stem}.aiff`);
  const outputPath = path.join(outputRoot, language, `${point}.m4a`);

  try {
    await run("say", [
      "-v",
      name,
      "-r",
      "190",
      "-o",
      sourcePath,
      String(point),
    ]);
    await run("afconvert", [
      "-f",
      "m4af",
      "-d",
      "aac",
      "-b",
      "48000",
      sourcePath,
      outputPath,
    ]);
  } finally {
    await rm(sourcePath, { force: true });
  }
}
