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
 * time, and the budget is raised to match the software renderer: waitForScene
 * alone may spend 60s of it before a test has asserted anything.
 */
test.describe.configure({ mode: "serial", timeout: 150_000 });

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

// The tour hooks the cinematic shell exposes. __applyTour and __tourTiming are
// optional because they only appear once the tour file has been fetched.
interface TourHooks {
  __boardTour: () => { phase: string; stop: number; from: number | null; label: string | null };
  __applyTour?: (elapsedMs: number) => void;
  __tourTiming?: { orbitMs: number; travelMs: number; holdMs: number };
}

function readTour(target: Page | Frame) {
  return target.evaluate(() => (window as unknown as Partial<TourHooks>).__boardTour?.());
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

function cinematicFrameFor(page: Page, asset: string) {
  return page.frames().find((candidate) => candidate.url().includes(`asset=${asset}&mode=cinematic`));
}

// The iframe being attached to the DOM does not guarantee its child frame has
// committed a navigation to its src yet, so page.frames() can still miss it
// for a moment. Poll rather than read once.
async function waitForCinematicFrame(page: Page, asset: string) {
  await expect.poll(() => Boolean(cinematicFrameFor(page, asset)), { timeout: 30_000 }).toBe(true);
  return cinematicFrameFor(page, asset)!;
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

test("the showcase orbits while on screen, pauses off screen, and hands over to the next board", async ({ page }) => {
  // Two boards mean two scenes on a software renderer, so this one test asks
  // for its own 450s (test.describe.configure's 150_000ms timeout is per
  // test, not a shared file budget) rather than being split up.
  test.slow();

  await page.goto("/");

  const showcase = page.locator("[data-board-showcase]");
  await showcase.scrollIntoViewIfNeeded();
  await expect(page.frameLocator("[data-board-frame='control'] iframe").locator("#viewer canvas")).toBeAttached({
    timeout: 60_000,
  });

  const control = await waitForCinematicFrame(page, "control");
  await waitForScene(control);

  // On screen: the first board plays, with no scrolling involved at all.
  await expect.poll(async () => (await readOrbit(control!))?.playing, { timeout: 30_000 }).toBe(true);

  // The second board is mounted only once the first is ready, so its 4MB of
  // geometry never competes with the first paint.
  await expect(page.locator("[data-board-frame='brick'] iframe")).toBeAttached({ timeout: 30_000 });

  // Scrolled away: paused. The board sits near the top of the page, so the
  // contact section is well past it.
  await page.locator("[data-section='contact']").scrollIntoViewIfNeeded();
  await expect(showcase).not.toBeInViewport();
  await expect.poll(async () => (await readOrbit(control!))?.playing, { timeout: 30_000 }).toBe(false);

  // And it stays parked rather than drifting on.
  const parked = (await readOrbit(control!))!.elapsed;
  await page.waitForTimeout(750);
  expect((await readOrbit(control!))!.elapsed).toBe(parked);

  // Back on screen, and the control tour runs to the end of its cycle: four
  // stops is 25.5s, so this waits out one whole pass plus slack.
  await showcase.scrollIntoViewIfNeeded();
  const brick = await waitForCinematicFrame(page, "brick");
  await waitForScene(brick);

  // The handover: the brick board takes over and the control board stops.
  // Polled rather than timed, because a software renderer advances the
  // timeline in wall-clock time but delivers frames far slower than 60fps.
  await expect.poll(async () => (await readOrbit(brick!))?.playing, { timeout: 90_000 }).toBe(true);
  expect((await readOrbit(control!))?.playing).toBe(false);

  // The caption follows the board that is actually on screen.
  await expect(showcase).toContainText("Brick Buck Board");
});

test("reduced motion holds the board on the mid-orbit pose", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto("/");

  await page.locator("[data-board-showcase]").scrollIntoViewIfNeeded();
  await expect(page.frameLocator("[data-board-frame='control'] iframe").locator("#viewer canvas")).toBeAttached({
    timeout: 60_000,
  });

  const frame = await waitForCinematicFrame(page, "control");
  await waitForScene(frame);

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

test("the brick board's tour aims at the part the BOM puts there", async ({ page }) => {
  await page.goto(`${SHELL}?asset=brick&mode=cinematic&probe=brick-converter`);
  await waitForScene(page);

  const probe = await page
    .waitForFunction(() => (window as unknown as { __boardProbe?: () => unknown }).__boardProbe?.(), null, {
      timeout: 30_000,
    })
    .then((handle) => handle.jsonValue() as Promise<{ id: string; world: { x: number; y: number; z: number } }>);

  expect(probe.id).toBe("brick-converter");

  // Signed, not hypot: a y-sign error in the IBOM-to-model conversion mirrors
  // the stop across the board and leaves the distance from the origin intact.
  // These are the coordinates the Mornsun brick was confirmed to sit at by
  // rendering the stop straight down and looking at the part under it.
  expect(probe.world.x).toBeCloseTo(54.8, 1);
  expect(probe.world.z).toBeCloseTo(0.9, 1);
});

test("the shell's tour timeline matches the pinned fixture table", async ({ page }) => {
  await page.goto(CINEMATIC);
  await waitForScene(page);

  // The shell owns the only copy of this arithmetic; this test pins it
  // directly against the fixture table below.
  const timing = await page.evaluate(() => (window as unknown as { __tourTiming?: unknown }).__tourTiming);
  expect(timing).toEqual({ orbitMs: 6000, travelMs: 1500, holdMs: 3000 });

  const phases = await page.evaluate(() => {
    const fn = (window as unknown as { __tourPhase?: (e: number, n: number, t: unknown) => unknown }).__tourPhase!;
    const t = (window as unknown as { __tourTiming?: unknown }).__tourTiming;
    return [0, 3000, 6750, 9000, 11250, 24750].map((ms) => fn(ms, 4, t));
  });

  expect(phases).toEqual([
    { kind: "orbit", progress: 0 },
    { kind: "orbit", progress: 0.5 },
    { kind: "travel", from: -1, to: 0, progress: 0.5 },
    { kind: "hold", stop: 0, progress: 0.5 },
    { kind: "travel", from: 0, to: 1, progress: 0.5 },
    { kind: "travel", from: 3, to: -1, progress: 0.5 },
  ]);
});

test("the shell announces each completed tour cycle to its host", async ({ page }) => {
  await page.goto(CINEMATIC);
  await waitForScene(page);

  // The cycle length is the timeline's own arithmetic, so it is pinned here
  // rather than recomputed in the component that consumes the message.
  const cycles = await page.evaluate(() => {
    const fn = (window as unknown as { __tourCycleMs?: (n: number, t: unknown) => number }).__tourCycleMs!;
    const t = (window as unknown as { __tourTiming?: unknown }).__tourTiming;
    return [fn(0, t), fn(4, t), fn(5, t)];
  });

  // No stops: the bare orbit is the whole cycle. Otherwise orbit, then a
  // travel and a hold per stop, then the travel back out to the orbit.
  expect(cycles).toEqual([6000, 6000 + 4 * 4500 + 1500, 6000 + 5 * 4500 + 1500]);

  // And the message actually fires. The power board has no tour file, so its
  // cycle is the bare 6s orbit: one wrap is cheap to wait for.
  const announced = await page.evaluate(() => {
    return new Promise<string>((resolve, reject) => {
      const deadline = setTimeout(() => reject(new Error("no tour-cycle message within 40s")), 40_000);
      window.addEventListener("message", function onMessage(event) {
        if ((event.data as { type?: unknown } | null)?.type !== "tour-cycle") {
          return;
        }

        window.removeEventListener("message", onMessage);
        clearTimeout(deadline);
        resolve("tour-cycle");
      });

      window.postMessage({ type: "play" }, window.location.origin);
    });
  });

  expect(announced).toBe("tour-cycle");
});

test("a slow tour fetch does not post a premature tour-cycle before it settles", async ({ page }) => {
  // The bug this guards: while the fetch is in flight, tourStops is still
  // empty, so the shell would compute the bare 6s orbit as the whole cycle
  // and announce a wrap at 6s even though the real, stop-filled timeline
  // (once the fetch lands) is longer. Delay the response comfortably past
  // that 6s mark so a regression has time to fire within the watch window.
  //
  // Sized off orbitMs, not scaled with it: the watch window is orbitMs plus
  // 500ms and the delay is the window plus 1000ms, and those two margins are
  // absolute slack for a starved CI runner rather than fractions of the
  // orbit. Halving them with the orbit would have bought ~750ms and made a
  // deploy-gating test flakier.
  const FETCH_DELAY_MS = 7_500;

  await page.route("**/tours/control.tour.json", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, FETCH_DELAY_MS));
    await route.continue();
  });

  await page.goto(`${SHELL}?asset=control&mode=cinematic`);
  await waitForScene(page);

  // Watch from just after play starts for less than the fetch delay, so the
  // window closes before the delayed response can land and leaves a clean
  // reason for either outcome: an early message is the bug, silence for the
  // whole window is the fix.
  const outcome = await page.evaluate((watchMs) => {
    return new Promise<string>((resolve) => {
      const timer = setTimeout(() => resolve("no-early-message"), watchMs);
      window.addEventListener("message", function onMessage(event) {
        if ((event.data as { type?: unknown } | null)?.type !== "tour-cycle") {
          return;
        }

        window.removeEventListener("message", onMessage);
        clearTimeout(timer);
        resolve("tour-cycle");
      });

      window.postMessage({ type: "play" }, window.location.origin);
    });
  }, FETCH_DELAY_MS - 1000);

  expect(outcome).toBe("no-early-message");
});

