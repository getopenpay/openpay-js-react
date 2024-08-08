import { test, expect } from "@playwright/test";

const IFRAME_SELECTOR = "iframe[name=card-cvc-element]";
const INPUT_SELECTOR = "input[name=card_cvc]";
const PAGE_PATH = "/elements/card-cvc";
const ERROR_MESSAGE_SELECTOR = "[data-testid=error-message]";
const ERROR_MESSAGE_TEXT = "Invalid CVV/CVC";

test.describe("Card CVC element", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PAGE_PATH);
  });

  test("should render card cvc element", async ({ page }) => {
    const element = page.locator(IFRAME_SELECTOR);
    await expect(element).toBeVisible();
  });

  test("should be able to focus on card cvc input", async ({ page }) => {
    const iframe = page.frameLocator(IFRAME_SELECTOR);
    const element = iframe.locator(INPUT_SELECTOR).first();
    await element.focus();
    await expect(element).toBeFocused();
  });

  test("should be able to input only valid number", async ({ page }) => {
    const iframe = page.frameLocator(IFRAME_SELECTOR);
    const clientFrameErrorMessage = page
      .locator(ERROR_MESSAGE_SELECTOR)
      .first();

    const cardCVC = iframe.locator(INPUT_SELECTOR).first();
    await cardCVC.fill("asdf");

    await expect(cardCVC).toHaveAttribute("aria-invalid", "true");
    await expect(clientFrameErrorMessage).toHaveText(ERROR_MESSAGE_TEXT);
  });

  const invalidCVCNumbers = ["32ee", "aaaa", "e12", "1e1", "1", "12", "24ee4"];
  invalidCVCNumbers.forEach(async (cvc) => {
    test(`should raise validation error when card cvc is invalid: [input:${cvc}]`, async ({
      page,
    }) => {
      const iframe = page.frameLocator(IFRAME_SELECTOR);
      const clientFrameErrorMessage = page
        .locator(ERROR_MESSAGE_SELECTOR)
        .first();

      const element = iframe.locator(INPUT_SELECTOR).first();
      await element.fill(cvc);
      await expect(element).toHaveAttribute("aria-invalid", "true");
      await expect(clientFrameErrorMessage).toHaveText(ERROR_MESSAGE_TEXT);
    });
  });

  const validCVCNumbers = [
    "123",
    "1234",
    "111",
    "12345",
    "123456",
    "123aaa",
    "1234aaa",
  ];
  validCVCNumbers.forEach(async (cvc) => {
    test(`should not raise validation error when card cvc is valid: [input:${cvc}]`, async ({
      page,
    }) => {
      const iframe = page.frameLocator(IFRAME_SELECTOR);
      const clientFrameErrorMessage = page
        .locator(ERROR_MESSAGE_SELECTOR)
        .first();

      const element = iframe.locator(INPUT_SELECTOR).first();
      await element.fill(cvc);
      // CVC should be truncated to max 4 characters
      await expect(element).toHaveValue(cvc.replace(/\D/g, "").slice(0, 4));
      await expect(element).not.toHaveAttribute("aria-invalid");
      await expect(clientFrameErrorMessage).toHaveText("");
    });
  });
});
