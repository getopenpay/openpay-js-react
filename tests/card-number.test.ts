import { test, expect } from '@playwright/test';
import {
  CARD_NUMBER_INPUT_SELECTOR,
  ERROR_MESSAGE_SELECTOR,
  INVALID_NUMBER_MESSAGE,
  invalidCardNumbers,
  validCardNumbers,
} from './constants';

const IFRAME_SELECTOR = 'iframe[name=card-number-element]';
const INPUT_SELECTOR = CARD_NUMBER_INPUT_SELECTOR;
const PAGE_PATH = '/elements/card-number';

test.describe('Card number element', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PAGE_PATH);
  });

  test('should render card number element', async ({ page }) => {
    const element = page.locator(IFRAME_SELECTOR);
    await expect(element).toBeVisible();
  });

  test('should be able to focus on card number', async ({ page }) => {
    const iframe = page.frameLocator(IFRAME_SELECTOR);
    const element = iframe.locator(INPUT_SELECTOR).first();
    await element.focus();
    await expect(element).toBeFocused();
  });

  test('should be able to fill card number', async ({ page }) => {
    const iframe = page.frameLocator(IFRAME_SELECTOR);
    const element = iframe.locator(INPUT_SELECTOR).first();
    await element.fill('4242424242424242');
    await expect(element).toHaveValue('4242 4242 4242 4242');
  });

  invalidCardNumbers.forEach(async (cardNumber) => {
    test(`should raise validation error when card expiry is invalid: [input:${cardNumber}]`, async ({ page }) => {
      const iframe = page.frameLocator(IFRAME_SELECTOR);
      const clientFrameErrorMessage = page.locator(ERROR_MESSAGE_SELECTOR).first();

      const element = iframe.locator(INPUT_SELECTOR).first();
      await element.fill(cardNumber);
      await expect(element).toHaveAttribute('aria-invalid', 'true');
      await expect(clientFrameErrorMessage).toHaveText(INVALID_NUMBER_MESSAGE);
    });
  });

  validCardNumbers.forEach(async (cardNumber) => {
    test(`should not raise validation error when card number is valid: [input:${cardNumber}]`, async ({ page }) => {
      const iframe = page.frameLocator(IFRAME_SELECTOR);
      const clientFrameErrorMessage = page.locator(ERROR_MESSAGE_SELECTOR).first();

      const element = iframe.locator(INPUT_SELECTOR).first();
      await element.fill(cardNumber);
      await expect(element).not.toHaveAttribute('aria-invalid');
      await expect(clientFrameErrorMessage).toHaveText('');
    });
  });
});
