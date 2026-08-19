import { expect, test } from "@playwright/test";
import path from "node:path";

const scheme = [
  "Points______Lines/n1____0/",
  "50____  1",
  "25____  2",
  "43____  3",
].join("\n");
const printScheme = [
  "Points______Lines/n1____0/",
  ...Array.from(
    { length: 205 },
    (_, index) => `${((index * 73) % 240) + 1}____  ${index + 1}`,
  ),
].join("\n");
const variantScheme = [
  "Points______Lines/n1____0/",
  ...Array.from(
    { length: 5000 },
    (_, index) => `${((index * 73) % 240) + 1}____  ${index + 1}`,
  ),
].join("\n");

test.beforeEach(async ({ page }, testInfo) => {
  if (testInfo.title.includes("UI language switches")) return;
  await page.addInitScript(() => {
    window.localStorage.setItem("string-art-ui-language", "en");
  });
});

test("landing page leads to the generator", async ({ page }) => {
  await page.route("**/api/orders", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ ok: true }),
  }));
  await page.goto("/");

  await expect(page.getByRole("heading", {
    name: /Thread art from your photo|Картина ниткою за вашим фото/,
  })).toBeVisible();
  await expect(page.locator('a[href="/"] img[src="/logo-white.png"]:visible').first()).toBeVisible();
  await expect(page.locator('img[src="/owners.png"]').first()).toBeVisible();
  const mobileMenuButton = page.locator(".mobile-site-menu-toggle");
  if (await mobileMenuButton.isVisible()) {
    await mobileMenuButton.click();
    await expect(mobileMenuButton).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator("#mobile-site-menu")).toHaveClass(/is-open/);
    await expect(page.locator("#mobile-site-menu .language-switch")).toBeVisible();
    await mobileMenuButton.click();
  }
  const comparisonSlider = page.locator(".landing-comparison input");
  await expect(comparisonSlider).toHaveValue("50");
  await comparisonSlider.scrollIntoViewIfNeeded();
  await comparisonSlider.focus();
  await comparisonSlider.press("End");
  await expect(comparisonSlider).toHaveValue("100");
  await expect(page.locator(".landing-comparison")).toHaveCSS(
    "--comparison-position",
    "100%",
  );
  await page.getByRole("button", { name: /Order a kit|Замовити набір/ }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByLabel(/Phone number|Номер телефону/).fill("+380 67 123 45 67");
  await page.getByLabel(/I want to generate the pattern myself|Хочу згенерувати макет самостійно/).check();
  await page.getByRole("button", { name: /Send request|Надіслати заявку/ }).click();
  await expect(page.getByText(/Your request has been received|Заявку отримано/)).toBeVisible();
  await page.getByRole("link", { name: /Open generator|Відкрити генератор/ }).click();
  await expect(page).toHaveURL(/\/create$/);
  await waitForGenerator(page);
});

