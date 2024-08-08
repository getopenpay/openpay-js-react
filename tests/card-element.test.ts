import { test, expect } from "@playwright/test";

const IFRAME_SELECTOR = "iframe[name=card-element]";
const PAGE_PATH = "/elements/card";
const ERROR_MESSAGE_SELECTOR = "[data-testid=error-message]";

test.describe("Card element", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PAGE_PATH);
  });

  test("should render card element", async ({ page }) => {
    const cardElement = page.locator(IFRAME_SELECTOR);
    await expect(cardElement).toBeVisible();
  });

  test("should contain all card elements", async ({ page }) => {
    const iframe = page.frameLocator("iframe[name=card-element]");
    const cardNumber = iframe.locator("input[name=card_number]").first();
    const cardExpiry = iframe.locator("input[name=card_expiry]").first();
    const cardCvc = iframe.locator("input[name=card_cvc]").first();
    await expect(cardNumber).toBeVisible();
    await expect(cardExpiry).toBeVisible();
    await expect(cardCvc).toBeVisible();
  });

  test("should be able to focus on all elements", async ({ page }) => {
    const iframe = page.frameLocator("iframe[name=card-element]");
    const cardNumber = iframe.locator("input[name=card_number]").first();
    const cardExpiry = iframe.locator("input[name=card_expiry]").first();
    const cardCvc = iframe.locator("input[name=card_cvc]").first();

    await cardNumber.focus();
    await expect(cardNumber).toBeFocused();

    await cardExpiry.focus();
    await expect(cardExpiry).toBeFocused();

    await cardCvc.focus();
    await expect(cardCvc).toBeFocused();
  });

  test("should be able to change focus with keyboard tab key", async ({
    page,
  }) => {
    const iframe = page.frameLocator("iframe[name=card-element]");
    const cardNumber = iframe.locator("input[name=card_number]").first();
    const cardExpiry = iframe.locator("input[name=card_expiry]").first();
    const cardCvc = iframe.locator("input[name=card_cvc]").first();

    await cardNumber.focus();
    await expect(cardNumber).toBeFocused();

    await page.keyboard.press("Tab");
    await expect(cardExpiry).toBeFocused();

    await page.keyboard.press("Tab");
    await expect(cardCvc).toBeFocused();
  });

  const testCases = [
    {
      cardNumber: "4242424242424241",
      cardExpiry: "12/2020",
      cardCvc: "123",
      expected: {
        cardNumber: false,
        cardExpiry: false,
        cardCvc: true,
      },
    },
    {
      cardNumber: "4242424242424242",
      cardExpiry: "12/2021",
      cardCvc: "123",
      expected: {
        cardNumber: true,
        cardExpiry: false,
        cardCvc: true,
      },
    },
    {
      cardNumber: "4242424242424242",
      cardExpiry: "12/2022",
      cardCvc: "1234",
      expected: {
        cardNumber: true,
        cardExpiry: false,
        cardCvc: true,
      },
    },
    {
      cardNumber: "5555 5555 5555 6666",
      cardExpiry: "12/2022",
      cardCvc: "12",
      expected: {
        cardNumber: false,
        cardExpiry: false,
        cardCvc: false,
      },
    },
    {
      cardNumber: "371449a635398431",
      cardExpiry: "12/2022",
      cardCvc: "123",
      expected: {
        cardNumber: false,
        cardExpiry: false,
        cardCvc: true,
      },
    },
    {
      cardNumber: "5523 3657 4787 2301",
      cardExpiry: "042027",
      cardCvc: "987",
      expected: {
        cardNumber: true,
        cardExpiry: true,
        cardCvc: true,
      },
    },
    {
      cardNumber: "4587517354648608",
      cardExpiry: "09/2026",
      cardCvc: "087",
      expected: {
        cardNumber: true,
        cardExpiry: true,
        cardCvc: true,
      },
    },
  ];

  testCases.forEach((testCase, idx) => {
    test(`[Case: ${
      idx + 1
    }] should validate card number, expiry and cvc fields`, async ({
      page,
    }) => {
      const iframe = page.frameLocator("iframe[name=card-element]");
      const clientFrameErrorMessage = page.locator(ERROR_MESSAGE_SELECTOR);

      const cardNumber = iframe.locator("input[name=card_number]").first();
      const cardExpiry = iframe.locator("input[name=card_expiry]").first();
      const cardCvc = iframe.locator("input[name=card_cvc]").first();

      await cardNumber.fill(testCase.cardNumber);
      await cardExpiry.fill(testCase.cardExpiry);
      await cardCvc.fill(testCase.cardCvc);

      if (testCase.expected.cardNumber) {
        await expect(cardNumber).not.toHaveAttribute("aria-invalid");
      } else {
        await expect(cardNumber).toHaveAttribute("aria-invalid", "true");
      }

      if (testCase.expected.cardExpiry) {
        await expect(cardExpiry).not.toHaveAttribute("aria-invalid");
      } else {
        await expect(cardExpiry).toHaveAttribute("aria-invalid", "true");
      }

      if (testCase.expected.cardCvc) {
        await expect(cardCvc).not.toHaveAttribute("aria-invalid");
      } else {
        await expect(cardCvc).toHaveAttribute("aria-invalid", "true");
      }

      if (!testCase.expected.cardCvc) {
        await expect(clientFrameErrorMessage).toContainText("Invalid CVV/CVC");
      }
      if (!testCase.expected.cardExpiry) {
        await expect(clientFrameErrorMessage).toContainText(
          "Invalid card expiry"
        );
      }
      if (!testCase.expected.cardNumber) {
        await expect(clientFrameErrorMessage).toContainText(
          "Invalid card number"
        );
      }
      if (
        testCase.expected.cardNumber &&
        testCase.expected.cardExpiry &&
        testCase.expected.cardCvc
      ) {
        await expect(clientFrameErrorMessage).toHaveText("");
      }
    });
  });
});
