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
