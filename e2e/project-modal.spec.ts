import { test, expect } from "@playwright/test";

test("project modal reappears after closing the 3D board viewer", async ({ page }) => {
  await page.goto("/#/projects/aux-control-board");

  // Project modal should be open on direct deep link.
  const modal = page.getByRole("dialog");
  await expect(modal).toBeVisible();

  // Open the 3D board viewer from within the modal.
  await page.getByRole("button", { name: "Explore 3D Board" }).click();

  // The board viewer should now be visible and the project modal replaced.
  const viewer = page.locator("iframe");
  await expect(viewer).toBeVisible();

  // Close the viewer (Radix dialog close button, accessible name "Close").
  await page.getByRole("button", { name: "Close" }).click();

  // The project modal should reappear.
  await expect(modal).toBeVisible();
  await expect(page.getByRole("button", { name: "Explore 3D Board" })).toBeVisible();
});
