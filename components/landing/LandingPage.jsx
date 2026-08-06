"use client";

import ArrowLeftRight from "lucide-react/dist/esm/icons/arrow-left-right.mjs";
import ArrowRight from "lucide-react/dist/esm/icons/arrow-right.mjs";
import Camera from "lucide-react/dist/esm/icons/camera.mjs";
import Check from "lucide-react/dist/esm/icons/check.mjs";
import Hammer from "lucide-react/dist/esm/icons/hammer.mjs";
import MessageCircle from "lucide-react/dist/esm/icons/message-circle.mjs";
import Menu from "lucide-react/dist/esm/icons/menu.mjs";
import Package from "lucide-react/dist/esm/icons/package.mjs";
import ShieldCheck from "lucide-react/dist/esm/icons/shield-check.mjs";
import WandSparkles from "lucide-react/dist/esm/icons/wand-sparkles.mjs";
import X from "lucide-react/dist/esm/icons/x.mjs";
import { useState } from "react";
import { useAuthSession } from "../auth/AuthSessionProvider.jsx";
import LanguageSwitch from "../i18n/LanguageSwitch.jsx";
import { useLanguage } from "../i18n/LanguageProvider.jsx";
import AccountMenu from "../navigation/AccountMenu.jsx";
import OrderModal from "../order/OrderModal.jsx";

