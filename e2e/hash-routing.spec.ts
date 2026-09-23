import { test, expect } from "@playwright/test";

test("skip link keeps a deep-linked project open, and #/updates swaps in the Updates view", async ({ page }) => {
  await page.goto("/#/projects/aux-control-board");

  const modal = page.getByRole("dialog");
  await expect(modal).toBeVisible();

  // The open Radix dialog makes the rest of the page inert, so activate the
  // skip link in-page rather than through a pointer click. Resolve only after
  // the hashchange has fired and React has had a task and two frames to
  // handle it, so a wrongly-routed "#main-content" has already closed the
  // dialog by the time we assert.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        window.addEventListener(
          "hashchange",
          () => setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
          { once: true },
        );
        document.querySelector<HTMLAnchorElement>("a.skip-link")!.click();
      }),
  );
  // data-state flips to "closed" the moment the dialog is told to close, even
  // while its exit animation still keeps it visible.
  await expect(modal).toHaveAttribute("data-state", "open");

  await page.evaluate(() => {
    window.location.hash = "#/updates";
  });
  await expect(page.locator("main h1")).toHaveText("Updates");
  await expect(page.locator('[data-section="home"]')).toHaveCount(0);
  await expect(modal).toBeHidden();
});
