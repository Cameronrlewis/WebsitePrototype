import { defineConfig, devices } from "@playwright/test";

// E2E_TARGET=preview runs against the built production bundle (`vite preview`,
// default port 4173) instead of the dev server, to exercise the real Rollup
// output. CI builds separately first; run `pnpm build` yourself before using
// this locally.
const isPreview = process.env.E2E_TARGET === "preview";
const port = isPreview ? 4173 : 5173;
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  webServer: {
    command: isPreview ? "pnpm preview" : "pnpm dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
