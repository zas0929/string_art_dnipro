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
import { useLanguage } from "../i18n/LanguageProvider.jsx";

const INITIAL_STATE = { error: "", success: "" };

export default function AuthForm({ configured }) {
  const { t } = useLanguage();
  const [mode, setMode] = useState("signin");
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
  const pending = signInPending || signUpPending || resetPending;
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
      {state.error && <p className="auth-message is-error" role="alert">{t(`auth.${state.error}`)}</p>}
      {state.success && <p className="auth-message is-success" role="status">{t(`auth.${state.success}`)}</p>}
    </section>
  );
}
