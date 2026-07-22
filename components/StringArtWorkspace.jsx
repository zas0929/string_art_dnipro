"use client";

import { ImagePlus, Upload } from "lucide-react";

export default function StringArtWorkspace() {
  return (
    <section className="workspace">
      <div className="topbar">
        <div>
          <h1>String Art Generator</h1>
          <p>Фото или готовая схема в макет натяжения нити между пронумерованными точками.</p>
        </div>
        <div className="topbar-actions">
          <label className="file-button">
            <Upload aria-hidden="true" size={18} strokeWidth={2} />
            <input id="schemeInput" type="file" accept=".txt,.csv,text/plain,text/csv" />
            Загрузить схему
          </label>
          <label className="file-button">
            <ImagePlus aria-hidden="true" size={18} strokeWidth={2} />
            <input id="imageInput" type="file" accept="image/*" />
            Загрузить фото
          </label>
        </div>
      </div>

      <div className="stage">
        <canvas id="resultCanvas" width="760" height="760" aria-label="Макет картины из нитей" />
        <canvas id="sourceCanvas" width="760" height="760" aria-label="Исходное фото и выбранный кадр" />
      </div>

      <div className="status-row" aria-live="polite">
        <span id="status">Загрузите фото для расчёта или готовую схему для просмотра.</span>
        <progress id="progress" value="0" max="1" aria-label="Прогресс построения" />
      </div>
    </section>
  );
}