test("the tour halts the orbit on each stop and names the part", async ({ page }) => {
  await page.goto(`${SHELL}?asset=control&mode=cinematic`);
  await waitForScene(page);

  // Nothing runs until play, so the tour starts in its orbit phase.
  expect((await readTour(page))?.phase).toBe("orbit");

  // Claim 1 pins the short-arc camera blend (blendPose in
  // board-viewer-shell.html): without wrapping the heading delta into
  // [-pi, pi], the orbit-into-first-stop leg sweeps nearly a full revolution
  // the long way round, so the largest heading offset from the orbit's end
  // pose seen in that leg exceeds pi. Walking the leg through __applyTour
  // rather than waiting for it keeps CI's starved frame budget out of it: the
  // leg is only travelMs wide and was missed on consecutive full cycles.
  const ORBIT_END_THETA = -0.5 + Math.PI * 2;

  // No stops until the tour file lands, and until then every elapsed time
  // still reports an orbit.
  await page.waitForFunction(() => {
    const view = window as unknown as TourHooks;
    if (!view.__applyTour || !view.__tourTiming) {
      return false;
    }

    view.__applyTour(view.__tourTiming.orbitMs + view.__tourTiming.travelMs / 2);
    return view.__boardTour().from === -1;
  });

  const maxOffset = await page.evaluate((orbitEnd: number) => {
    const view = window as unknown as Required<TourHooks> & { __boardViewerState: CameraState };
    const { orbitMs, travelMs } = view.__tourTiming;
    let worst = 0;

    // Half-open, as the leg itself is: at exactly orbitMs + travelMs the tour
    // is already holding, and a hold applies the stop's raw heading rather
    // than the blend's. That is the same camera angle the blend ends on, only
    // wrapped by 2pi, so including it would read a 6 rad jump that is not one.
    for (let step = 0; step < 60; step += 1) {
      view.__applyTour(orbitMs + (travelMs * step) / 60);
      worst = Math.max(worst, Math.abs(view.__boardViewerState.theta - orbitEnd));
    }

    return worst;
  }, ORBIT_END_THETA);

  expect(maxOffset).toBeLessThanOrEqual(Math.PI);

  // Claim 2 is the STM32 label on the first stop. Driven through __applyTour
  // for the same reason as claim 1: waiting for the real animation to reach
  // hold 0 spent a 70s budget on a starved runner and took the whole serial
  // group down with it. applyTour calls renderStopLabel synchronously in the
  // same call, so one evaluate can drive the timeline and read both the tour
  // state and the DOM it produced with no frame budget and no wall clock in
  // between. That is more atomic than the same-tick waitForFunction it
  // replaces, which still had to wait for a frame to arrive.
  //
  // The elapsed time is derived rather than hard-coded so it survives the next
  // timing change: the middle of the first hold is one orbit, one travel leg
  // and half a hold in.
  const label = await page.evaluate(() => {
    const view = window as unknown as Required<TourHooks>;
    const { orbitMs, travelMs, holdMs } = view.__tourTiming;
    view.__applyTour(orbitMs + travelMs + holdMs / 2);

    const tour = view.__boardTour();
    return {
      phase: tour.phase,
      stop: tour.stop,
      label: tour.label,
      visible: document.getElementById("stop-label")!.classList.contains("visible"),
      title: document.getElementById("stop-title")!.textContent,
    };
  });

  expect(label).toEqual({
    phase: "hold",
    stop: 0,
    label: "STM32G474",
    visible: true,
    title: "STM32G474",
  });

  // Pausing must clear the label rather than leave it stranded. The label is
  // genuinely visible above, so this still removes a class that is really set.
  await post(page, { type: "pause" });
  await expect(page.locator("#stop-label")).not.toHaveClass(/visible/);
});

