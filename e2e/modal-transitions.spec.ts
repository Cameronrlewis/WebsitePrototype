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
  // Scope to the modal's viewer: the home page also carries the cinematic
  // showcase iframe, so a bare "iframe" locator matches two elements.
  await expect(page.locator('iframe[title$="3D board viewer"]')).toBeVisible();

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

test("report viewer returns to the project modal that opened it", async ({ page }) => {
  await page.goto("/#/projects/dji-m600-sensor-mount");

  const modal = page.getByRole("dialog");
  await expect(modal).toBeVisible();

  await page.getByRole("button", { name: "View Report" }).click();
  await expect(page.getByRole("button", { name: "View Report" })).toBeHidden();

  await page.getByRole("button", { name: "Close" }).click();

  // openReport used to skip the returnProject mechanism, leaving nothing on screen.
  await expect(modal).toBeVisible();
  await expect(page.getByRole("button", { name: "View Report" })).toBeVisible();
});

test("organization opened from a project modal returns to that project", async ({ page }) => {
  await page.goto("/#/projects/aux-control-board");

  await page.getByRole("button", { name: /Open .* Context/ }).click();
  await expect(page.getByRole("dialog")).toContainText("Paradigm Engineering");
  // The project modal is closed, not merely aria-hidden behind the organization.
  await expect(page.locator('[role="dialog"]')).toHaveCount(1);

  await page.getByRole("button", { name: "Close" }).click();

  // openOrganization(project, true) must stash the project and restore it on close.
  await expect(page.getByRole("button", { name: "Explore 3D Board" })).toBeVisible();
});
