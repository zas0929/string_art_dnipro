"use client";

import ImagePlus from "lucide-react/dist/esm/icons/image-plus.mjs";
import Play from "lucide-react/dist/esm/icons/play.mjs";
import RotateCcw from "lucide-react/dist/esm/icons/rotate-ccw.mjs";
import Sparkles from "lucide-react/dist/esm/icons/sparkles.mjs";
import Upload from "lucide-react/dist/esm/icons/upload.mjs";

export default function StringArtWorkspace() {
  return (
    <section className="workspace">
      <div className="topbar">
        <div>
          <h1>String Art Generator</h1>
          <p>Создать картину в стиле String Art по фото</p>
        </div>
        <div className="topbar-actions">
          <label className="file-button">
            <Upload aria-hidden="true" size={18} strokeWidth={2} />
            <input id="schemeInput" type="file" accept=".txt,.csv,text/plain,text/csv" disabled />
            Загрузить схему
          </label>
          <label className="file-button">
            <ImagePlus aria-hidden="true" size={18} strokeWidth={2} />
            <input id="imageInput" type="file" accept="image/*" disabled />
            Загрузить фото
          </label>
          <button id="buildButton" type="button" disabled>
            <Play aria-hidden="true" size={18} fill="currentColor" strokeWidth={2} />
            Построить
          </button>
        </div>
      </div>

      <div className="stage">
        <div className="canvas-column">
          <canvas id="resultCanvas" width="760" height="760" aria-label="Макет картины из нитей" />
          <button
            id="improveButton"
            className="improve-button canvas-action"
            type="button"
            title="Экспериментально улучшить слабые участки"
            disabled
          >
            <Sparkles aria-hidden="true" size={18} strokeWidth={2} />
            <span id="improveButtonLabel">Улучшить участки</span>
          </button>
        </div>
        <div className="canvas-column">
          <canvas id="sourceCanvas" width="760" height="760" aria-label="Исходное фото и выбранный кадр" />
          <div className="crop-controls">
            <div className="crop-control-heading">
              <label htmlFor="zoomInput">Масштаб фото</label>
              <output id="zoomValue" htmlFor="zoomInput">100%</output>
            </div>
            <div className="crop-control-row">
              <input
                id="zoomInput"
                type="range"
                min="1"
                max="4"
                step="0.01"
                defaultValue="1"
                aria-label="Масштаб фото"
                disabled
              />
              <button
                id="resetCropButton"
                className="crop-reset-button"
                type="button"
                title="Сбросить кадр"
                disabled
              >
                <RotateCcw aria-hidden="true" size={17} strokeWidth={2} />
                Сбросить
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="status-row" aria-live="polite">
        <span id="status">Загрузите фото чтоб посмотреть как будет выглядеть макет</span>
        <progress id="progress" value="0" max="1" aria-label="Прогресс построения" />
      </div>
    </section>
  );
}
