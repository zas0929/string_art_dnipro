export const MOBILE_BUNDLE_ID = "com.stringartdnipro.app";

export function parseAndroidFingerprints(value = "") {
  return String(value)
    .split(",")
    .map((fingerprint) => fingerprint.trim().toUpperCase())
    .filter(Boolean);
}

export function createAppleAssociation(appId) {
  return {
    applinks: {
      apps: [],
      details: [
        {
          appID: appId,
          components: [{ "/": "/s/*", comment: "Shared String Art build patterns" }],
        },
      ],
    },
  };
}

export function createAndroidAssociation(fingerprints) {
  return [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: MOBILE_BUNDLE_ID,
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ];
}
