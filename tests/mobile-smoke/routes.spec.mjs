import { expect, test } from "@playwright/test";

const routes = [
  { path: "/create", selector: "main.app", title: "String Art Generator" },
  { path: "/projects", selector: "main.projects-page", title: "Projects · String Art Dnipro" },
  { path: "/build", selector: "main.build-loading", title: "Build mode · String Art Dnipro" },
  { path: "/login", selector: "main.auth-page", title: "String Art Generator" },
  { path: "/s/mobile-smoke", selector: "main.shared-build-error", title: "Build mode · String Art Dnipro" },
];

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("string-art-ui-language", "en");
  });
});

test("the installed bundle loads every application route", async ({ page }) => {
  const runtimeErrors = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") runtimeErrors.push(message.text());
  });

  for (const route of routes) {
    await test.step(route.path, async () => {
      await page.goto(route.path);
      await expect(page.locator(route.selector)).toBeVisible();
      await expect(page).toHaveTitle(route.title);
      await expect(page.locator(".mobile-site-header")).toBeVisible();
    });
  }

  expect(runtimeErrors, runtimeErrors.join("\n")).toEqual([]);
});

test("unknown paths return to the generator without a reload loop", async ({ page }) => {
  await page.goto("/not-a-mobile-route");

  await expect(page.locator("main.app")).toBeVisible();
  await expect(page).toHaveURL(/\/create$/);
});
