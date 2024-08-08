import { defineConfig, devices } from "@playwright/test";

const BASE_URL = process.env.BASE_URL || "http://localhost:3032";

console.log("BASE_URL:", BASE_URL);
/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 4,
  reporter: "html",
  use: {
    baseURL: BASE_URL,
    extraHTTPHeaders: {
      // Skip browser warning of ngrok
      "ngrok-skip-browser-warning": "true",
    },
    trace: "on-first-retry",
    headless: !process.env.HEADFULL,
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "cd example && make dev",
    port: 3032,
    reuseExistingServer: !process.env.CI,
  },
});
