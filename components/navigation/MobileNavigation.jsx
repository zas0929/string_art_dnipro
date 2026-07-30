"use client";

import FolderOpen from "lucide-react/dist/esm/icons/folder-open.mjs";
import Home from "lucide-react/dist/esm/icons/house.mjs";
import ListChecks from "lucide-react/dist/esm/icons/list-checks.mjs";
import LogIn from "lucide-react/dist/esm/icons/log-in.mjs";
import LogOut from "lucide-react/dist/esm/icons/log-out.mjs";
import Menu from "lucide-react/dist/esm/icons/menu.mjs";
import UserRound from "lucide-react/dist/esm/icons/user-round.mjs";
import WandSparkles from "lucide-react/dist/esm/icons/wand-sparkles.mjs";
import X from "lucide-react/dist/esm/icons/x.mjs";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut } from "../../app/login/actions.js";
import { useAuthSession } from "../auth/AuthSessionProvider.jsx";
import LanguageSwitch from "../i18n/LanguageSwitch.jsx";
import { useLanguage } from "../i18n/LanguageProvider.jsx";

export default function MobileNavigation() {
  const pathname = usePathname();
  const { user } = useAuthSession();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  if (pathname?.startsWith("/print")) return null;

  const links = [
    { href: "/", label: t("common.home"), icon: Home },
    { href: "/create", label: t("common.generator"), icon: WandSparkles },
    { href: "/projects", label: t("landing.projects"), icon: FolderOpen },
    { href: "/build", label: t("landing.buildMode"), icon: ListChecks },
  ];

  return (
    <header className="mobile-site-header">
      <a className="mobile-site-brand" href="/" aria-label="String Art Dnipro">
        <img src="/logo-white-compact.png" alt="" />
        <span>String Art Dnipro</span>
      </a>
      <div className="mobile-site-actions">
        <button
          className="mobile-site-menu-toggle"
          type="button"
          aria-label={open ? t("common.closeMenu") : t("common.openMenu")}
          aria-controls="mobile-site-menu"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X aria-hidden="true" size={23} /> : <Menu aria-hidden="true" size={23} />}
        </button>
      </div>
      <div id="mobile-site-menu" className={`mobile-site-menu${open ? " is-open" : ""}`}>
        <nav aria-label={t("landing.navigation")}>
          {links.map(({ href, label, icon: Icon }) => (
            <a key={href} href={href} className={pathname === href ? "is-active" : ""}>
              <Icon aria-hidden="true" size={19} />
              {label}
            </a>
          ))}
        </nav>
        <div className="mobile-site-menu-footer">
          <LanguageSwitch />
          {user ? (
            <div className="mobile-user-session">
              <span title={user.email}><UserRound aria-hidden="true" size={18} />{user.email}</span>
              <form action={signOut}>
                <button type="submit"><LogOut aria-hidden="true" size={18} />{t("auth.signOut")}</button>
              </form>
            </div>
          ) : (
            <a className="mobile-login-link" href="/login">
              <LogIn aria-hidden="true" size={18} />
              {t("auth.signInOrCreate")}
            </a>
          )}
        </div>
      </div>
    </header>
  );
}
