import { test, expect } from "@playwright/test";

test("resume viewer shows the page-1 raster with PDF escape hatches", async ({ page }) => {
  await page.goto("/");

  // The home hero has a "Resume" button; several other surfaces reuse the same
  // handler, so scope to the first.
  await page.getByRole("button", { name: "Resume" }).first().click();

  const modal = page.getByRole("dialog");
  await expect(modal).toBeVisible();
  await expect(modal.getByText("Cameron Lewis - Resume")).toBeVisible();

  // The preview renders as an image and actually decodes (naturalWidth > 0
  // catches a 404 that would otherwise leave a silent broken-image box).
  const preview = modal.getByRole("img", { name: /Cameron Lewis resume, page 1/ });
  await expect(preview).toBeVisible();
  await expect
    .poll(() => preview.evaluate((el: HTMLImageElement) => el.naturalWidth))
    .toBeGreaterThan(0);

  // Both PDF routes are wired to the real document.
  await expect(modal.getByRole("link", { name: "Download" })).toHaveAttribute(
    "href",
    /\/portfolio\/assets\/documents\/resume\/cameron-lewis-resume\.pdf$/,
  );
  const openPdf = modal.getByRole("link", { name: "Open PDF" });
  await expect(openPdf).toHaveAttribute("target", "_blank");
  await expect(openPdf).toHaveAttribute(
    "href",
    /\/portfolio\/assets\/documents\/resume\/cameron-lewis-resume\.pdf$/,
  );

  // Pagination and zoom are gone; nothing should hint at multi-page controls.
  await expect(modal.getByText(/Page \d+ of \d+/)).toHaveCount(0);
  await expect(modal.getByRole("button", { name: "Next" })).toHaveCount(0);
  await expect(modal.getByRole("button", { name: "Fit" })).toHaveCount(0);
});

test("resume viewer loads no PDF.js worker", async ({ page }) => {
  const pdfjsRequests: string[] = [];
  page.on("request", (request) => {
    const url = request.url();
    if (/pdf\.worker|pdfjs/i.test(url)) pdfjsRequests.push(url);
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Resume" }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("img", { name: /Cameron Lewis resume, page 1/ }),
  ).toBeVisible();

  expect(pdfjsRequests).toEqual([]);
});