export default function LandingPage() {
  const { t } = useLanguage();
  const { user } = useAuthSession();
  const [comparisonPosition, setComparisonPosition] = useState(50);
  const [menuOpen, setMenuOpen] = useState(false);
  const [orderOpen, setOrderOpen] = useState(false);

  const featureCards = [
    {
      images: ["/circle.jpeg", "/square.jpeg"],
      imageClass: "is-foundation-pair",
      title: t("landing.featureMaterials"),
      copy: t("landing.featureMaterialsCopy"),
    },
    {
      image: "/instruction.png",
      overlayImage: "/app-build-mode-2.jpeg",
      imageClass: "has-app-overlay",
      title: t("landing.featureGuide"),
      copy: t("landing.featureGuideCopy"),
    },
    { image: "/owners.png", title: t("landing.featurePersonal"), copy: t("landing.featurePersonalCopy") },
    { image: "/support.png", title: t("landing.featureSupport"), copy: t("landing.featureSupportCopy") },
  ];

  const steps = [
    { icon: Camera, title: t("landing.stepPhoto"), copy: t("landing.stepPhotoCopy") },
    {
      icon: MessageCircle,
      title: t("landing.stepInstagram"),
      copy: t("landing.stepInstagramCopy"),
      href: "https://www.instagram.com/string_art_dnipro/",
    },
    { icon: WandSparkles, title: t("landing.stepPattern"), copy: t("landing.stepPatternCopy") },
    { icon: Package, title: t("landing.stepKit"), copy: t("landing.stepKitCopy") },
    { icon: Hammer, title: t("landing.stepBuild"), copy: t("landing.stepBuildCopy") },
  ];

  const faqItems = [
    { question: t("landing.faqPhotoQuestion"), answer: t("landing.faqPhotoAnswer") },
    { question: t("landing.faqKitQuestion"), answer: t("landing.faqKitAnswer") },
    { question: t("landing.faqTimingQuestion"), answer: t("landing.faqTimingAnswer") },
    { question: t("landing.faqExperienceQuestion"), answer: t("landing.faqExperienceAnswer") },
    { question: t("landing.faqGeneratorQuestion"), answer: t("landing.faqGeneratorAnswer") },
  ];

  return (
    <main className="landing-page">
      <header className="landing-header">
        <a className="landing-brand" href="/" aria-label="String Art Dnipro">
          <span className="brand-logo" aria-hidden="true"><img src="/logo-white.png" alt="" /></span>
          <span className="brand-name">String Art Dnipro</span>
        </a>
        <nav id="landing-navigation" className={menuOpen ? "is-open" : ""} aria-label={t("landing.navigation")}>
          <a className="landing-desktop-generator-link" href="/create">{t("common.generator")}</a>
          <a href="#process" onClick={() => setMenuOpen(false)}>{t("landing.howItWorks")}</a>
          <a href="#kit" onClick={() => setMenuOpen(false)}>{t("landing.deliveryPayment")}</a>
          <a href="#faq" onClick={() => setMenuOpen(false)}>FAQ</a>
          <LanguageSwitch className="landing-menu-language" />
        </nav>
        <div className="landing-header-actions">
          <button className="landing-header-cta" type="button" onClick={() => setOrderOpen(true)}>
            {t("order.cta")}
          </button>
          <AccountMenu className="landing-account-menu" tone="light" />
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
            <li><Check size={16} />{t("landing.heroBenefitGenerator")}</li>
            <li><Check size={16} />{t("landing.heroBenefitPhotoHelp")}</li>
            <li><Check size={16} />{t("landing.heroBenefitShipping")}</li>
          </ul>
          <div className="landing-hero-actions">
            <button className="landing-primary-cta" type="button" onClick={() => setOrderOpen(true)}>
              {t("order.cta")}<ArrowRight size={17} />
            </button>
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

      <section id="process" className="landing-section landing-process landing-process-primary">
        <div className="landing-section-heading">
          <p>{t("landing.processEyebrow")}</p>
          <h2>{t("landing.processTitle")}</h2>
        </div>
        <ol>
          {steps.map(({ icon: Icon, title, copy, href }) => (
            <li key={title}>
              <div className="landing-process-step-head">
                <span className="landing-process-icon"><Icon aria-hidden="true" size={23} /></span>
              </div>
              <h3>{title}</h3>
              <p>{copy}</p>
              {href ? (
                <a className="landing-instagram-link" href={href} target="_blank" rel="noreferrer">
                  @string_art_dnipro <ArrowRight aria-hidden="true" size={15} />
                </a>
              ) : null}
            </li>
          ))}
        </ol>
      </section>

      <section className="landing-feature-gallery" aria-label={t("landing.keyFeatures")}>
        {featureCards.map((item, index) => (
          <article key={item.title}>
            <div className={`landing-feature-image feature-${index + 1} ${item.imageClass || ""}`}>
              {item.images
                ? item.images.map((image) => <img key={image} src={image} alt={item.title} loading="lazy" />)
                : <img src={item.image} alt={item.title} loading="lazy" />}
              {item.overlayImage ? (
                <span className="landing-feature-phone" aria-hidden="true">
                  <img src={item.overlayImage} alt="" />
                </span>
              ) : null}
            </div>
            <h2>{item.title}</h2>
            <p>{item.copy}</p>
          </article>
        ))}
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
            <div className="landing-kit-prices" aria-label={t("landing.kitPrices")}>
              <p><span>{t("landing.kitRound")}</span><strong>{t("landing.kitRoundPrice")}</strong></p>
              <p><span>{t("landing.kitSquare")}</span><strong>{t("landing.kitSquarePrice")}</strong></p>
            </div>
          </div>
          <div className="landing-kit-visual">
            <img src="/kit.png" alt={t("landing.kitTitle")} loading="lazy" />
          </div>
        </article>
        <article className="landing-build-panel">
          <div className="landing-panel-copy landing-build-info">
            <p className="landing-eyebrow">{t("landing.buildEyebrow")}</p>
            <h2>{t("landing.buildTitle")}</h2>
            <ul>
              <li><Check size={16} />{t("landing.buildVoice")}</li>
              <li><Check size={16} />{t("landing.buildSync")}</li>
              <li><Check size={16} />{t("landing.buildRecovery")}</li>
              <li><Check size={16} />{t("landing.buildControls")}</li>
            </ul>
          </div>
          <div className="landing-build-visual">
            <img src="/build-mode-preview-v2.png" alt={t("landing.buildTitle")} loading="lazy" />
          </div>
        </article>
      </section>

      <section className="landing-generator-demo">
        <div className="landing-demo-heading">
          <p>{t("landing.generatorEyebrow")}</p>
          <h2>{t("landing.generatorTitle")}</h2>
          <p>{t("landing.generatorCopy")}</p>
        </div>
        <div className="landing-demo-shell">
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
        </div>
      </section>

      <section className="landing-photo-guide">
        <div className="landing-photo-guide-heading">
          <p className="landing-eyebrow">{t("landing.photoGuideEyebrow")}</p>
          <h2>{t("landing.photoGuideTitle")}</h2>
        </div>
        <div className="landing-photo-guide-content">
          <div className="landing-photo-guide-copy">
            <div className="landing-photo-guide-list is-good">
              <h3><Check aria-hidden="true" size={19} />{t("landing.photoGuideGood")}</h3>
              <ul>
                <li>{t("landing.photoGuideGoodContrast")}</li>
                <li>{t("landing.photoGuideGoodFaces")}</li>
                <li>{t("landing.photoGuideGoodDetails")}</li>
              </ul>
            </div>
            <div className="landing-photo-guide-list is-bad">
              <h3><X aria-hidden="true" size={19} />{t("landing.photoGuideBad")}</h3>
              <ul>
                <li>{t("landing.photoGuideBadDistance")}</li>
                <li>{t("landing.photoGuideBadGroup")}</li>
                <li>{t("landing.photoGuideBadQuality")}</li>
              </ul>
            </div>
          </div>
          <div className="landing-photo-guide-visual" aria-label={t("landing.photoGuideExamples")}>
            <span className="photo-guide-example is-good is-top" aria-hidden="true">
              <span className="photo-guide-example-circle" />
            </span>
            <span className="photo-guide-example is-bad is-top" aria-hidden="true">
              <span className="photo-guide-example-circle" />
            </span>
            <span className="photo-guide-example is-good is-bottom" aria-hidden="true">
              <span className="photo-guide-example-circle" />
            </span>
            <span className="photo-guide-example is-bad is-bottom" aria-hidden="true">
              <span className="photo-guide-example-circle" />
            </span>
            <span className="photo-guide-mark is-good is-top"><Check aria-hidden="true" size={22} /></span>
            <span className="photo-guide-mark is-bad is-top"><X aria-hidden="true" size={22} /></span>
            <span className="photo-guide-mark is-good is-bottom"><Check aria-hidden="true" size={22} /></span>
            <span className="photo-guide-mark is-bad is-bottom"><X aria-hidden="true" size={22} /></span>
          </div>
        </div>
      </section>

      <section className="landing-final-cta">
        <ShieldCheck size={28} />
        <h2>{t("landing.finalTitle")}</h2>
        <p>{t("landing.finalCopy")}</p>
        <div className="landing-final-actions">
          <button className="landing-primary-cta" type="button" onClick={() => setOrderOpen(true)}>
            {t("order.cta")}<ArrowRight size={18} />
          </button>
          <a className="landing-secondary-cta" href="/create">
            {t("landing.generator")}<ArrowRight size={18} />
          </a>
        </div>
      </section>

      <section id="faq" className="landing-section landing-faq">
        <div className="landing-section-heading">
          <p>{t("landing.faqEyebrow")}</p>
          <h2>{t("landing.faqTitle")}</h2>
        </div>
        <div className="landing-faq-list">
          {faqItems.map(({ question, answer }) => (
            <details key={question}>
              <summary>{question}</summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </section>

      <footer className="landing-footer">
        <a className="landing-brand" href="/"><span className="brand-logo" aria-hidden="true"><img src="/logo-white.png" alt="" /></span><span>String Art Dnipro</span></a>
        <div>
          <a href="#process">{t("landing.howItWorks")}</a>
          <a href="/projects">{t("landing.projects")}</a>
          <a href={user ? "/projects" : "/login"}>{user ? t("common.signedIn") : t("auth.signIn")}</a>
        </div>
      </footer>
      <OrderModal open={orderOpen} onClose={() => setOrderOpen(false)} />
    </main>
  );
}
