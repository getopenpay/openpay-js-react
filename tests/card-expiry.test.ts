import { test, expect } from "@playwright/test";

const IFRAME_SELECTOR = "iframe[name=card-expiry-element]";
const INPUT_SELECTOR = "input[name=card_expiry]";
const PAGE_PATH = "/elements/card-expiry";
const ERROR_MESSAGE_SELECTOR = "[data-testid=error-message]";
const ERROR_MESSAGE_TEXT = "Invalid card expiry";

test.describe("Card expiry element", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PAGE_PATH);
  });

  test("should render card expiry element", async ({ page }) => {
    const element = page.locator(IFRAME_SELECTOR);
    await expect(element).toBeVisible();
  });

  test("should be able to focus on card expiry", async ({ page }) => {
    const iframe = page.frameLocator(IFRAME_SELECTOR);
    const element = iframe.locator(INPUT_SELECTOR).first();
    await element.focus();
    await expect(element).toBeFocused();
  });

  const invalidExpiryDates = [
    "12/2020",
    "12/2021",
    "12/2022",
    "122023",
    "13/2025",
    "12/202",
    "1220",
    "12/2",
    "12/",
    "12",
    "1",
  ];

  invalidExpiryDates.forEach(async (expiryDate) => {
    test(`should raise validation error when card expiry is invalid: [input:${expiryDate}]`, async ({
      page,
    }) => {
      const iframe = page.frameLocator(IFRAME_SELECTOR);
      const clientFrameErrorMessage = page
        .locator(ERROR_MESSAGE_SELECTOR)
        .first();

      const cardExpiry = iframe.locator(INPUT_SELECTOR).first();
      await cardExpiry.fill(expiryDate);
      await expect(cardExpiry).toHaveAttribute("aria-invalid", "true");
      await expect(clientFrameErrorMessage).toHaveText(ERROR_MESSAGE_TEXT);
    });
  });

  const validExpiryDates = ["12/2024", "12/2025", "122026", "082027"];
  validExpiryDates.forEach(async (expiryDate) => {
    test(`should not raise validation error when card expiry is valid: [input:${expiryDate}]`, async ({
      page,
    }) => {
      const iframe = page.frameLocator(IFRAME_SELECTOR);
      const clientFrameErrorMessage = page
        .locator(ERROR_MESSAGE_SELECTOR)
        .first();

      const cardExpiry = iframe.locator(INPUT_SELECTOR).first();
      await cardExpiry.fill(expiryDate);
      await expect(cardExpiry).not.toHaveAttribute("aria-invalid");
      await expect(clientFrameErrorMessage).toHaveText("");
    });
  });
});
