import { test, expect } from "@playwright/test";

test("hero board viewer returns to the page, not a modal", async ({ page }) => {
  await page.goto("/");

  // The hero button opens the board viewer for featuredBoardProjects[0].
  await page.getByRole("button", { name: "Inspect a board in 3D" }).click();

  // The viewer should be the only dialog, and its board should be mounted.
  const viewer = page.getByRole("dialog");
  await expect(viewer).toBeVisible();
  await expect(viewer.locator("iframe")).toBeVisible();

  await page.getByRole("button", { name: "Close" }).click();

  // Nothing launched the viewer, so closing it returns to the page.
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("board viewer hands off to the BOM and still returns to the project modal", async ({ page }) => {
  await page.goto("/#/projects/aux-control-board");

  await page.getByRole("button", { name: "Explore 3D Board" }).click();
  await expect(page.locator("iframe")).toBeVisible();

  // Toolbar handoff: board viewer -> BOM viewer, via transferViewer.
  await page.getByRole("button", { name: "Interactive BOM" }).click();
  await expect(page.getByRole("dialog")).toContainText("Interactive BOM");

  await page.getByRole("button", { name: "Close" }).click();

  // The handoff must carry the return target across both viewers.
  await expect(page.getByRole("button", { name: "Explore 3D Board" })).toBeVisible();
});

test("organization opened from a project card returns to the page", async ({ page }) => {
  await page.goto("/#/projects");

  // Scope to one card - the organization header repeats across cards.
  const card = page.locator("article").filter({ hasText: "Aux Control Board" });
  await card.getByRole("button", { name: "Paradigm Engineering" }).click();

  const modal = page.getByRole("dialog");
  await expect(modal).toBeVisible();
  await expect(modal).toContainText("Paradigm Engineering");

  await page.getByRole("button", { name: "Close" }).click();

  // The card's stretched title link must not have swallowed the click.
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Explore 3D Board" })).toHaveCount(0);
});
