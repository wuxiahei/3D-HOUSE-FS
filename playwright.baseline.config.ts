import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./apps/web/e2e",
  testMatch: "baseline-performance.spec.ts",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  outputDir: "test-results/playwright-artifacts",
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "retain-on-failure"
  },
  projects: [
    {
      name: "desktop-chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 }
      }
    },
    {
      name: "mobile-chromium",
      use: {
        ...devices["Pixel 5"],
        viewport: { width: 390, height: 844 }
      }
    }
  ],
  webServer: {
    command: "npm.cmd run start:web",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: false,
    timeout: 120_000
  }
});
