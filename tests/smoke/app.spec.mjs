import { expect, test } from "@playwright/test";
import path from "node:path";

const scheme = [
  "Points______Lines/n1____0/",
  "50____  1",
  "25____  2",
  "43____  3",
].join("\n");

test("generator and build mode share working navigation", async ({ page }) => {
  await page.goto("/");
  await waitForGenerator(page);

  await expect(page.getByRole("heading", { name: "String Art Generator" })).toBeVisible();
  await expect(page.getByLabel("Минимальный пропуск точек")).toHaveValue("15");

  const buildModeLink = page.getByRole("link", { name: "Режим сборки" });
  await expect(buildModeLink).toBeVisible();
  await buildModeLink.click();

  await expect(page).toHaveURL(/\/build$/);
  await expect(page.getByRole("heading", { name: "Режим сборки" })).toBeVisible();
  await expect(page.getByText("Нет активной схемы")).toBeVisible();
  await page.getByRole("link", { name: "Генератор" }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("the single reference core generates a route from a photo", async ({ page }, testInfo) => {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.addInitScript(() => {
    const originalClearRect = CanvasRenderingContext2D.prototype.clearRect;
    window.__resultCanvasClearCount = 0;
    CanvasRenderingContext2D.prototype.clearRect = function (...args) {
      if (this.canvas?.id === "resultCanvas") {
        window.__resultCanvasClearCount += 1;
      }
      return originalClearRect.apply(this, args);
    };
  });
  await page.goto("/");
  await waitForGenerator(page);
  if (testInfo.project.name === "mobile-chrome") {
    await expect.poll(() => canvasTop(page, "#sourceCanvas")).toBeLessThan(
      await canvasTop(page, "#resultCanvas"),
    );
  }

  await page.locator("#linesInput").fill("100");
  await page.locator("#imageInput").setInputFiles(path.resolve("test-photo.png"));
  await page.getByRole("button", { name: "Увеличить масштаб" }).click();
  await expect(page.locator("#zoomValue")).toHaveText("105%");
  await page.getByRole("button", { name: "Увеличить масштаб" }).click();
  await page.getByRole("button", { name: "Уменьшить масштаб" }).click();
  await expect(page.locator("#zoomValue")).toHaveText("105%");
  if (testInfo.project.name === "mobile-chrome") {
    await pinchOut(page, "#sourceCanvas");
    await expect.poll(async () => {
      const value = await page.locator("#zoomValue").textContent();
      return Number.parseInt(value, 10);
    }).toBeGreaterThan(105);
  }

  const sourceBox = await page.locator("#sourceCanvas").boundingBox();
  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(sourceBox.x + sourceBox.width / 2 + 24, sourceBox.y + sourceBox.height / 2 + 18);
  await page.mouse.up();

  const buildButtonName = testInfo.project.name === "mobile-chrome"
    ? "Построить макет"
    : "Построить";
  const buildButton = page.getByRole("button", { name: buildButtonName });
  await expect(buildButton).toBeEnabled();
  await page.evaluate(() => {
    window.__resultCanvasClearCount = 0;
  });
  await buildButton.click();

  await expect(page.locator("#status")).toHaveText(
    "Готово. Инструкция построена.",
    { timeout: 30_000 },
  );
  await expect(page.locator("#sequenceOutput")).toHaveValue(/^1 -> 50 ->/);
  await expect.poll(
    () => page.evaluate(() => window.__resultCanvasClearCount),
  ).toBe(1);
  await expect.poll(() => readLatestPattern(page)).toMatchObject({
    algorithm: "reference-v7",
    pointCount: 240,
    lineCount: 100,
  });
  if (testInfo.project.name === "mobile-chrome") {
    await expect.poll(() => resultIsNearViewportTop(page)).toBe(true);
  }
  expect(pageErrors).toEqual([]);
});

test("TXT import reaches build mode and restores saved progress", async ({ page }) => {
  await page.goto("/");
  await waitForGenerator(page);
  await page.locator("#schemeInput").setInputFiles({
    name: "smoke-scheme.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(scheme),
  });

  await expect(page.locator("#status")).toContainText("Схема загружена: 3 шагов");
  await expect(page.locator("#sequenceOutput")).toHaveValue(/50 -> 25 -> 43/);
  await expect.poll(() => readLatestPattern(page)).toMatchObject({
    pointCount: 240,
    lineCount: 3,
  });
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "TXT" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("string-art-scheme.txt");
  expect(await readDownload(download)).toBe(scheme);

  await page.getByRole("link", { name: "Режим сборки" }).click();
  await expect(page.getByText("Шаг 1 из 3")).toBeVisible();
  await expect(page.locator(".nail-readout strong").first()).toHaveText("1");
  await expect(page.locator(".nail-readout.is-next strong")).toHaveText("50");

  await page.getByRole("button", { name: "Далее" }).click();
  await expect(page.getByText("Шаг 2 из 3")).toBeVisible();
  await expect.poll(() => readBuildProgress(page)).toMatchObject({ stepIndex: 1 });

  await page.reload();
  await expect(page.getByText("Шаг 2 из 3")).toBeVisible();
  await expect(page.locator(".nail-readout strong").first()).toHaveText("50");
  await expect(page.locator(".nail-readout.is-next strong")).toHaveText("25");

  await page.getByRole("button", { name: "Я потерялся" }).click();
  await expect(page.getByRole("dialog", { name: "Найти мое место" })).toBeVisible();
  await page.getByLabel("1-я последняя точка").fill("1");
  await page.getByLabel("2-я последняя точка").fill("50");
  await page.getByLabel("3-я последняя точка").fill("25");
  await page.getByRole("button", { name: "Найти", exact: true }).click();
  await expect(page.getByText("Позиция найдена")).toBeVisible();
  await page.getByRole("button", { name: /Выполнено соединений: 2/ }).click();
  await expect(page.getByRole("dialog", { name: "Найти мое место" })).toBeHidden();
  await expect(page.getByText("Шаг 3 из 3")).toBeVisible();
  await expect(page.locator(".nail-readout strong").first()).toHaveText("25");
  await expect(page.locator(".nail-readout.is-next strong")).toHaveText("43");
});

test("generator and build mode do not overflow a mobile viewport", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chrome", "Mobile-only layout assertion");

  await page.goto("/");
  await waitForGenerator(page);
  await expect(page.getByRole("heading", { name: "String Art Generator" })).toBeVisible();
  await expect.poll(() => hasHorizontalOverflow(page)).toBe(false);

  await page.getByRole("link", { name: "Режим сборки" }).click();
  await expect(page.getByRole("heading", { name: "Режим сборки" })).toBeVisible();
  await expect.poll(() => hasHorizontalOverflow(page)).toBe(false);
});

test("build canvas survives repeated mobile seeking", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chrome", "Mobile-only canvas assertion");

  const sequence = Array.from(
    { length: 1601 },
    (_, index) => ((index * 73) % 240) + 1,
  );
  const longScheme = [
    "Points______Lines/n1____0/",
    ...sequence.map((point, index) => `${point}____  ${index + 1}`),
  ].join("\n");

  await page.goto("/build");
  await page.getByLabel("Загрузить схему").setInputFiles({
    name: "long-mobile-scheme.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(longScheme),
  });
  await expect(page.getByText("Шаг 1 из 1601")).toBeVisible();

  const seek = page.locator(".build-seek");
  await setRangeValue(seek, 1200);
  await expect(page.getByText("Шаг 1201 из 1601")).toBeVisible();
  await page.waitForTimeout(900);
  const forwardFrame = await canvasSignature(page);

  await setRangeValue(seek, 350);
  await expect(page.getByText("Шаг 351 из 1601")).toBeVisible();
  await page.waitForTimeout(700);
  const backwardFrame = await canvasSignature(page);
  expect(backwardFrame.hash).not.toBe(forwardFrame.hash);

  await setRangeValue(seek, 1200);
  await expect.poll(() => canvasSignature(page), { timeout: 5_000 }).toEqual(forwardFrame);
});

async function readLatestPattern(page) {
  return page.evaluate(async () => {
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open("string-art-generator", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise((resolve, reject) => {
        const request = database
          .transaction("local-project", "readonly")
          .objectStore("local-project")
          .get("latest-pattern");
        request.onsuccess = () => resolve(request.result ?? null);
        request.onerror = () => reject(request.error);
      });
    } finally {
      database.close();
    }
  });
}

async function readBuildProgress(page) {
  return page.evaluate(async () => {
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open("string-art-generator", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const readRecord = (key) => new Promise((resolve, reject) => {
      const request = database
        .transaction("local-project", "readonly")
        .objectStore("local-project")
        .get(key);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
    try {
      const pattern = await readRecord("latest-pattern");
      return pattern ? await readRecord(`build-progress:${pattern.id}`) : null;
    } finally {
      database.close();
    }
  });
}

async function hasHorizontalOverflow(page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
}

async function canvasTop(page, selector) {
  return page.locator(selector).evaluate((element) => element.getBoundingClientRect().top);
}

async function resultIsNearViewportTop(page) {
  return page.locator("#resultCanvas").evaluate((element) => {
    const top = element.getBoundingClientRect().top;
    return top >= -2 && top < window.innerHeight * 0.25;
  });
}

async function setRangeValue(locator, value) {
  await locator.evaluate((input, nextValue) => {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    ).set;
    setter.call(input, String(nextValue));
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}

async function canvasSignature(page) {
  return page.locator(".build-canvas").evaluate((canvas) => {
    const { data } = canvas.getContext("2d").getImageData(
      0,
      0,
      canvas.width,
      canvas.height,
    );
    let hash = 2166136261;
    let darkSamples = 0;
    for (let index = 0; index < data.length; index += 68) {
      const luminance = data[index] + data[index + 1] + data[index + 2];
      if (luminance < 420) darkSamples += 1;
      hash ^= data[index];
      hash = Math.imul(hash, 16777619);
      hash ^= data[index + 1];
      hash = Math.imul(hash, 16777619);
      hash ^= data[index + 2];
      hash = Math.imul(hash, 16777619);
    }
    return { hash: hash >>> 0, darkSamples };
  });
}

async function pinchOut(page, selector) {
  await page.locator(selector).evaluate((canvas) => {
    const rect = canvas.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const emit = (type, pointerId, clientX) => {
      canvas.dispatchEvent(new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        pointerId,
        pointerType: "touch",
        clientX,
        clientY: centerY,
        buttons: type === "pointerup" ? 0 : 1,
      }));
    };
    emit("pointerdown", 11, centerX - 28);
    emit("pointerdown", 12, centerX + 28);
    emit("pointermove", 11, centerX - 64);
    emit("pointermove", 12, centerX + 64);
    emit("pointerup", 11, centerX - 64);
    emit("pointerup", 12, centerX + 64);
  });
}

async function waitForGenerator(page) {
  await expect(page.locator("#schemeInput")).toBeEnabled({ timeout: 20_000 });
}

async function readDownload(download) {
  const stream = await download.createReadStream();
  let contents = "";
  for await (const chunk of stream) contents += chunk.toString();
  return contents;
}
