"use client";

import ArrowLeft from "lucide-react/dist/esm/icons/arrow-left.mjs";
import LogIn from "lucide-react/dist/esm/icons/log-in.mjs";
import Mail from "lucide-react/dist/esm/icons/mail.mjs";
import UserPlus from "lucide-react/dist/esm/icons/user-plus.mjs";
import { useActionState, useState } from "react";
import {
  requestPasswordReset,
  signIn,
  signUp,
} from "../../app/login/actions.js";
import { createClient } from "../../lib/supabase/client.js";
import { useLanguage } from "../i18n/LanguageProvider.jsx";

const INITIAL_STATE = { error: "", success: "" };

export default function AuthForm({ configured, initialError = "" }) {
  const { t } = useLanguage();
  const [mode, setMode] = useState("signin");
  const [oauthPending, setOauthPending] = useState(false);
  const [oauthError, setOauthError] = useState(initialError);
  const [signInState, signInAction, signInPending] = useActionState(signIn, INITIAL_STATE);
  const [signUpState, signUpAction, signUpPending] = useActionState(signUp, INITIAL_STATE);
  const [resetState, resetAction, resetPending] = useActionState(
    requestPasswordReset,
    INITIAL_STATE,
  );
  const state = mode === "signin"
    ? signInState
    : mode === "signup"
      ? signUpState
      : resetState;
  const pending = signInPending || signUpPending || resetPending || oauthPending;
  const action = mode === "signin"
    ? signInAction
    : mode === "signup"
      ? signUpAction
      : resetAction;
  const title = mode === "signin"
    ? t("auth.signInTitle")
    : mode === "signup"
      ? t("auth.signUpTitle")
      : t("auth.forgotPasswordTitle");

  async function continueWithGoogle() {
    if (!configured || pending) return;
    setOauthError("");
    setOauthPending(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/confirm`,
          queryParams: {
            prompt: "select_account",
          },
        },
      });
      if (error) {
        console.error("Supabase Google OAuth failed", {
          code: error.code,
          status: error.status,
          message: error.message,
        });
        setOauthError("googleSignInFailed");
        setOauthPending(false);
      }
    } catch (error) {
      console.error("Could not start Google OAuth", error);
      setOauthError("googleSignInFailed");
      setOauthPending(false);
    }
  }

  return (
    <section className="auth-shell">
      <a className="back-link" href="/create">
        <ArrowLeft aria-hidden="true" size={18} />
        {t("common.generator")}
      </a>
      <div className="auth-heading">
        <p>String Art Generator</p>
        <h1>{title}</h1>
        <span>{mode === "forgot" ? t("auth.forgotPasswordSubtitle") : t("auth.subtitle")}</span>
      </div>

      {mode !== "forgot" && (
        <div className="auth-tabs" role="tablist" aria-label={t("auth.accountAccess")}>
          <button type="button" role="tab" aria-selected={mode === "signin"} onClick={() => setMode("signin")}>
            {t("auth.signIn")}
          </button>
          <button type="button" role="tab" aria-selected={mode === "signup"} onClick={() => setMode("signup")}>
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
            {oauthPending ? t("auth.googleWorking") : t("auth.continueWithGoogle")}
          </button>
          <div className="auth-divider" aria-hidden="true">
            <span>{t("auth.or")}</span>
          </div>
        </>
      )}

      <form className="auth-form" action={action}>
        <label>
          {t("auth.email")}
          <input name="email" type="email" autoComplete="email" required disabled={!configured || pending} />
        </label>
        {mode !== "forgot" && (
          <label>
            {t("auth.password")}
            <input
              name="password"
              type="password"
              minLength={mode === "signup" ? 8 : undefined}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              required
              disabled={!configured || pending}
            />
          </label>
        )}
        <button className="auth-submit" type="submit" disabled={!configured || pending}>
          {mode === "signin" && <LogIn aria-hidden="true" size={18} />}
          {mode === "signup" && <UserPlus aria-hidden="true" size={18} />}
          {mode === "forgot" && <Mail aria-hidden="true" size={18} />}
          {pending
            ? t("auth.working")
            : t(`auth.${mode === "signin" ? "signIn" : mode === "signup" ? "signUp" : "sendResetLink"}`)}
        </button>
      </form>

      {mode === "signin" && (
        <button className="auth-text-button" type="button" onClick={() => setMode("forgot")}>
          {t("auth.forgotPassword")}
        </button>
      )}
      {mode === "forgot" && (
        <button className="auth-text-button" type="button" onClick={() => setMode("signin")}>
          {t("auth.backToSignIn")}
        </button>
      )}
      {!configured && <p className="auth-message is-warning">{t("auth.notConfigured")}</p>}
      {(oauthError || state.error) && (
        <p className="auth-message is-error" role="alert">
          {t(`auth.${oauthError || state.error}`)}
        </p>
      )}
      {state.success && <p className="auth-message is-success" role="status">{t(`auth.${state.success}`)}</p>}
    </section>
  );
}
