import { test, expect } from '@playwright/test';
import {
  CARD_CVC_INPUT_SELECTOR,
  CARD_EXPIRY_INPUT_SELECTOR,
  CARD_NUMBER_INPUT_SELECTOR,
  cardElementTestCases,
  ERROR_MESSAGE_SELECTOR,
  INVALID_CVC_MESSAGE,
  INVALID_EXPIRY_MESSAGE,
  INVALID_NUMBER_MESSAGE,
} from './constants';

const IFRAME_SELECTOR = 'iframe[name=card-element]';
const PAGE_PATH = '/elements/card';

test.describe('Card element', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PAGE_PATH);
  });

  test('should render card element', async ({ page }) => {
    const cardElement = page.locator(IFRAME_SELECTOR);
    await expect(cardElement).toBeVisible();
  });

  test('should contain all card elements', async ({ page }) => {
    const iframe = page.frameLocator(IFRAME_SELECTOR);
    const cardNumber = iframe.locator(CARD_NUMBER_INPUT_SELECTOR).first();
    const cardExpiry = iframe.locator(CARD_EXPIRY_INPUT_SELECTOR).first();
    const cardCvc = iframe.locator(CARD_CVC_INPUT_SELECTOR).first();
    await expect(cardNumber).toBeVisible();
    await expect(cardExpiry).toBeVisible();
    await expect(cardCvc).toBeVisible();
  });

  test('should be able to focus on all elements', async ({ page }) => {
    const iframe = page.frameLocator(IFRAME_SELECTOR);
    const cardNumber = iframe.locator(CARD_NUMBER_INPUT_SELECTOR).first();
    const cardExpiry = iframe.locator(CARD_EXPIRY_INPUT_SELECTOR).first();
    const cardCvc = iframe.locator(CARD_CVC_INPUT_SELECTOR).first();

    await cardNumber.focus();
    await expect(cardNumber).toBeFocused();

    await cardExpiry.focus();
    await expect(cardExpiry).toBeFocused();

    await cardCvc.focus();
    await expect(cardCvc).toBeFocused();
  });

  test('should be able to change focus with keyboard tab key', async ({ page }) => {
    const iframe = page.frameLocator(IFRAME_SELECTOR);
    const cardNumber = iframe.locator(CARD_NUMBER_INPUT_SELECTOR).first();
    const cardExpiry = iframe.locator(CARD_EXPIRY_INPUT_SELECTOR).first();
    const cardCvc = iframe.locator(CARD_CVC_INPUT_SELECTOR).first();

    await cardNumber.focus();
    await expect(cardNumber).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(cardExpiry).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(cardCvc).toBeFocused();
  });

  cardElementTestCases.forEach((testCase, idx) => {
    test(`should validate card number, expiry and cvc fields [test-case:${idx + 1}] `, async ({ page }) => {
      const iframe = page.frameLocator(IFRAME_SELECTOR);
      const clientFrameErrorMessage = page.locator(ERROR_MESSAGE_SELECTOR);

      const cardNumber = iframe.locator(CARD_NUMBER_INPUT_SELECTOR).first();
      const cardExpiry = iframe.locator(CARD_EXPIRY_INPUT_SELECTOR).first();
      const cardCvc = iframe.locator(CARD_CVC_INPUT_SELECTOR).first();

      await cardNumber.fill(testCase.cardNumber);
      await cardExpiry.fill(testCase.cardExpiry);
      await cardCvc.fill(testCase.cardCvc);

      if (testCase.expected.cardNumber) {
        await expect(cardNumber).not.toHaveAttribute('aria-invalid');
      } else {
        await expect(cardNumber).toHaveAttribute('aria-invalid', 'true');
      }

      if (testCase.expected.cardExpiry) {
        await expect(cardExpiry).not.toHaveAttribute('aria-invalid');
      } else {
        await expect(cardExpiry).toHaveAttribute('aria-invalid', 'true');
      }

      if (testCase.expected.cardCvc) {
        await expect(cardCvc).not.toHaveAttribute('aria-invalid');
      } else {
        await expect(cardCvc).toHaveAttribute('aria-invalid', 'true');
      }

      if (!testCase.expected.cardCvc) {
        await expect(clientFrameErrorMessage).toContainText(INVALID_CVC_MESSAGE);
      }
      if (!testCase.expected.cardExpiry) {
        await expect(clientFrameErrorMessage).toContainText(INVALID_EXPIRY_MESSAGE);
      }
      if (!testCase.expected.cardNumber) {
        await expect(clientFrameErrorMessage).toContainText(INVALID_NUMBER_MESSAGE);
      }
      if (testCase.expected.cardNumber && testCase.expected.cardExpiry && testCase.expected.cardCvc) {
        await expect(clientFrameErrorMessage).toHaveText('');
      }
    });
  });
});
