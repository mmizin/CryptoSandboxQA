import { defineConfig, devices } from '@playwright/test';

/**
 * Env loading order (later wins for overlapping keys):
 * 1) Repository root `.env` — backend/frontend stack (API_URL, ADMIN_API_KEY, …).
 * 2) `tests/ui-tests/.env` — Playwright browser baseURL (`PLAYWRIGHT_BASE_URL` / `BASE_URL`), seeds, etc. (see `tests/ui-tests/.env.example`).
 * https://github.com/motdotla/dotenv
 */
import dotenv from 'dotenv';
import path from 'path';

const repoRootEnv = path.resolve(__dirname, '..', '..', '.env');
const packageEnv = path.resolve(__dirname, '.env');

dotenv.config({ path: repoRootEnv });
dotenv.config({ path: packageEnv, override: true });

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 2 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [["line"], ["allure-playwright", {
    resultsDir: "allure-results",
  },]],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /*
     * From process.env (root `.env` + optional tests/ui-tests/.env — see dotenv above).
     * Prefer BASE_URL or PLAYWRIGHT_BASE_URL. Default matches frontend dev server (`next dev -p 3000`).
     */
    baseURL: process.env.BASE_URL ?? process.env.PLAYWRIGHT_BASE_URL,

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Run your local dev server before starting the tests */
  // webServer: {
  //   command: 'npm run start',
  //   url: 'http://localhost:3000',
  //   reuseExistingServer: !process.env.CI,
  // },
});
