import { test, expect } from "@playwright/test";

// The trace measures section spacing at runtime and silently renders nothing
// when the gaps collapse, so a layout regression is invisible without this.
test("the circuit trace renders its power chain on desktop", async ({ page }) => {
  await page.goto("/");

  const trace = page.locator("svg[data-circuit-trace]");
  await expect(trace).toBeAttached();

  // One IC block drops into each usable gap between the six sections.
  await expect.poll(async () => trace.locator("path").count()).toBeGreaterThan(20);

  // The rail narrative each block advances, in order.
  for (const net of ["AC IN", "+12V", "+3V3", "+1V8", "GND"]) {
    await expect(trace.getByText(net, { exact: true }).first()).toBeAttached();
  }
});

test("the trace is not rendered or animated on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator("svg[data-circuit-trace]")).toHaveCount(0);
});
