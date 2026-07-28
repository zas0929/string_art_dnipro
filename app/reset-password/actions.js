"use server";

import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "../../lib/supabase/config.js";
import { createClient } from "../../lib/supabase/server.js";

export async function updatePassword(_state, formData) {
  if (!isSupabaseConfigured()) return { error: "notConfigured" };

  const password = String(formData.get("password") || "");
  const confirmation = String(formData.get("passwordConfirmation") || "");
  if (!password || !confirmation) return { error: "missingPassword" };
  if (password.length < 8) return { error: "passwordTooShort" };
  if (password !== confirmation) return { error: "passwordsDoNotMatch" };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    console.error("Supabase password update failed", {
      code: error.code,
      status: error.status,
      message: error.message,
    });
    return {
      error: error.code === "weak_password"
        ? "weakPassword"
        : "resetSessionExpired",
    };
  }
  redirect("/projects");
}
