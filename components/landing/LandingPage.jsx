"use client";

import ArrowLeftRight from "lucide-react/dist/esm/icons/arrow-left-right.mjs";
import ArrowRight from "lucide-react/dist/esm/icons/arrow-right.mjs";
import Camera from "lucide-react/dist/esm/icons/camera.mjs";
import Check from "lucide-react/dist/esm/icons/check.mjs";
import Clock3 from "lucide-react/dist/esm/icons/clock-3.mjs";
import Globe2 from "lucide-react/dist/esm/icons/globe-2.mjs";
import Hammer from "lucide-react/dist/esm/icons/hammer.mjs";
import Headphones from "lucide-react/dist/esm/icons/headphones.mjs";
import Menu from "lucide-react/dist/esm/icons/menu.mjs";
import Package from "lucide-react/dist/esm/icons/package.mjs";
import ShieldCheck from "lucide-react/dist/esm/icons/shield-check.mjs";
import ShoppingBag from "lucide-react/dist/esm/icons/shopping-bag.mjs";
import Star from "lucide-react/dist/esm/icons/star.mjs";
import UserRound from "lucide-react/dist/esm/icons/user-round.mjs";
import WandSparkles from "lucide-react/dist/esm/icons/wand-sparkles.mjs";
import X from "lucide-react/dist/esm/icons/x.mjs";
import { useState } from "react";
import LanguageSwitch from "../i18n/LanguageSwitch.jsx";
import { useLanguage } from "../i18n/LanguageProvider.jsx";

