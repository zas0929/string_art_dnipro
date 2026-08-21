import assert from "node:assert/strict";
import test from "node:test";

import {
  createAndroidAssociation,
  createAppleAssociation,
  MOBILE_BUNDLE_ID,
  parseAndroidFingerprints,
} from "../core/store-association.js";

test("creates an Apple association for shared build links", () => {
  const association = createAppleAssociation(`TEAM123.${MOBILE_BUNDLE_ID}`);

  assert.equal(association.applinks.details[0].appID, `TEAM123.${MOBILE_BUNDLE_ID}`);
  assert.equal(association.applinks.details[0].components[0]["/"], "/s/*");
});

test("normalizes Android certificate fingerprints", () => {
  const fingerprints = parseAndroidFingerprints("aa:bb, CC:DD, ");
  const association = createAndroidAssociation(fingerprints);

  assert.deepEqual(fingerprints, ["AA:BB", "CC:DD"]);
  assert.equal(association[0].target.package_name, MOBILE_BUNDLE_ID);
  assert.deepEqual(association[0].target.sha256_cert_fingerprints, fingerprints);
});