test("a board with no tour file just orbits", async ({ page }) => {
  // The power board has no tour file, unlike the control and brick boards.
  // Its fetch 404s, and that must fall back to a plain orbit rather than error.
  const failures: string[] = [];
  page.on("pageerror", (error) => failures.push(error.message));

  await page.goto(CINEMATIC);
  await waitForScene(page);

  const tour = await readTour(page);
  expect(tour?.phase).toBe("orbit");
  expect(tour?.stop).toBe(-1);
  expect(failures).toEqual([]);
});

test("a board that fails to load geometry does not become a dead end for the cycle", async ({ page }) => {
  // Fail only the brick board's geometry fetch, so its shell can never build
  // a scene and can never post tour-cycle on its own.
  await page.route("**/geometry/brick.pcbgeo", (route) => route.abort());

  await page.goto("/");
  const showcase = page.locator("[data-board-showcase]");
  await showcase.scrollIntoViewIfNeeded();

  const control = await waitForCinematicFrame(page, "control");
  await waitForScene(control);

  const brick = await waitForCinematicFrame(page, "brick");

  // Confirm the failure actually landed: the brick shell shows its own error
  // card rather than ever building a scene.
  await expect
    .poll(
      async () =>
        brick.evaluate(() => {
          const card = document.getElementById("error");
          return Boolean(card && card.classList.contains("visible"));
        }),
      { timeout: 30_000 },
    )
    .toBe(true);

  // The real trigger for a handover is the control board's own tour wrapping,
  // which takes a genuine 25.5s. This file already spends that time once in
  // "hands over to the next board" above, and doing it again here would add
  // another ~40s to the deploy-gating e2e:preview run for no new coverage of
  // the timing itself. So this simulates the boundary the same way the shell
  // signals it - posting the exact message type, origin, and source window
  // it posts when its own timeline wraps - which exercises the real
  // onCycleEnd/advance code path without waiting out the wall-clock timer.
  await control.evaluate(() => window.parent.postMessage({ type: "tour-cycle" }, window.location.origin));
  await page.waitForTimeout(500);

  // The broken board must never become the active one: the showcase still
  // shows, and keeps playing, the control board.
  await expect(showcase).toContainText("Aux Control Board");
  expect((await readOrbit(control))?.playing).toBe(true);
});

