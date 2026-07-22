"use client";

import { FileImage, FileText, ListChecks, RotateCcw } from "lucide-react";
import Link from "next/link";

export default function StringArtPanel() {
  return (
    <aside className="panel">
      <div className="control-group">
        <h2>Параметры</h2>
        <label>
          Точек
          <input id="pointsInput" type="number" min="60" max="600" step="10" defaultValue="240" />
        </label>
        <label>
          Линий
          <input id="linesInput" type="number" min="100" max="8000" step="100" defaultValue="4500" />
        </label>
        <label>
          Размер картины, см
          <input id="sizeInput" type="number" min="10" max="200" step="1" defaultValue="47" />
        </label>
        <label>
          Толщина нити, мм
          <select id="threadInput" defaultValue="0.19">
            <option value="0.11">0.11 - тонкая</option>
            <option value="0.16">0.16 - средняя</option>
            <option value="0.19">0.19 - обычная</option>
          </select>
        </label>
        <label>
          Сила линии
          <input id="opacityInput" type="range" min="4" max="36" step="1" defaultValue="12" />
        </label>
        <label>
          Минимальный пропуск точек
          <input id="skipInput" type="number" min="2" max="80" step="1" defaultValue="15" />
        </label>
        <label>
          Режим
          <select id="algorithmInput" defaultValue="portrait-v5">
            <option value="portrait-v4">Портрет v4 · оптическая модель</option>
            <option value="portrait-v5">Портрет v5 · мульти-масштаб</option>
          </select>
        </label>
        <label>
          Зум фото
          <input id="zoomInput" type="range" min="1" max="4" step="0.01" defaultValue="1" />
        </label>
        <button id="resetCropButton" type="button">
          <RotateCcw aria-hidden="true" size={18} strokeWidth={2} />
          Сбросить кадр
        </button>
      </div>

      <div className="actions">
        <button id="pngButton" type="button" disabled>
          <FileImage aria-hidden="true" size={17} strokeWidth={2} />
          PNG
        </button>
        <button id="txtButton" type="button" disabled>
          <FileText aria-hidden="true" size={17} strokeWidth={2} />
          TXT
        </button>
      </div>

      <Link
        id="buildModeLink"
        className="command-link is-disabled"
        href="/build"
        aria-disabled="true"
        tabIndex={-1}
      >
        <ListChecks aria-hidden="true" size={18} strokeWidth={2} />
        Режим сборки
      </Link>

      <div className="summary">
        <h2>Инструкция</h2>
        <dl>
          <div><dt>Точек</dt><dd id="pointsOut">-</dd></div>
          <div><dt>Линий</dt><dd id="linesOut">-</dd></div>
          <div><dt>Шаг</dt><dd id="stepOut">-</dd></div>
          <div><dt>Длина нити</dt><dd id="lengthOut">-</dd></div>
        </dl>
        <textarea
          id="sequenceOutput"
          readOnly
          spellCheck="false"
          placeholder="Здесь появится последовательность точек."
          aria-label="Последовательность соединения точек"
        />
      </div>
    </aside>
  );
}
