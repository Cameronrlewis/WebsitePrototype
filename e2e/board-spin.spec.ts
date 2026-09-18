import { test, expect, type Frame, type Page } from "@playwright/test";

/**
 * Every scene here fetches roughly a megabyte of geometry, decodes it in JS and
 * builds a WebGL context. CI runners have no GPU and fall back to a software
 * renderer on two cores, where that is slow enough that a page can stop
 * answering CDP calls for tens of seconds.
 *
 * So these tests are deliberately few and dense: each loads a scene once and
 * asserts everything it can against it, rather than splitting into many small
 * tests that each pay the load cost again. Serial keeps one context live at a
 * time, and the budget is raised to match the software renderer.
 */
test.describe.configure({ mode: "serial", timeout: 90_000 });

const SHELL = "/portfolio/assets/viewers/board-viewer-shell.html";
const CINEMATIC = `${SHELL}?asset=power&mode=cinematic`;

// The mid-orbit heading: the start heading (-0.5) plus half a revolution.
const MID_ORBIT_THETA = -0.5 + Math.PI;

interface CameraState {
  theta: number;
  phi: number;
  r: number;
}

// The shell renders into a canvas, so a screenshot cannot tell us where the
// camera is. It exposes its live camera state instead.
function readCameraState(target: Page | Frame) {
  return target.evaluate(() => (window as unknown as { __boardViewerState?: CameraState }).__boardViewerState);
}

function readOrbit(target: Page | Frame) {
  return target.evaluate(
    () => (window as unknown as { __boardViewerOrbit?: () => { playing: boolean; elapsed: number } }).__boardViewerOrbit?.(),
  );
}

function post(target: Page | Frame, message: Record<string, unknown>) {
  return target.evaluate((value) => window.postMessage(value, window.location.origin), message);
}

/**
 * Waits for the scene, and fails fast with the real reason when it cannot
 * build. The shell surfaces a failure in its error card and never sets
 * __boardViewerState, so polling for state alone burns the whole timeout and
 * reports nothing useful. That is exactly what happens on a runner with no
 * working WebGL, where the shell correctly reports
 * "Error creating WebGL context." and this used to look like a mystery hang.
 */
async function waitForScene(target: Page | Frame) {
  const readFailure = () =>
    target.evaluate(() => {
      const card = document.getElementById("error");
      if (!card || !card.classList.contains("visible")) {
        return null;
      }

      return document.getElementById("error-message")?.textContent?.trim() || "unknown viewer error";
    });

  // expect.poll would keep retrying a failed viewer until the timeout, so this
  // loops by hand in order to throw the moment the error card appears.
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const failure = await readFailure();
    if (failure) {
      throw new Error(`Board viewer failed to initialise: ${failure}`);
    }

    if (await readCameraState(target)) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error("Board viewer never became ready within 60s, and reported no error.");
}

function cinematicFrame(page: Page) {
  return page.frames().find((candidate) => candidate.url().includes("mode=cinematic"));
}

