"use client";

import ArrowLeft from "lucide-react/dist/esm/icons/arrow-left.mjs";
import LogIn from "lucide-react/dist/esm/icons/log-in.mjs";
import UserPlus from "lucide-react/dist/esm/icons/user-plus.mjs";
import { useActionState, useState } from "react";
import { signIn, signUp } from "../../app/login/actions.js";
import { useLanguage } from "../i18n/LanguageProvider.jsx";

const INITIAL_STATE = { error: "", success: "" };

export default function AuthForm({ configured }) {
  const { t } = useLanguage();
  const [mode, setMode] = useState("signin");
  const [signInState, signInAction, signInPending] = useActionState(signIn, INITIAL_STATE);
  const [signUpState, signUpAction, signUpPending] = useActionState(signUp, INITIAL_STATE);
  const state = mode === "signin" ? signInState : signUpState;
  const pending = signInPending || signUpPending;

  return (
    <section className="auth-shell">
      <a className="back-link" href="/create">
        <ArrowLeft aria-hidden="true" size={18} />
        {t("common.generator")}
      </a>
      <div className="auth-heading">
        <p>String Art Generator</p>
        <h1>{mode === "signin" ? t("auth.signInTitle") : t("auth.signUpTitle")}</h1>
        <span>{t("auth.subtitle")}</span>
      </div>

      <div className="auth-tabs" role="tablist" aria-label={t("auth.accountAccess")}>
        <button type="button" role="tab" aria-selected={mode === "signin"} onClick={() => setMode("signin")}>
          {t("auth.signIn")}
        </button>
        <button type="button" role="tab" aria-selected={mode === "signup"} onClick={() => setMode("signup")}>
          {t("auth.signUp")}
        </button>
      </div>

      <form className="auth-form" action={mode === "signin" ? signInAction : signUpAction}>
        <label>
          {t("auth.email")}
          <input name="email" type="email" autoComplete="email" required disabled={!configured || pending} />
        </label>
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
        <button className="auth-submit" type="submit" disabled={!configured || pending}>
          {mode === "signin" ? <LogIn aria-hidden="true" size={18} /> : <UserPlus aria-hidden="true" size={18} />}
          {pending ? t("auth.working") : t(`auth.${mode === "signin" ? "signIn" : "signUp"}`)}
        </button>
      </form>

      {!configured && <p className="auth-message is-warning">{t("auth.notConfigured")}</p>}
      {state.error && <p className="auth-message is-error" role="alert">{t(`auth.${state.error}`)}</p>}
      {state.success && <p className="auth-message is-success" role="status">{t(`auth.${state.success}`)}</p>}
    </section>
  );
}