test("UI language switches from Ukrainian by default and persists across pages", async ({ page }, testInfo) => {
  await page.goto("/create");
  await waitForGenerator(page);

  await expect(page.getByRole("heading", { name: "Налаштування" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Режим складання" })).toBeVisible();
  const mobile = testInfo.project.name === "mobile-chrome";
  if (mobile) {
    await page.locator(".mobile-site-menu-toggle").click();
    await expect(page.locator("#mobile-site-menu")).toHaveClass(/is-open/);
  }
  const visibleLanguageSwitch = page.locator(".language-switch:visible");
  await expect(visibleLanguageSwitch).toHaveCount(1);
  await visibleLanguageSwitch.getByRole("button", { name: "Перемкнути на англійську" }).click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect.poll(() => page.evaluate(
    () => window.localStorage.getItem("string-art-ui-language"),
  )).toBe("en");

  await page.reload();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await page.goto("/build");
  await expect(page.getByText("No active pattern")).toBeVisible();
  await expect(page.getByRole("link", { name: "Choose from my projects" })).toHaveAttribute("href", "/projects");
  await page.goto("/print");
  await expect(page.getByRole("heading", { name: "No pattern available" })).toBeVisible();
});

test("shared mobile menu connects the main application pages", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chrome", "Mobile navigation is only rendered on narrow screens");

  await page.goto("/create");
  await waitForGenerator(page);
  await expect(page.locator(".mobile-site-header")).toBeVisible();
  await expect(page.locator(".app > .language-switch")).toBeHidden();
  await page.locator(".mobile-site-menu-toggle").click();
  await expect(page.locator('#mobile-site-menu a[href="/build"]')).toBeVisible();
  await expect(page.locator('#mobile-site-menu a[href="/login"]')).toBeVisible();
  await page.locator('#mobile-site-menu a[href="/build"]').click();
  await expect(page).toHaveURL(/\/build$/);
  await expect(page.getByText("No active pattern")).toBeVisible();
  await expect(page.locator(".mobile-site-menu-toggle")).toHaveAttribute("aria-expanded", "false");

  await page.goto("/print");
  await expect(page.locator(".mobile-site-header")).toHaveCount(0);
});

test("account page exposes sign-in, registration and password recovery", async ({ page }) => {
  await page.goto("/login");
  const passwordInput = page.getByLabel(/^Password$|^Пароль$/);
  const passwordToggle = page.getByRole("button", { name: /Show password|Показати пароль/ });
  await expect(passwordInput).toHaveAttribute("type", "password");
  await passwordToggle.click();
  await expect(passwordInput).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: /Hide password|Приховати пароль/ }).click();
  await expect(passwordInput).toHaveAttribute("type", "password");

  await expect(page.getByRole("heading", { name: /Welcome back|З поверненням/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Continue with Google|Продовжити з Google/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Sign in$|^Увійти$/ }).last()).toBeVisible();
  await page.getByRole("tab", { name: /Create account|Створити акаунт/ }).click();
  await expect(page.getByRole("heading", { name: /Create your account|Створіть акаунт/ })).toBeVisible();
  await page.getByRole("tab", { name: /^Sign in$|^Увійти$/ }).click();
  await page.getByRole("button", { name: /Forgot password\?|Забули пароль\?/ }).click();
  await expect(page.getByRole("heading", { name: /Reset your password|Відновлення пароля/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Send reset link|Надіслати посилання/ })).toBeVisible();
  await expect(page.getByRole("tab")).toHaveCount(0);
  await page.getByRole("button", { name: /Back to sign in|Повернутися до входу/ }).click();
  await expect(page.getByRole("heading", { name: /Welcome back|З поверненням/ })).toBeVisible();
});

test("generator and build mode share working navigation", async ({ page }) => {
  await page.goto("/create");
  await waitForGenerator(page);

  await expect(page.getByRole("heading", { name: "String Art Generator" })).toBeVisible();
  await expect(page.locator('.generator-brand[href="/"] img[src="/logo-white.png"]')).toBeVisible();
  const pointCount = page.getByRole("spinbutton", { name: "Pins", exact: true });
  await expect(pointCount).toHaveAttribute("max", "320");
  await pointCount.fill("999");
  await expect(pointCount).toHaveValue("320");
  await pointCount.fill("240");
  await expect(page.getByLabel("Minimum distance between pins")).toHaveValue("15");
  const threadThickness = page.getByLabel("Thread thickness, mm");
  await expect(threadThickness).toHaveValue("0.19");
  await expect(threadThickness.locator('option[value="0.22"]')).toHaveText("0.22 - thick");
  await expect(threadThickness.locator('option[value="0.27"]')).toHaveText("0.27 - extra thick");
  await expect(threadThickness.locator('option[value="0.3"]')).toHaveText("0.30 - maximum");
  await threadThickness.selectOption("0.27");
  await expect(threadThickness).toHaveValue("0.27");

  const buildModeLink = page.getByRole("link", { name: "Build mode" });
  await expect(buildModeLink).toBeVisible();
  await buildModeLink.click();

  await expect(page).toHaveURL(/\/build$/);
  await expect(page.getByRole("link", { name: "Generator" })).toBeVisible();
  const voiceButton = page.getByRole("button", { name: "Turn pin voice guidance off" });
  await expect(voiceButton).toHaveAttribute("aria-pressed", "true");
  await voiceButton.click();
  await expect(page.getByRole("button", { name: "Turn pin voice guidance on" }))
    .toHaveAttribute("aria-pressed", "false");
  await expect(page.getByText("No active pattern")).toBeVisible();
  await page.getByRole("link", { name: "Generator" }).click();
  await expect(page).toHaveURL(/\/create$/);
});

