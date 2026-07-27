"use client";

import ImagePlus from "lucide-react/dist/esm/icons/image-plus.mjs";
import Minus from "lucide-react/dist/esm/icons/minus.mjs";
import Play from "lucide-react/dist/esm/icons/play.mjs";
import Plus from "lucide-react/dist/esm/icons/plus.mjs";
import RotateCcw from "lucide-react/dist/esm/icons/rotate-ccw.mjs";
import Upload from "lucide-react/dist/esm/icons/upload.mjs";
import { useLanguage } from "./i18n/LanguageProvider.jsx";

export default function StringArtWorkspace() {
  const { t } = useLanguage();

  return (
    <section className="workspace">
      <div className="topbar">
        <div>
          <h1>String Art Generator</h1>
          <p>{t("generator.subtitle")}</p>
        </div>
        <div className="topbar-actions">
          <label className="file-button photo-upload">
            <ImagePlus aria-hidden="true" size={18} strokeWidth={2} />
            <input id="imageInput" type="file" accept="image/*" disabled />
            {t("generator.uploadPhoto")}
          </label>
          <label className="file-button scheme-upload">
            <Upload aria-hidden="true" size={18} strokeWidth={2} />
            <input id="schemeInput" type="file" accept=".txt,.csv,text/plain,text/csv" disabled />
            {t("generator.uploadPattern")}
          </label>
          <button id="buildButton" type="button" disabled>
            <Play aria-hidden="true" size={18} fill="currentColor" strokeWidth={2} />
            {t("generator.generate")}
          </button>
        </div>
      </div>

      <div className="stage">
        <div className="canvas-column source-column">
          <canvas id="sourceCanvas" width="760" height="760" aria-label={t("generator.sourceCanvas")} />
          <div className="crop-controls">
            <div className="crop-control-heading">
              <label htmlFor="zoomInput">{t("generator.photoZoom")}</label>
              <output id="zoomValue" htmlFor="zoomInput">100%</output>
            </div>
            <div className="crop-control-row">
              <button
                id="zoomOutButton"
                className="zoom-step-button"
                type="button"
                title={t("generator.zoomOut")}
                aria-label={t("generator.zoomOut")}
                disabled
              >
                <Minus aria-hidden="true" size={17} strokeWidth={2.2} />
              </button>
              <input
                id="zoomInput"
                type="range"
                min="1"
                max="4"
                step="0.01"
                defaultValue="1"
                aria-label={t("generator.photoZoom")}
                disabled
              />
              <button
                id="zoomInButton"
                className="zoom-step-button"
                type="button"
                title={t("generator.zoomIn")}
                aria-label={t("generator.zoomIn")}
                disabled
              >
                <Plus aria-hidden="true" size={17} strokeWidth={2.2} />
              </button>
              <button
                id="resetCropButton"
                className="crop-reset-button"
                type="button"
                title={t("generator.resetCrop")}
                disabled
              >
                <RotateCcw aria-hidden="true" size={17} strokeWidth={2} />
                {t("generator.reset")}
              </button>
            </div>
          </div>
          <div className="enhancement-controls" aria-label={t("generator.photoEnhancements")}>
            <div className="enhancement-control">
              <div className="enhancement-control-heading">
                <label htmlFor="sharpnessInput">{t("generator.sharpness")}</label>
                <output id="sharpnessValue" htmlFor="sharpnessInput">0%</output>
              </div>
              <input
                id="sharpnessInput"
                type="range"
                min="0"
                max="100"
                step="5"
                defaultValue="0"
                disabled
              />
            </div>
            <div className="enhancement-control">
              <div className="enhancement-control-heading">
                <label htmlFor="clarityInput">{t("generator.clarity")}</label>
                <output id="clarityValue" htmlFor="clarityInput">0%</output>
              </div>
              <input
                id="clarityInput"
                type="range"
                min="0"
                max="100"
                step="5"
                defaultValue="0"
                disabled
              />
            </div>
          </div>
          <button id="mobileBuildButton" className="mobile-build-button" type="button" disabled>
            <Play aria-hidden="true" size={18} fill="currentColor" strokeWidth={2} />
            {t("generator.generateArtwork")}
          </button>
        </div>
        <div className="canvas-column result-column">
          <canvas id="resultCanvas" width="760" height="760" aria-label={t("generator.resultCanvas")} />
          <div id="resultVariants" className="result-variants" aria-label={t("generator.lineVariants")} hidden>
            {[3500, 4000, 4500, 5000].map((lineCount) => (
              <button
                key={lineCount}
                className="result-variant"
                type="button"
                data-lines={lineCount}
                aria-label={t("generator.showVariant", { count: lineCount })}
                aria-pressed="false"
              >
                <canvas
                  id={`resultVariant${lineCount}`}
                  width="220"
                  height="220"
                  aria-hidden="true"
                />
                <span>{t("generator.variant", { count: lineCount })}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="status-row" aria-live="polite">
        <span id="status">{t("generator.uploadPrompt")}</span>
        <progress id="progress" value="0" max="1" aria-label={t("generator.generationProgress")} />
      </div>
    </section>
  );
}
