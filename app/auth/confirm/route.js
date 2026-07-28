import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "../../../lib/supabase/config.js";
import { createClient } from "../../../lib/supabase/server.js";

export async function GET(request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const code = url.searchParams.get("code");
  const next = getSafeNext(url.searchParams.get("next"));

  if (isSupabaseConfigured() && ((tokenHash && type) || code)) {
    const supabase = await createClient();
    const { error } = code
      ? await supabase.auth.exchangeCodeForSession(code)
      : await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }

  return NextResponse.redirect(new URL("/login?confirmation=failed", url.origin));
}

function getSafeNext(value) {
  return value === "/reset-password" ? value : "/projects";
}