test("saved patterns appear in the local project library", async ({ page }) => {
  await page.goto("/create");
  await waitForGenerator(page);
  await page.locator("#schemeInput").setInputFiles({
    name: "library-pattern.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(scheme),
  });

  await page.getByRole("button", { name: "Save project" }).click();
  await expect(page.getByText("Project saved")).toBeVisible();
  await expect.poll(() => readLatestPattern(page)).toMatchObject({
    pointCount: 240,
    lineCount: 3,
  });
  await page.goto("/projects");
  await expect(page.getByRole("heading", { name: "My projects" })).toBeVisible();
  await expect(page.getByText("1 of 5 projects")).toBeVisible();
  await expect(page.getByText("240 pins · 3 connections")).toBeVisible();
  await expect(page.getByText("Not started")).toBeVisible();
  await expect(page.getByText("0%")).toBeVisible();
  await expect(page.getByRole("button", { name: "Print" })).toHaveCount(0);

  await page.getByRole("button", { name: "Rename project" }).click();
  await page.getByLabel("Project name").fill("Family portrait");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("heading", { name: "Family portrait" })).toBeVisible();

  await page.getByRole("button", { name: "Build", exact: true }).click();
  await expect(page).toHaveURL(/\/build$/);
  await expect(page.getByText("Step 1 of 3")).toBeVisible();
  await page.getByRole("button", { name: "Next" }).click();
  await expect.poll(() => readBuildProgress(page)).toMatchObject({ stepIndex: 1 });
  await page.goto("/projects");
  await expect(page.getByText("Step 1 of 3")).toBeVisible();
  await expect(page.getByText("33%")).toBeVisible();
});

test("the single reference core generates a route from a photo", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
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
  await page.goto("/create");
  await waitForGenerator(page);
  if (testInfo.project.name === "mobile-chrome") {
    await expect.poll(() => canvasTop(page, "#sourceCanvas")).toBeLessThan(
      await canvasTop(page, "#resultCanvas"),
    );
  }

  await page.locator("#linesInput").evaluate((input) => {
    input.value = "100";
  });
  await page.locator("#imageInput").setInputFiles(path.resolve("test-photo.png"));
  await setRangeValue(page.locator("#sharpnessInput"), 35);
  await setRangeValue(page.locator("#clarityInput"), 20);
  await expect(page.locator("#sharpnessValue")).toHaveText("35%");
  await expect(page.locator("#clarityValue")).toHaveText("20%");
  await page.getByRole("button", { name: "Zoom in" }).click();
  await expect(page.locator("#zoomValue")).toHaveText("105%");
  await page.getByRole("button", { name: "Zoom in" }).click();
  await page.getByRole("button", { name: "Zoom out" }).click();
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
    ? "Generate artwork"
    : "Generate";
  const buildButton = page.getByRole("button", { name: buildButtonName });
  await expect(buildButton).toBeEnabled();
  await page.evaluate(() => {
    window.__resultCanvasClearCount = 0;
  });
  await buildButton.click();

  await expect(page.locator("#sequenceOutput")).toHaveValue(
    /^1 -> 50 ->/,
    { timeout: 30_000 },
  );
  await expect.poll(
    () => page.evaluate(() => window.__resultCanvasClearCount),
  ).toBe(1);
  if (testInfo.project.name === "mobile-chrome") {
    await expect.poll(() => resultIsNearViewportTop(page)).toBe(true);
  }
  await page.getByRole("button", { name: "Save project" }).click();
  await expect(page.getByText("Project saved")).toBeVisible();
  await expect.poll(() => readLatestPattern(page)).toMatchObject({
    algorithm: "reference-v7",
    pointCount: 240,
    lineCount: 100,
    sharpness: 35,
    clarity: 20,
  });
  expect(pageErrors).toEqual([]);
});

