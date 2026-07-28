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
  if (error) {
    console.error("Supabase signup failed", {
      code: error.code,
      status: error.status,
      message: error.message,
    });
    return { error: getSignUpErrorKey(error) };
  }
  if (data.session) redirect("/projects");
  return { success: "checkEmail" };
}

export async function requestPasswordReset(_state, formData) {
  if (!isSupabaseConfigured()) return configurationError();

  const email = normalizeEmail(formData.get("email"));
  if (!email) return { error: "invalidEmail" };

  const headerStore = await headers();
  const origin = headerStore.get("origin") || "http://localhost:3000";
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/confirm?next=/reset-password`,
  });
  if (error) {
    console.error("Supabase password reset request failed", {
      code: error.code,
      status: error.status,
      message: error.message,
    });
    return {
      error: error.code === "over_email_send_rate_limit"
        ? "emailRateLimit"
        : "passwordResetFailed",
    };
  }
  return { success: "resetEmailSent" };
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

function getSignUpErrorKey(error) {
  switch (error?.code) {
    case "email_address_invalid":
    case "validation_failed":
      return "invalidEmail";
    case "email_exists":
    case "user_already_exists":
      return "emailAlreadyRegistered";
    case "email_provider_disabled":
    case "signup_disabled":
      return "signupDisabled";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "emailRateLimit";
    case "weak_password":
      return "weakPassword";
    case "unexpected_failure":
      return "signupDatabaseError";
    default:
      return "signupFailed";
  }
}
