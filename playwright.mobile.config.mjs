import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/mobile-smoke",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  timeout: 30_000,
  reporter: "line",
  use: {
    baseURL: "http://127.0.0.1:3200",
    ...devices["Pixel 5"],
    channel: "chrome",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "pnpm mobile:build && pnpm exec vite preview --config mobile-app/vite.config.mjs --host 127.0.0.1 --port 3200 --strictPort",
    url: "http://127.0.0.1:3200",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
