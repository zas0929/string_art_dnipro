"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "../../lib/supabase/config.js";
import { createClient } from "../../lib/supabase/server.js";

export async function signIn(_state, formData) {
  if (!isSupabaseConfigured()) return configurationError();

  const email = normalizeEmail(formData.get("email"));
  const password = String(formData.get("password") || "");
  if (!email || !password) return { error: "missingCredentials" };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "invalidCredentials" };
  redirect("/projects");
}

export async function signUp(_state, formData) {
  if (!isSupabaseConfigured()) return configurationError();

  const email = normalizeEmail(formData.get("email"));
  const password = String(formData.get("password") || "");
  if (!email || !password) return { error: "missingCredentials" };
  if (password.length < 8) return { error: "passwordTooShort" };

  const headerStore = await headers();
  const origin = headerStore.get("origin") || "http://localhost:3000";
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${origin}/auth/confirm` },
  });
  if (error) return { error: "signupFailed" };
  if (data.session) redirect("/projects");
  return { success: "checkEmail" };
}

export async function signOut() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/");
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function configurationError() {
  return { error: "notConfigured" };
}