test("a 5000-line result keeps the source and exposes four clear variants", async ({ page }) => {
  await page.goto("/create");
  await waitForGenerator(page);
  await page.locator("#schemeInput").setInputFiles({
    name: "variant-scheme.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(variantScheme),
  });

  const stage = page.locator(".stage");
  await expect(stage).not.toHaveClass(/has-result-variants/);
  await expect(page.locator(".source-column")).toBeVisible();
  await expect(page.locator("#resultVariants")).toBeVisible();
  await expect(page.locator('.result-variant[data-lines="4000"]'))
    .toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('.result-variant[data-lines="4000"]'))
    .toHaveClass(/is-selected/);
  await expect(page.locator(".result-variant:visible")).toHaveCount(4);
  await expect(page.getByRole("button", { name: "Show 5000-line artwork" }))
    .toBeVisible();
  await expect(page.locator("#resultCanvas")).toHaveAttribute("data-lines", "4000");
  const defaultFrame = await canvasSignature(page, "#resultCanvas");
  await page.getByRole("button", { name: "Show 5000-line artwork" }).click();
  await expect(page.locator("#resultCanvas")).toHaveAttribute("data-lines", "5000");
  const fullFrame = await canvasSignature(page, "#resultCanvas");
  expect(fullFrame.darkSamples).toBeGreaterThan(defaultFrame.darkSamples);
  await page.getByRole("button", { name: "Show 4000-line artwork" }).click();
  await expect(page.locator("#resultCanvas")).toHaveAttribute("data-lines", "4000");
  const restoredFrame = await canvasSignature(page, "#resultCanvas");
  expect(restoredFrame.darkSamples).toBeLessThan(fullFrame.darkSamples);
  await page.getByRole("button", { name: "Save project" }).click();
  await expect.poll(
    () => readLatestPattern(page),
    { timeout: 15_000 },
  ).toMatchObject({
    pointCount: 240,
    lineCount: 5000,
  });

  await page.getByRole("button", { name: "Show 3500-line artwork" }).click();
  await expect(page.locator('.result-variant[data-lines="3500"]'))
    .toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('.result-variant[data-lines="3500"]'))
    .toHaveClass(/is-selected/);
  await expect(page.locator('.result-variant[data-lines="4000"]'))
    .not.toHaveClass(/is-selected/);
});

test("TXT import reaches build mode and restores saved progress", async ({ page }) => {
  test.setTimeout(75_000);
  await page.addInitScript(() => {
    class MockSpeechRecognition {
      constructor() {
        window.__buildSpeechRecognition = this;
        this.continuous = false;
        this.interimResults = false;
        this.maxAlternatives = 1;
        this.lang = "";
      }

      start() {
        queueMicrotask(() => this.onstart?.());
      }

      abort() {
        queueMicrotask(() => this.onend?.());
      }
    }

    window.SpeechRecognition = MockSpeechRecognition;
    window.__emitBuildVoiceCommand = (transcript) => {
      const result = [{ transcript }];
      result.isFinal = true;
      window.__buildSpeechRecognition?.onresult?.({
        resultIndex: 0,
        results: [result],
      });
    };
  });
  await page.goto("/create");
  await waitForGenerator(page);
  await page.locator("#schemeInput").setInputFiles({
    name: "smoke-scheme.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(scheme),
  });

  await expect(page.locator("#status"))
    .toHaveText(/Pattern uploaded: 3 steps|Схему завантажено: 3 кроків/);
  await expect(page.locator("#sequenceOutput")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "TXT" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "PNG" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Print|Друк/ })).toHaveCount(0);

  await page.getByRole("link", { name: "Build mode" }).click();
  await expect(page.getByText("Step 1 of 3")).toBeVisible({ timeout: 20_000 });
  await expect(page.locator(".nail-readout strong").first()).toHaveText("1");
  await expect(page.locator(".nail-readout.is-next strong")).toHaveText("50");
  await expect(page.locator("#buildSpeedInput")).toHaveValue("1500");

  const voiceControl = page.getByRole("button", { name: "Turn voice commands on" });
  await voiceControl.click();
  await expect(page.getByRole("button", { name: "Turn voice commands off" }))
    .toHaveAttribute("aria-pressed", "true");
  await page.evaluate(() => window.__emitBuildVoiceCommand("next"));
  await expect(page.getByText("Step 2 of 3")).toBeVisible();
  await page.evaluate(() => window.__emitBuildVoiceCommand("back"));
  await expect(page.getByText("Step 1 of 3")).toBeVisible();
  await page.getByRole("button", { name: "Turn voice commands off" }).click();

  const englishVoiceRequest = page.waitForRequest(
    (request) => request.url().endsWith("/audio/build/en/50.m4a"),
  );
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await englishVoiceRequest;
  await page.getByRole("button", { name: "Pause", exact: true }).click();

  await page.getByRole("button", { name: "Shorten pause" }).click();
  await expect(page.locator("#buildSpeedInput")).toHaveValue("1250");
  await expect(page.locator(".build-speed-heading output")).toHaveText("1.25 sec");

  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByText("Step 2 of 3")).toBeVisible();
  await expect.poll(() => readBuildProgress(page)).toMatchObject({ stepIndex: 1 });

  await page.reload();
  await expect(page.getByText("Step 2 of 3")).toBeVisible();
  await expect(page.locator(".nail-readout strong").first()).toHaveText("50");
  await expect(page.locator(".nail-readout.is-next strong")).toHaveText("25");

  await page.getByRole("button", { name: "I'm lost" }).click();
  await expect(page.getByRole("dialog", { name: "Find my position" })).toBeVisible();
  await page.getByLabel("Recent pin 1").fill("1");
  await page.getByLabel("Recent pin 2").fill("50");
  await page.getByLabel("Recent pin 3").fill("25");
  await page.getByRole("button", { name: "Find", exact: true }).click();
  await expect(page.getByText("Position found")).toBeVisible();
  await page.getByRole("button", { name: /Completed connections: 2/ }).click();
  await expect(page.getByRole("dialog", { name: "Find my position" })).toBeHidden();
  await expect(page.getByText("Step 3 of 3")).toBeVisible();
  await expect(page.locator(".nail-readout strong").first()).toHaveText("25");
  await expect(page.locator(".nail-readout.is-next strong")).toHaveText("43");
});

