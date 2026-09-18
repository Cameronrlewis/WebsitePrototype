import { test, expect } from "@playwright/test";

const SHELL = "/portfolio/assets/viewers/board-viewer-shell.html";

// The shell renders into a canvas, so a screenshot cannot tell us the camera
// moved. It exposes its live camera state instead.
async function readCameraState(page: import("@playwright/test").Page) {
  return page.evaluate(() => (window as unknown as { __boardViewerState?: { theta: number; phi: number; r: number } }).__boardViewerState);
}

test("cinematic mode hides the control hint and ignores drag", async ({ page }) => {
  await page.goto(`${SHELL}?asset=power&mode=cinematic`);
  await expect.poll(async () => Boolean(await readCameraState(page)), { timeout: 30_000 }).toBe(true);

  await expect(page.locator("#hint")).toBeHidden();

  const before = await readCameraState(page);
  await page.mouse.move(200, 200);
  await page.mouse.down();
  await page.mouse.move(600, 320, { steps: 10 });
  await page.mouse.up();
  const after = await readCameraState(page);

  expect(after?.theta).toBeCloseTo(before!.theta, 6);
  expect(after?.phi).toBeCloseTo(before!.phi, 6);
});

test("a spin message drives the camera through one revolution", async ({ page }) => {
  await page.goto(`${SHELL}?asset=power&mode=cinematic`);
  await expect.poll(async () => Boolean(await readCameraState(page)), { timeout: 30_000 }).toBe(true);

  const send = (progress: number) =>
    page.evaluate((value) => window.postMessage({ type: "spin", progress: value }, window.location.origin), progress);

  await send(0);
  const start = await readCameraState(page);
  await send(0.5);
  const middle = await readCameraState(page);
  await send(1);
  const end = await readCameraState(page);

  expect(start?.theta).toBeCloseTo(-0.5, 5);
  expect(end!.theta - start!.theta).toBeCloseTo(Math.PI * 2, 4);
  // Low and close at the midpoint.
  expect(middle!.phi).toBeLessThan(start!.phi);
  expect(middle!.r).toBeLessThan(start!.r);
});

test("the interactive viewer still accepts drag when the mode parameter is absent", async ({ page }) => {
  await page.goto(`${SHELL}?asset=power`);
  await expect.poll(async () => Boolean(await readCameraState(page)), { timeout: 30_000 }).toBe(true);

  await expect(page.locator("#hint")).toBeVisible();

  const before = await readCameraState(page);
  await page.mouse.move(200, 200);
  await page.mouse.down();
  await page.mouse.move(600, 200, { steps: 10 });
  await page.mouse.up();
  const after = await readCameraState(page);

  expect(after?.theta).not.toBeCloseTo(before!.theta, 3);
});