test("a board that fails to load geometry while it is the active one hands over on its own", async ({ page }) => {
  // Here it is the lead board itself - the one active from the start - that
  // fails. Nothing else in the system can ever trigger a handover away from
  // it: its own shell can never finish buildScene, so it can never enter its
  // orbit loop or post tour-cycle, and no other board's tour-cycle is wired
  // to it either. The recovery has to happen the moment the failure is known,
  // not on some later event that will never arrive.
  await page.route("**/geometry/control.pcbgeo", (route) => route.abort());

  await page.goto("/");
  const showcase = page.locator("[data-board-showcase]");
  await showcase.scrollIntoViewIfNeeded();

  const control = await waitForCinematicFrame(page, "control");

  // Confirm the failure actually landed on the board that starts active.
  await expect
    .poll(
      async () =>
        control.evaluate(() => {
          const card = document.getElementById("error");
          return Boolean(card && card.classList.contains("visible"));
        }),
      { timeout: 30_000 },
    )
    .toBe(true);

  // Assert on the board that ends up actually playing, not merely on the DOM
  // or the caption text alone - that is the only way to prove the cycle
  // really moved rather than the fallback iframe simply having mounted.
  const brick = await waitForCinematicFrame(page, "brick");
  await waitForScene(brick);
  await expect.poll(async () => (await readOrbit(brick))?.playing, { timeout: 30_000 }).toBe(true);
  await expect(showcase).toContainText("Brick Buck Board");
});

