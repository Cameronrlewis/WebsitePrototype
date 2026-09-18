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

const GEOMETRY = "**/portfolio/assets/viewers/geometry/*.pcbgeo";

test("the showcase does not fetch geometry until it is near the viewport", async ({ page }) => {
  let requested = 0;
  await page.route(GEOMETRY, async (route) => {
    requested += 1;
    await route.continue();
  });

  await page.goto("/");
  await expect(page.locator("main")).toBeVisible();
  // Give the page room to settle before asserting the negative.
  await page.waitForTimeout(1500);
  expect(requested).toBe(0);

  await page.locator("[data-board-showcase]").scrollIntoViewIfNeeded();
  await expect.poll(() => requested, { timeout: 30_000 }).toBe(1);
});

test("scrolling the showcase past the viewport turns the board", async ({ page }) => {
  await page.goto("/");

  const showcase = page.locator("[data-board-showcase='power']");
  await showcase.scrollIntoViewIfNeeded();

  const viewer = page.frameLocator("[data-board-showcase] iframe");
  await expect(viewer.locator("#viewer canvas")).toBeAttached({ timeout: 30_000 });

  const frame = page.frames().find((candidate) => candidate.url().includes("mode=cinematic"));
  expect(frame).toBeTruthy();

  const readTheta = async () =>
    (await frame!.evaluate(() => (window as unknown as { __boardViewerState?: { theta: number } }).__boardViewerState?.theta)) ?? Number.NaN;

  await expect.poll(async () => Number.isFinite(await readTheta()), { timeout: 30_000 }).toBe(true);
  const before = await readTheta();

  // The portfolio scrolls inside <main>, and page.mouse.wheel dispatches at the
  // current mouse position, which defaults to (0, 0) over the Sidebar (which
  // does not scroll). Move over the scrollable content first.
  await page.mouse.move(700, 400);
  await page.mouse.wheel(0, 2400);
  await expect.poll(async () => Math.abs((await readTheta()) - before), { timeout: 10_000 }).toBeGreaterThan(0.2);
});

test("reduced motion holds the board on a single pose", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto("/");

  await page.locator("[data-board-showcase]").scrollIntoViewIfNeeded();
  const viewer = page.frameLocator("[data-board-showcase] iframe");
  await expect(viewer.locator("#viewer canvas")).toBeAttached({ timeout: 30_000 });

  const frame = page.frames().find((candidate) => candidate.url().includes("mode=cinematic"));
  const readTheta = async () =>
    (await frame!.evaluate(() => (window as unknown as { __boardViewerState?: { theta: number } }).__boardViewerState?.theta)) ?? Number.NaN;

  await expect.poll(async () => Number.isFinite(await readTheta()), { timeout: 30_000 }).toBe(true);
  const before = await readTheta();

  await page.mouse.move(700, 400);
  await page.mouse.wheel(0, 2400);
  await page.waitForTimeout(800);
  expect(await readTheta()).toBeCloseTo(before, 5);

  await context.close();
});