test("the cinematic shell is inert, holds its curve, and obeys play and pause", async ({ page }) => {
  await page.goto(CINEMATIC);
  await waitForScene(page);

  // Inert: no hint, and drag does not move the camera.
  await expect(page.locator("#hint")).toBeHidden();
  const idle = (await readCameraState(page))!;
  await page.mouse.move(200, 200);
  await page.mouse.down();
  await page.mouse.move(600, 320, { steps: 6 });
  await page.mouse.up();
  const afterDrag = (await readCameraState(page))!;
  expect(afterDrag.theta).toBeCloseTo(idle.theta, 6);
  expect(afterDrag.phi).toBeCloseTo(idle.phi, 6);

  // The camera path lives in exactly one place now, so these constants are its
  // only guard. Change the curve and this fails.
  await post(page, { type: "spin", progress: 0 });
  const start = (await readCameraState(page))!;
  await post(page, { type: "spin", progress: 0.5 });
  const middle = (await readCameraState(page))!;
  await post(page, { type: "spin", progress: 1 });
  const end = (await readCameraState(page))!;

  expect(start.theta).toBeCloseTo(-0.5, 5);
  expect(middle.theta).toBeCloseTo(MID_ORBIT_THETA, 5);
  expect(end.theta - start.theta).toBeCloseTo(Math.PI * 2, 4);

  expect(start.phi).toBeCloseTo(1.25, 5);
  expect(middle.phi).toBeCloseTo(0.55, 5);
  expect(end.phi).toBeCloseTo(1.25, 5);

  // radiusScale is 1.35 at the ends and 1.0 at the midpoint, with a breathing
  // term of sin(4*pi*t)*0.08 on top. That term is 0 at t = 0, 0.5 and 1, so
  // these three sample points still see the base curve exactly.
  expect(start.r / middle.r).toBeCloseTo(1.35 / 1.0, 4);
  expect(end.r).toBeCloseTo(start.r, 4);

  // But it must actually breathe in between, or the term was dropped.
  await post(page, { type: "spin", progress: 0.125 });
  const quarter = (await readCameraState(page))!;
  expect(quarter.r / start.r).toBeLessThan((1.35 - 0.08) / 1.35 + 0.001);

  // phi must stay inside the shell's own polar clamp or the camera flips.
  for (const pose of [start, middle, end]) {
    expect(pose.phi).toBeGreaterThan(0.04);
    expect(pose.phi).toBeLessThan(Math.PI - 0.04);
  }

  // Frame rate is not a contract: a software renderer may deliver very few
  // frames. Assert the state machine, which is deterministic, plus that time
  // accumulates while playing and holds still while paused.
  expect((await readOrbit(page))?.playing).toBe(false);

  await post(page, { type: "play" });
  expect((await readOrbit(page))?.playing).toBe(true);
  await expect.poll(async () => (await readOrbit(page))?.elapsed ?? 0, { timeout: 30_000 }).toBeGreaterThan(0);

  await post(page, { type: "pause" });
  expect((await readOrbit(page))?.playing).toBe(false);
  const frozen = (await readOrbit(page))!.elapsed;
  await page.waitForTimeout(750);
  expect((await readOrbit(page))!.elapsed).toBe(frozen);

  // Resuming continues from where it stopped rather than restarting at zero.
  await post(page, { type: "play" });
  await expect.poll(async () => (await readOrbit(page))?.elapsed ?? 0, { timeout: 30_000 }).toBeGreaterThan(frozen);

  // A spin command parks the orbit rather than fighting it.
  await post(page, { type: "spin", progress: 0.5 });
  expect((await readOrbit(page))?.playing).toBe(false);
});

test("the interactive shell still drags, and repaints when it does", async ({ page }) => {
  await page.goto(`${SHELL}?asset=power`);
  await waitForScene(page);
  await page.waitForTimeout(500);

  await expect(page.locator("#hint")).toBeVisible();

  // Neither mode runs a permanent render loop now, so the failure mode is a
  // camera that moves while the canvas keeps showing the old frame. Camera
  // state cannot catch that; only pixels can. Assert both.
  const canvas = page.locator("canvas");
  const pixelsBefore = await canvas.screenshot();
  const before = (await readCameraState(page))!;

  await page.mouse.move(400, 300);
  await page.mouse.down();
  await page.mouse.move(650, 360, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(500);

  expect((await readCameraState(page))!.theta).not.toBeCloseTo(before.theta, 3);
  expect((await canvas.screenshot()).equals(pixelsBefore)).toBe(false);
});

test("the showcase orbits while on screen and pauses once it scrolls away", async ({ page }) => {
  await page.goto("/");

  const showcase = page.locator("[data-board-showcase]");
  await showcase.scrollIntoViewIfNeeded();
  await expect(page.frameLocator("[data-board-showcase] iframe").locator("#viewer canvas")).toBeAttached({
    timeout: 60_000,
  });

  const frame = cinematicFrame(page);
  expect(frame).toBeTruthy();
  await waitForScene(frame!);

  // On screen: playing, with no scrolling involved at all.
  await expect.poll(async () => (await readOrbit(frame!))?.playing, { timeout: 30_000 }).toBe(true);

  // Scrolled away: paused. The board sits near the top of the page, so the
  // contact section is well past it.
  await page.locator("[data-section='contact']").scrollIntoViewIfNeeded();
  await expect(showcase).not.toBeInViewport();
  await expect.poll(async () => (await readOrbit(frame!))?.playing, { timeout: 30_000 }).toBe(false);

  // And it stays parked rather than drifting on.
  const parked = (await readOrbit(frame!))!.elapsed;
  await page.waitForTimeout(750);
  expect((await readOrbit(frame!))!.elapsed).toBe(parked);
});

test("reduced motion holds the board on the mid-orbit pose", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto("/");

  await page.locator("[data-board-showcase]").scrollIntoViewIfNeeded();
  await expect(page.frameLocator("[data-board-showcase] iframe").locator("#viewer canvas")).toBeAttached({
    timeout: 60_000,
  });

  const frame = cinematicFrame(page);
  await waitForScene(frame!);

  // Not merely "unchanging" - it must be parked on the mid-orbit pose, which is
  // what the spec asks for. A component that sent nothing would sit at progress
  // 0 and still look static.
  await expect
    .poll(async () => (await readCameraState(frame!))!.theta, { timeout: 30_000 })
    .toBeCloseTo(MID_ORBIT_THETA, 3);
  expect((await readOrbit(frame!))?.playing).toBe(false);

  await context.close();
});

