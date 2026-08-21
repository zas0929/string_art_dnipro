import { createAppleAssociation, MOBILE_BUNDLE_ID } from "../../../core/store-association.js";

export const dynamic = "force-dynamic";

export function GET() {
  const appId = process.env.APPLE_APP_ID || `${process.env.APPLE_TEAM_ID || "UNCONFIGURED"}.${MOBILE_BUNDLE_ID}`;

  return Response.json(createAppleAssociation(appId), {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
