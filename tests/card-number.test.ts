import { test, expect } from "@playwright/test";

const IFRAME_SELECTOR = "iframe[name=card-number-element]";
const INPUT_SELECTOR = "input[name=card_number]";
const PAGE_PATH = "/elements/card-number";
const ERROR_MESSAGE_SELECTOR = "[data-testid=error-message]";
const ERROR_MESSAGE_TEXT = "Invalid card number";

test.describe("Card number element", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PAGE_PATH);
  });

  test("should render card number element", async ({ page }) => {
    const element = page.locator(IFRAME_SELECTOR);
    await expect(element).toBeVisible();
  });

  test("should be able to focus on card number", async ({ page }) => {
    const iframe = page.frameLocator(IFRAME_SELECTOR);
    const element = iframe.locator(INPUT_SELECTOR).first();
    await element.focus();
    await expect(element).toBeFocused();
  });

  const invalidCardNumbers = [
    "4242424242424241",
    "5555 5555 5555 6666",
    "371449a635398431",
    "37144-963539-8431",
  ];
  invalidCardNumbers.forEach(async (cardNumber) => {
    test(`should raise validation error when card expiry is invalid: [input:${cardNumber}]`, async ({
      page,
    }) => {
      const iframe = page.frameLocator(IFRAME_SELECTOR);
      const clientFrameErrorMessage = page
        .locator(ERROR_MESSAGE_SELECTOR)
        .first();

      const element = iframe.locator(INPUT_SELECTOR).first();
      await element.fill(cardNumber);
      await expect(element).toHaveAttribute("aria-invalid", "true");
      await expect(clientFrameErrorMessage).toHaveText(ERROR_MESSAGE_TEXT);
    });
  });

  const validCardNumbers = [
    "4443 2338 3330 3641",
    "4242424242424242",
    "5523 3657 4787 2301",
    "3671 5815 4264 223xxx",
    "4587517354648608",
  ];
  validCardNumbers.forEach(async (cardNumber) => {
    test(`should not raise validation error when card number is valid: [input:${cardNumber}]`, async ({
      page,
    }) => {
      const iframe = page.frameLocator(IFRAME_SELECTOR);
      const clientFrameErrorMessage = page
        .locator(ERROR_MESSAGE_SELECTOR)
        .first();

      const element = iframe.locator(INPUT_SELECTOR).first();
      await element.fill(cardNumber);
      await expect(element).not.toHaveAttribute("aria-invalid");
      await expect(clientFrameErrorMessage).toHaveText("");
    });
  });
});
