import { test, expect, type Frame, type Page } from "@playwright/test";

const SHELL = "/portfolio/assets/viewers/board-viewer-shell.html";
const CINEMATIC = `${SHELL}?asset=power&mode=cinematic`;

// The mid-orbit heading: SPIN_START_THETA (-0.5) plus half a revolution.
const MID_ORBIT_THETA = -0.5 + Math.PI;

interface CameraState {
  theta: number;
  phi: number;
  r: number;
}

// The shell renders into a canvas, so a screenshot cannot tell us the camera
// moved. It exposes its live camera state instead.
function readCameraState(target: Page | Frame) {
  return target.evaluate(() => (window as unknown as { __boardViewerState?: CameraState }).__boardViewerState);
}

async function waitForScene(target: Page | Frame) {
  await expect
    .poll(async () => Boolean(await readCameraState(target)), { timeout: 30_000 })
    .toBe(true);
}

function post(target: Page | Frame, message: Record<string, unknown>) {
  return target.evaluate((value) => window.postMessage(value, window.location.origin), message);
}

test("cinematic mode hides the control hint and ignores drag", async ({ page }) => {
  await page.goto(CINEMATIC);
  await waitForScene(page);

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

// The camera path lives in exactly one place now (the shell). These assertions
// are the guard on its constants: change the curve and this fails.
test("the spin curve holds its exact constants across the orbit", async ({ page }) => {
  await page.goto(CINEMATIC);
  await waitForScene(page);

  await post(page, { type: "spin", progress: 0 });
  const start = (await readCameraState(page))!;
  await post(page, { type: "spin", progress: 0.5 });
  const middle = (await readCameraState(page))!;
  await post(page, { type: "spin", progress: 1 });
  const end = (await readCameraState(page))!;

  // theta: starts at -0.5, exactly one revolution across the orbit.
  expect(start.theta).toBeCloseTo(-0.5, 5);
  expect(middle.theta).toBeCloseTo(MID_ORBIT_THETA, 5);
  expect(end.theta - start.theta).toBeCloseTo(Math.PI * 2, 4);

  // phi: 1.25 at the ends, diving to 0.55 at the midpoint.
  expect(start.phi).toBeCloseTo(1.25, 5);
  expect(middle.phi).toBeCloseTo(0.55, 5);
  expect(end.phi).toBeCloseTo(1.25, 5);

  // radiusScale: 1.35 at the ends, 1.0 at the midpoint. maxDimension is not
  // exposed, so pin the ratio, which depends only on those two constants.
  expect(start.r / middle.r).toBeCloseTo(1.35 / 1.0, 4);
  expect(end.r).toBeCloseTo(start.r, 4);

  // phi must stay inside the shell's own polar clamp or the camera flips.
  for (const pose of [start, middle, end]) {
    expect(pose.phi).toBeGreaterThan(0.04);
    expect(pose.phi).toBeLessThan(Math.PI - 0.04);
  }
});

test("play runs the orbit on its own clock and pause freezes it", async ({ page }) => {
  await page.goto(CINEMATIC);
  await waitForScene(page);

  await post(page, { type: "play" });
  const first = (await readCameraState(page))!.theta;
  await expect
    .poll(async () => Math.abs((await readCameraState(page))!.theta - first), { timeout: 10_000 })
    .toBeGreaterThan(0.1);

  await post(page, { type: "pause" });
  // Let any in-flight frame land before sampling.
  await page.waitForTimeout(250);
  const frozen = (await readCameraState(page))!.theta;
  await page.waitForTimeout(1000);
  expect((await readCameraState(page))!.theta).toBeCloseTo(frozen, 6);

  // Resuming continues from where it stopped rather than snapping to the start.
  await post(page, { type: "play" });
  await expect
    .poll(async () => Math.abs((await readCameraState(page))!.theta - frozen), { timeout: 10_000 })
    .toBeGreaterThan(0.1);
});

test("the interactive viewer still accepts drag when the mode parameter is absent", async ({ page }) => {
  await page.goto(`${SHELL}?asset=power`);
  await waitForScene(page);

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

function cinematicFrame(page: Page) {
  return page.frames().find((candidate) => candidate.url().includes("mode=cinematic"));
}

test("the showcase orbits while on screen and pauses once it scrolls away", async ({ page }) => {
  await page.goto("/");

  const showcase = page.locator("[data-board-showcase]");
  await showcase.scrollIntoViewIfNeeded();
  await expect(page.frameLocator("[data-board-showcase] iframe").locator("#viewer canvas")).toBeAttached({
    timeout: 30_000,
  });

  const frame = cinematicFrame(page);
  expect(frame).toBeTruthy();
  await waitForScene(frame!);

  // On screen: the orbit advances on its own, with no scrolling at all.
  const first = (await readCameraState(frame!))!.theta;
  await expect
    .poll(async () => Math.abs((await readCameraState(frame!))!.theta - first), { timeout: 10_000 })
    .toBeGreaterThan(0.1);

  // Scrolled away: it stops. The board sits near the top of the page, so
  // scrolling to the bottom takes it well out of view.
  await page.locator("[data-section='contact']").scrollIntoViewIfNeeded();
  await expect(showcase).not.toBeInViewport();
  await page.waitForTimeout(600);

  const parked = (await readCameraState(frame!))!.theta;
  await page.waitForTimeout(1200);
  expect((await readCameraState(frame!))!.theta).toBeCloseTo(parked, 6);
});

test("reduced motion holds the board on the mid-orbit pose", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto("/");

  await page.locator("[data-board-showcase]").scrollIntoViewIfNeeded();
  await expect(page.frameLocator("[data-board-showcase] iframe").locator("#viewer canvas")).toBeAttached({
    timeout: 30_000,
  });

  const frame = cinematicFrame(page);
  await waitForScene(frame!);

  // Not merely "unchanging" - it must be parked on the mid-orbit pose, which is
  // what spec item 5 asks for. A component that sent nothing would sit at
  // progress 0 and still look static.
  await expect
    .poll(async () => (await readCameraState(frame!))!.theta, { timeout: 10_000 })
    .toBeCloseTo(MID_ORBIT_THETA, 3);

  const before = (await readCameraState(frame!))!.theta;
  await page.waitForTimeout(1200);
  expect((await readCameraState(frame!))!.theta).toBeCloseTo(before, 6);

  await context.close();
});

// The showcase sits 779px down the page, so whether it starts on screen depends
// on the viewport: below the fold at 720p, above it at 900p and taller. Both
// paths are covered because each protects a different thing.

test("a short viewport does not fetch geometry until the block is scrolled to", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });

  let requested = 0;
  page.on("request", (request) => {
    if (request.url().includes(".pcbgeo")) {
      requested += 1;
    }
  });

  await page.goto("/");
  await expect(page.locator("h1").first()).toBeVisible();
  await page.waitForTimeout(2000);
  expect(requested).toBe(0);

  await page.locator("[data-board-showcase]").scrollIntoViewIfNeeded();
  await expect.poll(() => requested, { timeout: 30_000 }).toBe(1);
});

test("a tall viewport defers the mount past load so the hero paints first", async ({ page }) => {
  // Here the block IS on screen at first paint, so the only thing standing
  // between the hero and the geometry fetch is the idle gate. Assert the gate
  // directly: the iframe must not be in the DOM yet when load fires. Checking
  // only that the fetch lands after the hero would pass without any gate at
  // all, purely from React effect ordering.
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.goto("/", { waitUntil: "load" });
  await expect(page.locator("h1").first()).toBeVisible();
  expect(await page.locator("[data-board-showcase] iframe").count()).toBe(0);

  // It still mounts promptly once the browser goes idle, just not before.
  await expect(page.locator("[data-board-showcase] iframe")).toHaveCount(1, { timeout: 30_000 });
});