test("tour stops land on the board where the BOM says they do", async ({ page }) => {
  await page.goto(`${SHELL}?asset=control&mode=cinematic&probe=level-shift`);
  await waitForScene(page);

  const probe = await page
    .waitForFunction(() => (window as unknown as { __boardProbe?: () => unknown }).__boardProbe?.(), null, {
      timeout: 30_000,
    })
    .then((handle) => handle.jsonValue() as Promise<{ id: string; world: { x: number; y: number; z: number } }>);

  expect(probe.id).toBe("level-shift");

  // A y-sign error would put this at x = +25.455 instead of -25.455, so assert
  // the signed component. Magnitude alone cannot catch it: hypot is invariant
  // under the negation that a FLIP_Y error produces.
  expect(probe.world.x).toBeCloseTo(-25.455, 1);
  expect(probe.world.z).toBeCloseTo(-10.591, 1);
});

test("the shell's tour timeline matches the pinned fixture table", async ({ page }) => {
  await page.goto(CINEMATIC);
  await waitForScene(page);

  // The shell owns the only copy of this arithmetic; this test pins it
  // directly against the fixture table below.
  const timing = await page.evaluate(() => (window as unknown as { __tourTiming?: unknown }).__tourTiming);
  expect(timing).toEqual({ orbitMs: 12000, travelMs: 1500, holdMs: 3000 });

  const phases = await page.evaluate(() => {
    const fn = (window as unknown as { __tourPhase?: (e: number, n: number, t: unknown) => unknown }).__tourPhase!;
    const t = (window as unknown as { __tourTiming?: unknown }).__tourTiming;
    return [0, 6000, 12750, 15000, 17250, 35250].map((ms) => fn(ms, 5, t));
  });

  expect(phases).toEqual([
    { kind: "orbit", progress: 0 },
    { kind: "orbit", progress: 0.5 },
    { kind: "travel", from: -1, to: 0, progress: 0.5 },
    { kind: "hold", stop: 0, progress: 0.5 },
    { kind: "travel", from: 0, to: 1, progress: 0.5 },
    { kind: "travel", from: 4, to: -1, progress: 0.5 },
  ]);
});

test("the tour halts the orbit on each stop and names the part", async ({ page }) => {
  await page.goto(`${SHELL}?asset=control&mode=cinematic`);
  await waitForScene(page);

  const readTour = () =>
    page.evaluate(
      () => (window as unknown as { __boardTour?: () => { phase: string; stop: number; label: string | null } }).__boardTour?.(),
    );

  // Nothing runs until play, so the tour starts in its orbit phase.
  expect((await readTour())?.phase).toBe("orbit");

  await page.evaluate(() => window.postMessage({ type: "play" }, window.location.origin));

  // The first stop is the STM32, and its label must appear while the camera
  // holds on it. The orbit leg is 12s, so allow for it plus the travel.
  await expect.poll(async () => (await readTour())?.label, { timeout: 45_000 }).toBe("STM32G474");
  await expect(page.locator("#stop-label")).toHaveClass(/visible/);
  await expect(page.locator("#stop-title")).toHaveText("STM32G474");

  // Pausing must clear the label rather than leave it stranded.
  await page.evaluate(() => window.postMessage({ type: "pause" }, window.location.origin));
  await expect(page.locator("#stop-label")).not.toHaveClass(/visible/);
});

test("a board with no tour file just orbits", async ({ page }) => {
  // Only the control board has a tour. The power board must not error.
  const failures: string[] = [];
  page.on("pageerror", (error) => failures.push(error.message));

  await page.goto(CINEMATIC);
  await waitForScene(page);

  const tour = await page.evaluate(
    () => (window as unknown as { __boardTour?: () => { phase: string; stop: number } }).__boardTour?.(),
  );
  expect(tour?.phase).toBe("orbit");
  expect(tour?.stop).toBe(-1);
  expect(failures).toEqual([]);
});

// The last two load no WebGL scene at all, which is why they stay separate:
// they assert what happens BEFORE the iframe is ever mounted.

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
  await expect.poll(() => requested, { timeout: 60_000 }).toBe(1);
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
  await expect(page.locator("[data-board-showcase] iframe")).toHaveCount(1, { timeout: 60_000 });
});
