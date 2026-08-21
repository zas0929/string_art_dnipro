import {
  createAndroidAssociation,
  parseAndroidFingerprints,
} from "../../../core/store-association.js";

export const dynamic = "force-dynamic";

export function GET() {
  const fingerprints = parseAndroidFingerprints(
    process.env.ANDROID_SHA256_CERT_FINGERPRINTS,
  );

  return Response.json(createAndroidAssociation(fingerprints), {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