test("a buyer QR link opens Build Mode and restores local progress", async ({ page }) => {
  const token = "0123456789abcdef0123456789abcdef";
  const projectId = "a2d5e131-5257-4ee8-939d-d19033956921";
  await page.route("**/rest/v1/rpc/get_shared_pattern", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([{
        project_id: projectId,
        name: "Buyer portrait",
        sequence: [1, 50, 25],
        point_count: 240,
        line_count: 2,
        updated_at: "2026-07-31T10:00:00.000Z",
      }]),
    });
  });

  await page.goto(`/s/${token}`);
  await expect(page.getByText("Step 1 of 2")).toBeVisible({ timeout: 20_000 });
  await expect(page.locator(".nail-readout strong").first()).toHaveText("1");
  await expect(page.locator(".nail-readout.is-next strong")).toHaveText("50");
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByText("Step 2 of 2")).toBeVisible();
  await expect.poll(() => readBuildProgressById(page, projectId)).toMatchObject({
    stepIndex: 1,
  });

  await page.reload();
  await expect(page.getByText("Step 2 of 2")).toBeVisible({ timeout: 20_000 });
  await expect(page.locator(".nail-readout strong").first()).toHaveText("50");
});

test("Print opens a configurable A4 instruction from the latest scheme", async ({ page }) => {
  test.slow();
  await page.goto("/create");
  await waitForGenerator(page);
  await page.locator("#schemeInput").setInputFiles({
    name: "print-scheme.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(printScheme),
  });

  await expect(page.getByRole("button", { name: "Print" })).toBeEnabled();
  await page.getByRole("button", { name: "Print" }).click();
  await expect(page).toHaveURL(/\/print$/);
  await expect(page.getByRole("heading", { name: "Print Instructions" })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByRole("button", { name: "Cover PDF" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Instructions PDF" })).toBeVisible();
  await expect(page.locator(".language-switch")).toBeVisible();
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".language-switch")).toBeHidden();
  await page.emulateMedia({ media: null });
  await expect(page.locator(".cover-sheet")).toBeVisible();
  await expect(page.locator(".instruction-sheet")).toHaveCount(2);
  await expect(page.locator(".instruction-sheet").first().locator(".instruction-row")).toHaveCount(204);
  await expect(page.locator(".instruction-row")).toHaveCount(205);
  const languageSelect = page.getByLabel("Instruction language");
  await expect(languageSelect).toHaveValue("en");
  await expect(page.locator(".cover-sheet h2")).toHaveText("Instructions");
  await expect(page.locator(".instruction-row").first()).toHaveText("1 step - 1");
  await languageSelect.selectOption("uk");
  await expect(page.locator(".instruction-row").first()).toHaveText("1 крок - 1");
  await languageSelect.selectOption("en");
  await page.getByLabel("Include sticker step").uncheck();
  await expect(page.locator(".cover-sheet li")).toHaveCount(2);
  await expect(page.locator(".cover-sheet li").first()).toContainText("Find nail number 1");

  await page.evaluate(() => document.body.classList.add("print-cover-only"));
  const coverPdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
  expect(countPdfPages(coverPdf)).toBe(1);
  await page.evaluate(() => document.body.classList.remove("print-cover-only"));

  await page.evaluate(() => document.body.classList.add("print-instruction-only"));
  const instructionPdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
  expect(countPdfPages(instructionPdf)).toBe(2);
  await page.evaluate(() => document.body.classList.remove("print-instruction-only"));

  await page.getByLabel("Preview").selectOption("none");
  await expect(page.locator(".cover-image")).toHaveClass(/is-empty/);
  await page.getByLabel("Start at step").fill("205");
  await expect(page.locator(".instruction-row")).toHaveCount(1);
  await expect(page.locator(".instruction-row").first()).toHaveText("205 step - 13");
});

test("generator and build mode do not overflow a mobile viewport", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chrome", "Mobile-only layout assertion");

  await page.goto("/create");
  await waitForGenerator(page);
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
    "content",
    /maximum-scale=1.*user-scalable=no/,
  );
  await expect(page.getByRole("heading", { name: "String Art Generator" })).toBeVisible();
  const buildLinkBox = await page.getByRole("link", { name: "Build mode" }).boundingBox();
  const parametersBox = await page.getByRole("heading", { name: "Settings" }).boundingBox();
  expect(buildLinkBox.y + buildLinkBox.height).toBeLessThan(parametersBox.y);
  await expect.poll(() => hasHorizontalOverflow(page)).toBe(false);

  await page.getByRole("link", { name: "Build mode" }).click();
  await expect(page.getByRole("link", { name: "Generator" })).toBeVisible();
  await expect(page.getByLabel("Upload pattern")).toHaveCount(0);
  await expect.poll(() => hasHorizontalOverflow(page)).toBe(false);
});

