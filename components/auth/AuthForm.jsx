"use client";

import ArrowLeft from "lucide-react/dist/esm/icons/arrow-left.mjs";
import LogIn from "lucide-react/dist/esm/icons/log-in.mjs";
import Mail from "lucide-react/dist/esm/icons/mail.mjs";
import UserPlus from "lucide-react/dist/esm/icons/user-plus.mjs";
import Script from "next/script";
import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import {
  requestPasswordReset,
  signIn,
  signUp,
} from "../../app/login/actions.js";
import { createClient } from "../../lib/supabase/client.js";
import { useLanguage } from "../i18n/LanguageProvider.jsx";

const INITIAL_STATE = { error: "", success: "" };
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

export default function AuthForm({ configured, initialError = "" }) {
  const { t } = useLanguage();
  const [mode, setMode] = useState("signin");
  const [googleReady, setGoogleReady] = useState(false);
  const [oauthPending, setOauthPending] = useState(false);
  const [oauthError, setOauthError] = useState(initialError);
  const googleButtonRef = useRef(null);
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

  const completeGoogleSignIn = useCallback(async (response) => {
    if (!configured || !response?.credential) return;
    setOauthError("");
    setOauthPending(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithIdToken({
        provider: "google",
        token: response.credential,
      });
      if (error) throw error;
      window.location.assign("/projects");
    } catch (error) {
      console.error("Supabase Google ID-token sign-in failed", {
        code: error?.code,
        status: error?.status,
        message: error?.message,
      });
      setOauthError("googleSignInFailed");
      setOauthPending(false);
    }
  }, [configured]);

  useEffect(() => {
    const buttonHost = googleButtonRef.current;
    const googleIdentity = window.google?.accounts?.id;
    if (!GOOGLE_CLIENT_ID || !googleReady || !buttonHost || !googleIdentity) return undefined;

    googleIdentity.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: completeGoogleSignIn,
      auto_select: false,
      use_fedcm_for_prompt: true,
    });

    const renderButton = () => {
      const width = Math.max(240, Math.min(400, Math.floor(buttonHost.clientWidth)));
      buttonHost.replaceChildren();
      googleIdentity.renderButton(buttonHost, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: "continue_with",
        shape: "rectangular",
        logo_alignment: "left",
        width,
      });
    };

    renderButton();
    const resizeObserver = new ResizeObserver(renderButton);
    resizeObserver.observe(buttonHost);
    return () => resizeObserver.disconnect();
  }, [completeGoogleSignIn, googleReady]);

  async function continueWithGoogleOAuth() {
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
      {GOOGLE_CLIENT_ID && (
        <Script
          src="https://accounts.google.com/gsi/client"
          strategy="afterInteractive"
          onReady={() => setGoogleReady(true)}
        />
      )}
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
          {GOOGLE_CLIENT_ID ? (
            <div
              className={`auth-google-button-host${pending ? " is-disabled" : ""}`}
              aria-busy={oauthPending}
              aria-disabled={!configured || pending}
            >
              <div ref={googleButtonRef} />
            </div>
          ) : (
            <button
              className="auth-google-button"
              type="button"
              disabled={!configured || pending}
              onClick={continueWithGoogleOAuth}
            >
              <span className="auth-google-mark" aria-hidden="true">G</span>
              {oauthPending ? t("auth.googleWorking") : t("auth.continueWithGoogle")}
            </button>
          )}
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