export default function LandingPage() {
  const { t } = useLanguage();
  const [comparisonPosition, setComparisonPosition] = useState(50);
  const [menuOpen, setMenuOpen] = useState(false);

  const featureCards = [
    { image: "/board.png", title: t("landing.featureMaterials"), copy: t("landing.featureMaterialsCopy") },
    { image: "/instruction.png", title: t("landing.featureGuide"), copy: t("landing.featureGuideCopy") },
    { image: "/owners.png", title: t("landing.featurePersonal"), copy: t("landing.featurePersonalCopy") },
    { image: "/support.png", title: t("landing.featureSupport"), copy: t("landing.featureSupportCopy") },
  ];

  const benefits = [
    { icon: WandSparkles, title: t("landing.freePattern"), copy: t("landing.freePatternCopy") },
    { icon: Clock3, title: t("landing.production"), copy: t("landing.productionCopy") },
    { icon: Globe2, title: t("landing.delivery"), copy: t("landing.deliveryCopy") },
    { icon: Headphones, title: t("landing.support"), copy: t("landing.supportCopy") },
  ];

  const steps = [
    { icon: Camera, title: t("landing.stepPhoto"), copy: t("landing.stepPhotoCopy"), image: "/family-source.jpg" },
    { icon: WandSparkles, title: t("landing.stepPattern"), copy: t("landing.stepPatternCopy"), image: "/family-string-art.jpg" },
    { icon: Package, title: t("landing.stepKit"), copy: t("landing.stepKitCopy"), image: "/owners.png" },
    { icon: Hammer, title: t("landing.stepBuild"), copy: t("landing.stepBuildCopy"), image: "/family-string-art.jpg" },
  ];

  return (
    <main className="landing-page">
      <header className="landing-header">
        <a className="landing-brand" href="/" aria-label="String Art Dnipro">
          <span className="brand-logo" aria-hidden="true"><img src="/logo-white.png" alt="" /></span>
          <span className="brand-name">String Art Dnipro</span>
        </a>
        <nav id="landing-navigation" className={menuOpen ? "is-open" : ""} aria-label={t("landing.navigation")}>
          <a href="#process" onClick={() => setMenuOpen(false)}>{t("landing.howItWorks")}</a>
          <a href="#gallery" onClick={() => setMenuOpen(false)}>{t("landing.gallery")}</a>
          <a href="#reviews" onClick={() => setMenuOpen(false)}>{t("landing.reviews")}</a>
          <a href="#kit" onClick={() => setMenuOpen(false)}>{t("landing.deliveryPayment")}</a>
          <a href="#faq" onClick={() => setMenuOpen(false)}>FAQ</a>
          <LanguageSwitch className="landing-menu-language" />
        </nav>
        <div className="landing-header-actions">
          <a className="landing-header-cta" href="/create">{t("landing.createPattern")}</a>
          <LanguageSwitch className="landing-header-language" />
          <a className="landing-icon-link" href="/account" aria-label={t("panel.account")}><UserRound size={18} /></a>
          <a className="landing-icon-link" href="/projects" aria-label={t("landing.projects")}><ShoppingBag size={18} /></a>
          <button
            className="landing-menu"
            type="button"
            aria-label={t("landing.navigation")}
            aria-controls="landing-navigation"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      <section className="landing-hero">
        <div className="landing-hero-copy">
          <p className="landing-eyebrow">String Art Dnipro</p>
          <h1>{t("landing.heroTitle")}</h1>
          <p>{t("landing.heroCopy")}</p>
          <ul>
            <li><Check size={16} />{t("landing.heroBenefitPattern")}</li>
            <li><Check size={16} />{t("landing.heroBenefitSpeed")}</li>
            <li><Check size={16} />{t("landing.heroBenefitDelivery")}</li>
          </ul>
          <div className="landing-hero-actions">
            <a className="landing-primary-cta" href="/create">{t("landing.createPattern")}<ArrowRight size={17} /></a>
            <a className="landing-secondary-cta" href="#process">{t("landing.howItWorks")}</a>
          </div>
        </div>
        <div className="landing-hero-visual" aria-label={t("landing.heroArtworkAlt")}>
          <div className="landing-artwork-shadow" aria-hidden="true" />
          <div className="landing-artwork-frame">
            <img src="/owners.png" alt={t("landing.heroArtworkAlt")} />
          </div>
        </div>
      </section>

      <section className="landing-benefits" aria-label={t("landing.keyFeatures")}>
        {benefits.map(({ icon: Icon, title, copy }) => (
          <div key={title}><span><Icon size={20} /></span><p><strong>{title}</strong>{copy}</p></div>
        ))}
      </section>

      <section className="landing-feature-gallery" aria-label={t("landing.keyFeatures")}>
        {featureCards.map((item, index) => (
          <article key={item.title}>
            <div className={`landing-feature-image feature-${index + 1}`}><img src={item.image} alt="" /></div>
            <h2>{item.title}</h2>
            <p>{item.copy}</p>
          </article>
        ))}
      </section>

      <section id="process" className="landing-section landing-process">
        <div className="landing-section-heading">
          <p>{t("landing.processEyebrow")}</p>
          <h2>{t("landing.processTitle")}</h2>
        </div>
        <ol>
          {steps.map(({ icon: Icon, title, copy, image }, index) => (
            <li key={title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <Icon aria-hidden="true" size={21} />
              <h3>{title}</h3>
              <p>{copy}</p>
              <img src={image} alt="" />
            </li>
          ))}
        </ol>
      </section>

      <section className="landing-generator-demo">
        <div className="landing-demo-heading">
          <p>{t("landing.generatorEyebrow")}</p>
          <h2>{t("landing.generatorTitle")}</h2>
          <p>{t("landing.generatorCopy")}</p>
        </div>
        <div className="landing-demo-shell">
          <div className="landing-demo-controls" aria-hidden="true">
            <p>{t("landing.demoSettings")}</p>
            <label>{t("landing.demoLines")}<strong>4 000</strong><span><i style={{ width: "76%" }} /></span></label>
            <label>{t("landing.demoPins")}<strong>240</strong><span><i style={{ width: "54%" }} /></span></label>
            <label>{t("landing.demoContrast")}<strong>75%</strong><span><i style={{ width: "68%" }} /></span></label>
            <a href="/create">{t("landing.createPattern")}</a>
          </div>
          <div
            className="landing-comparison"
            style={{ "--comparison-position": `${comparisonPosition}%` }}
            aria-label={t("landing.comparison")}
          >
            <span className="landing-comparison-source-mask">
              <img className="landing-comparison-source" src="/owners-original.png" alt={t("landing.sourceAlt")} />
            </span>
            <img className="landing-comparison-result" src="/owners.png" alt={t("landing.resultAlt")} />
            <span className="landing-comparison-label is-result">{t("landing.yourArtwork")}</span>
            <span className="landing-comparison-label is-source">{t("landing.yourPhoto")}</span>
            <span className="landing-comparison-divider" aria-hidden="true"><span><ArrowLeftRight size={18} /></span></span>
            <input type="range" min="0" max="100" value={comparisonPosition} onChange={(event) => setComparisonPosition(Number(event.target.value))} aria-label={t("landing.comparisonSlider")} />
          </div>
          <div className="landing-demo-result" aria-hidden="true">
            <p>{t("landing.demoResult")}</p>
            <dl><div><dt>{t("landing.demoTime")}</dt><dd>8–12 h</dd></div><div><dt>{t("landing.demoDifficulty")}</dt><dd>{t("landing.demoMedium")}</dd></div><div><dt>{t("landing.demoThread")}</dt><dd>≈ 1 200 m</dd></div></dl>
            <a href="/create">{t("landing.continue")}</a>
          </div>
        </div>
      </section>

      <section id="kit" className="landing-section landing-product-grid">
        <article className="landing-kit-panel">
          <div className="landing-panel-copy">
            <p className="landing-eyebrow">{t("landing.kitEyebrow")}</p>
            <h2>{t("landing.kitTitle")}</h2>
            <ul>
              <li><Check size={16} />{t("landing.kitBoard")}</li>
              <li><Check size={16} />{t("landing.kitMaterials")}</li>
              <li><Check size={16} />{t("landing.kitGuide")}</li>
              <li><Check size={16} />{t("landing.kitPackaging")}</li>
            </ul>
          </div>
          <div className="landing-kit-visual" aria-hidden="true">
            <img src="/owners.png" alt="" />
            <span className="landing-thread-spool" />
            <span className="landing-guide-book"><img src="/logo-white.png" alt="" /></span>
          </div>
        </article>
        <article className="landing-build-panel">
          <div className="landing-build-preview"><img src="/family-string-art.jpg" alt="" /></div>
          <div className="landing-build-copy">
            <p>{t("landing.buildMode")}</p>
            <span>{t("landing.buildStep")} 1247 / 4000</span>
            <strong>48 <ArrowRight size={22} /> 173</strong>
            <div><button type="button">{t("landing.back")}</button><button type="button">{t("landing.nextStep")}</button></div>
          </div>
        </article>
      </section>

      <section id="reviews" className="landing-social-proof">
        <div><p>{t("landing.happyCustomers")}</p><strong>4.9</strong><span aria-label="5 stars">{[1, 2, 3, 4, 5].map((item) => <Star key={item} size={17} fill="currentColor" />)}</span></div>
        <div id="gallery" className="landing-artwork-row">
          <img src="/family-string-art.jpg" alt={t("landing.galleryArtworkAlt")} />
          <img src="/owners.png" alt={t("landing.galleryArtworkAlt")} />
          <img src="/family-string-art.jpg" alt={t("landing.galleryArtworkAlt")} />
          <img src="/owners.png" alt={t("landing.galleryArtworkAlt")} />
        </div>
      </section>

      <section id="faq" className="landing-final-cta">
        <ShieldCheck size={28} />
        <h2>{t("landing.finalTitle")}</h2>
        <p>{t("landing.finalCopy")}</p>
        <a className="landing-primary-cta" href="/create">{t("landing.openGenerator")}<ArrowRight size={18} /></a>
      </section>

      <footer className="landing-footer">
        <a className="landing-brand" href="/"><span className="brand-logo" aria-hidden="true"><img src="/logo-white.png" alt="" /></span><span>String Art Dnipro</span></a>
        <div><a href="#process">{t("landing.howItWorks")}</a><a href="/projects">{t("landing.projects")}</a><a href="/account">{t("panel.account")}</a></div>
      </footer>
    </main>
  );
}
