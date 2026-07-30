import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

test("service worker leaves build voice files to native Range handling", async () => {
  const source = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
  const listeners = new Map();
  const self = {
    location: { origin: "https://string-art.test" },
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    clients: { claim() {} },
    skipWaiting() {},
  };

  vm.runInNewContext(source, { caches: {}, self, URL });

  let intercepted = false;
  listeners.get("fetch")({
    request: new Request("https://string-art.test/audio/build/uk/50.m4a", {
      headers: { Range: "bytes=0-4095" },
    }),
    respondWith() {
      intercepted = true;
    },
  });

  assert.equal(intercepted, false);
});
