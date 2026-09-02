import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: "line",
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "mobile-chromium",
      testMatch: "mobile.spec.ts",
      use: {
        ...devices["Pixel 5"],
        browserName: "chromium",
        viewport: { width: 844, height: 390 },
      },
    },
    {
      name: "mobile-webkit",
      testMatch: "mobile.spec.ts",
      use: {
        ...devices["iPhone 13"],
        browserName: "webkit",
        viewport: { width: 844, height: 390 },
      },
    },
    {
      name: "desktop-chromium",
      testMatch: "desktop.spec.ts",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
  webServer: {
    command: "npm run dev -- --host 127.0.0.1",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: true,
  },
});
