"use client";

import { Browser } from "@capacitor/browser";
import ArrowLeft from "lucide-react/dist/esm/icons/arrow-left.mjs";
import LogIn from "lucide-react/dist/esm/icons/log-in.mjs";
import Mail from "lucide-react/dist/esm/icons/mail.mjs";
import UserPlus from "lucide-react/dist/esm/icons/user-plus.mjs";
import { useEffect, useState } from "react";
import { NATIVE_AUTH_CALLBACK_URL } from "../../core/native-auth.js";
import { createClient } from "../../lib/supabase/client.js";
import { isSupabaseConfigured } from "../../lib/supabase/config.js";
import { SITE_URL } from "../../lib/site.js";
import { useLanguage } from "../i18n/LanguageProvider.jsx";
import { useAuthSession } from "./AuthSessionProvider.jsx";
import PasswordField from "./PasswordField.jsx";

export default function MobileAuthForm() {
  const { t } = useLanguage();
  const { user, loading: sessionLoading } = useAuthSession();
  const [mode, setMode] = useState("signin");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(() => (
    new URLSearchParams(window.location.search).get("confirmation") === "failed"
      ? "authCallbackFailed"
      : ""
  ));
  const [success, setSuccess] = useState("");
  const configured = isSupabaseConfigured();

  useEffect(() => {
    if (user && !sessionLoading) window.location.assign("/projects");
  }, [sessionLoading, user]);

  const title = mode === "signin"
    ? t("auth.signInTitle")
    : mode === "signup"
      ? t("auth.signUpTitle")
      : t("auth.forgotPasswordTitle");

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setError("");
    setSuccess("");
  };

  const submitCredentials = async (event) => {
    event.preventDefault();
    if (!configured || pending) return;

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const password = String(formData.get("password") || "");
    setError("");
    setSuccess("");
    setPending(true);

    try {
      const supabase = createClient();
      if (mode === "forgot") {
        if (!email) throw authError("invalidEmail");
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${SITE_URL}/auth/confirm?next=/reset-password`,
        });
        if (resetError) throw authError(mapResetError(resetError));
        setSuccess("resetEmailSent");
        return;
      }

      if (!email || !password) throw authError("missingCredentials");
      if (mode === "signup" && password.length < 8) {
        throw authError("passwordTooShort");
      }

      if (mode === "signin") {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw authError("invalidCredentials");
        window.location.assign("/projects");
        return;
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${SITE_URL}/auth/confirm` },
      });
      if (signUpError) throw authError(mapSignUpError(signUpError));
      if (data.session) {
        window.location.assign("/projects");
        return;
      }
      setSuccess("checkEmail");
    } catch (submitError) {
      setError(submitError?.translationKey || "signupFailed");
    } finally {
      setPending(false);
    }
  };

  const continueWithGoogle = async () => {
    if (!configured || pending) return;
    setError("");
    setSuccess("");
    setPending(true);

    try {
      const { data, error: oauthError } = await createClient().auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: NATIVE_AUTH_CALLBACK_URL,
          skipBrowserRedirect: true,
          queryParams: { prompt: "select_account" },
        },
      });
      if (oauthError || !data?.url) throw oauthError || new Error("Missing OAuth URL");
      await Browser.open({ url: data.url });
    } catch (oauthError) {
      console.error("Could not start native Google OAuth", oauthError);
      setError("googleSignInFailed");
      setPending(false);
    }
  };

  return (
    <main className="auth-page native-auth-page">
      <section className="auth-shell">
        <a className="back-link" href="/create">
          <ArrowLeft aria-hidden="true" size={18} />
          {t("common.generator")}
        </a>
        <div className="auth-heading">
          <p>String Art Dnipro</p>
          <h1>{title}</h1>
          <span>{mode === "forgot" ? t("auth.forgotPasswordSubtitle") : t("auth.subtitle")}</span>
        </div>

        {mode !== "forgot" && (
          <div className="auth-tabs" role="tablist" aria-label={t("auth.accountAccess")}>
            <button type="button" role="tab" aria-selected={mode === "signin"} onClick={() => switchMode("signin")}>
              {t("auth.signIn")}
            </button>
            <button type="button" role="tab" aria-selected={mode === "signup"} onClick={() => switchMode("signup")}>
              {t("auth.signUp")}
            </button>
          </div>
        )}

        {mode !== "forgot" && (
          <>
            <button
              className="auth-google-button"
              type="button"
              disabled={!configured || pending}
              onClick={continueWithGoogle}
            >
              <span className="auth-google-mark" aria-hidden="true">G</span>
              {pending ? t("auth.googleWorking") : t("auth.continueWithGoogle")}
            </button>
            <div className="auth-divider" aria-hidden="true"><span>{t("auth.or")}</span></div>
          </>
        )}

        <form className="auth-form" onSubmit={submitCredentials}>
          <label>
            {t("auth.email")}
            <input name="email" type="email" autoComplete="email" required disabled={!configured || pending} />
          </label>
          {mode !== "forgot" && (
            <PasswordField
              label={t("auth.password")}
              showLabel={t("auth.showPassword")}
              hideLabel={t("auth.hidePassword")}
              id="nativeAuthPassword"
              name="password"
              minLength={mode === "signup" ? 8 : undefined}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              required
              disabled={!configured || pending}
            />
          )}
          <button className="auth-submit" type="submit" disabled={!configured || pending || sessionLoading}>
            {mode === "signin" && <LogIn aria-hidden="true" size={18} />}
            {mode === "signup" && <UserPlus aria-hidden="true" size={18} />}
            {mode === "forgot" && <Mail aria-hidden="true" size={18} />}
            {pending
              ? t("auth.working")
              : t(`auth.${mode === "signin" ? "signIn" : mode === "signup" ? "signUp" : "sendResetLink"}`)}
          </button>
        </form>

        {mode === "signin" && (
          <button className="auth-text-button" type="button" onClick={() => switchMode("forgot")}>
            {t("auth.forgotPassword")}
          </button>
        )}
        {mode === "forgot" && (
          <button className="auth-text-button" type="button" onClick={() => switchMode("signin")}>
            {t("auth.backToSignIn")}
          </button>
        )}
        {!configured && <p className="auth-message is-warning">{t("auth.notConfigured")}</p>}
        {error && <p className="auth-message is-error" role="alert">{t(`auth.${error}`)}</p>}
        {success && <p className="auth-message is-success" role="status">{t(`auth.${success}`)}</p>}
      </section>
    </main>
  );
}

function authError(translationKey) {
  const error = new Error(translationKey);
  error.translationKey = translationKey;
  return error;
}

function mapResetError(error) {
  return error?.code === "over_email_send_rate_limit" ? "emailRateLimit" : "passwordResetFailed";
}

function mapSignUpError(error) {
  switch (error?.code) {
    case "email_address_invalid":
    case "validation_failed":
      return "invalidEmail";
    case "email_exists":
    case "user_already_exists":
      return "emailAlreadyRegistered";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "emailRateLimit";
    case "weak_password":
      return "weakPassword";
    default:
      return "signupFailed";
  }
}