test("generator header remains stable while resizing a desktop viewport", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chrome", "Desktop-only responsive assertion");

  await page.setViewportSize({ width: 1000, height: 900 });
  await page.goto("/create");
  await waitForGenerator(page);
  await expect.poll(() => hasHorizontalOverflow(page)).toBe(false);

  const workspaceBox = await page.locator(".workspace").boundingBox();
  const panelBox = await page.locator(".panel").boundingBox();
  expect(panelBox.y).toBeGreaterThanOrEqual(workspaceBox.y + workspaceBox.height - 1);

  await page.setViewportSize({ width: 800, height: 900 });
  await expect.poll(() => hasHorizontalOverflow(page)).toBe(false);
  const brandBox = await page.locator(".generator-brand").boundingBox();
  const actionBoxes = await page.locator(".topbar-actions > *").evaluateAll((elements) => (
    elements.map((element) => {
      const rect = element.getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom };
    })
  ));
  expect(actionBoxes).toHaveLength(3);
  expect(actionBoxes[0].top).toBeGreaterThanOrEqual(brandBox.y + brandBox.height);
  expect(new Set(actionBoxes.map(({ top }) => Math.round(top))).size).toBe(1);
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

  await page.goto("/create");
  await waitForGenerator(page);
  await page.locator("#schemeInput").setInputFiles({
    name: "long-mobile-scheme.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(longScheme),
  });
  await expect(page.locator("#sequenceOutput")).toHaveValue(/1 -> 74 -> 147/);
  await page.waitForTimeout(750);
  await page.getByRole("link", { name: "Build mode" }).click();
  await expect(page.getByText("Step 1 of 1601")).toBeVisible();

  const seek = page.locator(".build-seek");
  await setRangeValue(seek, 1200);
  await expect(page.getByText("Step 1201 of 1601")).toBeVisible();
  await page.waitForTimeout(900);
  const forwardFrame = await canvasSignature(page);

  await setRangeValue(seek, 350);
  await expect(page.getByText("Step 351 of 1601")).toBeVisible();
  const immediateBackwardFrame = await canvasSignature(page);
  expect(immediateBackwardFrame.darkSamples).toBeLessThan(
    forwardFrame.darkSamples * 0.75,
  );
  await page.waitForTimeout(700);
  const backwardFrame = await canvasSignature(page);
  expect(backwardFrame).toEqual(immediateBackwardFrame);
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

function countPdfPages(buffer) {
  return buffer.toString("latin1").match(/\/Type\s*\/Page\b/g)?.length || 0;
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

async function readBuildProgressById(page, projectId) {
  return page.evaluate(async (id) => {
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
          .get(`build-progress:${id}`);
        request.onsuccess = () => resolve(request.result ?? null);
        request.onerror = () => reject(request.error);
      });
    } finally {
      database.close();
    }
  }, projectId);
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
    return top >= -2 && top < window.innerHeight * 0.4;
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

async function canvasSignature(page, selector = ".build-canvas") {
  return page.locator(selector).evaluate((canvas) => {
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