test("a failed lead board keeps the skeleton up until its fallback is actually ready", async ({ page }) => {
  // Deliberately held open rather than timed: the lead fails immediately
  // (aborted), and the fallback's geometry request is not allowed to
  // complete until this test says so. That makes the "still loading" window
  // exact rather than a guess at how long it takes in practice, so there is
  // nothing here for a slow runner to race.
  await page.route("**/geometry/control.pcbgeo", (route) => route.abort());
  let releaseBrick = () => {};
  const brickGate = new Promise<void>((resolve) => {
    releaseBrick = resolve;
  });
  await page.route("**/geometry/brick.pcbgeo", async (route) => {
    await brickGate;
    await route.continue();
  });

  await page.goto("/");
  const showcase = page.locator("[data-board-showcase]");
  await showcase.scrollIntoViewIfNeeded();

  // Confirm the lead's failure has actually landed (not just that the route
  // matched) before asserting on the skeleton - otherwise this assertion
  // could pass on a lucky read before the state update rather than because
  // the fix holds it up. This is exactly the point at which the old code
  // (skeleton tied to leadReady rather than to the active board's own
  // readiness) would have dismissed the skeleton already.
  const control = await waitForCinematicFrame(page, "control");
  await expect
    .poll(
      async () =>
        control.evaluate(() => {
          const card = document.getElementById("error");
          return Boolean(card && card.classList.contains("visible"));
        }),
      { timeout: 30_000 },
    )
    .toBe(true);

  // The lead has failed and the fallback is still being held back: there is
  // nothing ready to show, so the skeleton must still be up.
  await expect(showcase.locator(".skeleton-board")).toBeVisible();

  releaseBrick();

  // Once the fallback's geometry is allowed through and it reports ready,
  // the skeleton comes down - not before, per the fix.
  await expect(showcase.locator(".skeleton-board")).toBeHidden({ timeout: 30_000 });
});

// The last two load no WebGL scene at all, which is why they stay separate:
// they assert what happens BEFORE the iframe is ever mounted.

test("a short viewport does not fetch geometry until the block is scrolled to", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });

  // Scoped to the control board's geometry specifically: it is the lead board
  // and mounts first, but the brick board mounts right behind it once the
  // control board reports ready, so an unscoped counter would tick past 1 and
  // this assertion would only pass by catching a transient value.
  let requested = 0;
  page.on("request", (request) => {
    if (request.url().includes("control.pcbgeo")) {
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

  // Scoped to the control board specifically: once it reports ready the brick
  // board mounts right behind it, so an unscoped count of every showcase
  // iframe would tick past 1 and this would only pass by catching a
  // transient value.
  await page.goto("/", { waitUntil: "load" });
  await expect(page.locator("h1").first()).toBeVisible();
  expect(await page.locator("[data-board-frame='control'] iframe").count()).toBe(0);

  // It still mounts promptly once the browser goes idle, just not before.
  await expect(page.locator("[data-board-frame='control'] iframe")).toHaveCount(1, { timeout: 60_000 });
});
