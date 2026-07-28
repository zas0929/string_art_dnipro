"use client";

import ArrowRight from "lucide-react/dist/esm/icons/arrow-right.mjs";
import Camera from "lucide-react/dist/esm/icons/camera.mjs";
import Check from "lucide-react/dist/esm/icons/check.mjs";
import Hammer from "lucide-react/dist/esm/icons/hammer.mjs";
import Package from "lucide-react/dist/esm/icons/package.mjs";
import Upload from "lucide-react/dist/esm/icons/upload.mjs";
import Volume2 from "lucide-react/dist/esm/icons/volume-2.mjs";
import LanguageSwitch from "../i18n/LanguageSwitch.jsx";
import { useLanguage } from "../i18n/LanguageProvider.jsx";

export default function LandingPage() {
  const { t } = useLanguage();

  return (
    <main className="landing-page">
      <LanguageSwitch className="landing-language" />
      <header className="landing-header">
        <a className="landing-brand" href="/" aria-label="String Art Dnipro">
          <span aria-hidden="true">SA</span>
          String Art Dnipro
        </a>
        <nav aria-label={t("landing.navigation")}>
          <a href="#process">{t("landing.howItWorks")}</a>
          <a href="#kit">{t("landing.kit")}</a>
          <a href="/create">{t("landing.generator")}</a>
        </nav>
        <div className="landing-header-actions">
          <a href="/projects">{t("landing.projects")}</a>
          <a className="landing-header-cta" href="/create">{t("landing.create")}</a>
        </div>
      </header>

      <section className="landing-hero">
        <div className="landing-hero-content">
          <p className="landing-eyebrow">{t("landing.eyebrow")}</p>
          <h1>String Art Dnipro</h1>
          <p>{t("landing.heroCopy")}</p>
          <div className="landing-hero-actions">
            <a className="landing-primary-cta" href="/create">
              {t("landing.createPattern")}
              <ArrowRight aria-hidden="true" size={19} />
            </a>
            <a className="landing-secondary-cta" href="#kit">{t("landing.exploreKit")}</a>
          </div>
        </div>
      </section>

      <section className="landing-proof" aria-label={t("landing.keyFeatures")}>
        <div><strong>240</strong><span>{t("landing.pins")}</span></div>
        <div><strong>4 000+</strong><span>{t("landing.connections")}</span></div>
        <div><Volume2 aria-hidden="true" size={22} /><span>{t("landing.voiceMode")}</span></div>
        <div><Check aria-hidden="true" size={22} /><span>{t("landing.progressSaved")}</span></div>
      </section>

      <section id="process" className="landing-section landing-process">
        <div className="landing-section-heading">
          <p>{t("landing.processEyebrow")}</p>
          <h2>{t("landing.processTitle")}</h2>
        </div>
        <ol>
          <li><span>01</span><Camera aria-hidden="true" size={24} /><h3>{t("landing.stepPhoto")}</h3><p>{t("landing.stepPhotoCopy")}</p></li>
          <li><span>02</span><Upload aria-hidden="true" size={24} /><h3>{t("landing.stepPattern")}</h3><p>{t("landing.stepPatternCopy")}</p></li>
          <li><span>03</span><Package aria-hidden="true" size={24} /><h3>{t("landing.stepKit")}</h3><p>{t("landing.stepKitCopy")}</p></li>
          <li><span>04</span><Hammer aria-hidden="true" size={24} /><h3>{t("landing.stepBuild")}</h3><p>{t("landing.stepBuildCopy")}</p></li>
        </ol>
      </section>

      <section id="kit" className="landing-section landing-product">
        <div className="landing-product-copy">
          <p className="landing-eyebrow">{t("landing.kitEyebrow")}</p>
          <h2>{t("landing.kitTitle")}</h2>
          <p>{t("landing.kitCopy")}</p>
          <ul>
            <li><Check aria-hidden="true" size={18} />{t("landing.kitBoard")}</li>
            <li><Check aria-hidden="true" size={18} />{t("landing.kitMaterials")}</li>
            <li><Check aria-hidden="true" size={18} />{t("landing.kitGuide")}</li>
          </ul>
          <a className="landing-primary-cta" href="/create">
            {t("landing.tryPhoto")}
            <ArrowRight aria-hidden="true" size={19} />
          </a>
        </div>
        <div className="landing-comparison" aria-label={t("landing.comparison")}>
          <figure>
            <img src="/family-source.jpg" alt={t("landing.sourceAlt")} />
            <figcaption>{t("landing.yourPhoto")}</figcaption>
          </figure>
          <figure>
            <img src="/family-string-art.jpg" alt={t("landing.resultAlt")} />
            <figcaption>{t("landing.yourArtwork")}</figcaption>
          </figure>
        </div>
      </section>

      <section className="landing-final-cta">
        <h2>{t("landing.finalTitle")}</h2>
        <p>{t("landing.finalCopy")}</p>
        <a className="landing-primary-cta" href="/create">
          {t("landing.openGenerator")}
          <ArrowRight aria-hidden="true" size={19} />
        </a>
      </section>

      <footer className="landing-footer">
        <span>String Art Dnipro</span>
        <div><a href="/projects">{t("landing.projects")}</a><a href="/account">{t("panel.account")}</a></div>
      </footer>
    </main>
  );
}
