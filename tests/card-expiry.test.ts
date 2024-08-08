import { test, expect } from '@playwright/test';
import {
  CARD_EXPIRY_INPUT_SELECTOR,
  ERROR_MESSAGE_SELECTOR,
  INVALID_EXPIRY_MESSAGE,
  invalidExpiryDates,
  validExpiryDates,
} from './constants';

const IFRAME_SELECTOR = 'iframe[name=card-expiry-element]';
const INPUT_SELECTOR = CARD_EXPIRY_INPUT_SELECTOR;
const PAGE_PATH = '/elements/card-expiry';

test.describe('Card expiry element', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PAGE_PATH);
  });

  test('should render card expiry element', async ({ page }) => {
    const element = page.locator(IFRAME_SELECTOR);
    await expect(element).toBeVisible();
  });

  test('should be able to focus on card expiry', async ({ page }) => {
    const iframe = page.frameLocator(IFRAME_SELECTOR);
    const element = iframe.locator(INPUT_SELECTOR).first();
    await element.focus();
    await expect(element).toBeFocused();
  });

  test('should be able to fill card expiry', async ({ page }) => {
    const iframe = page.frameLocator(IFRAME_SELECTOR);
    const element = iframe.locator(INPUT_SELECTOR).first();
    await element.fill('042027');
    await expect(element).toHaveValue('04/2027');
  });

  invalidExpiryDates.forEach(async (expiryDate) => {
    test(`should raise validation error when card expiry is invalid: [input:${expiryDate}]`, async ({ page }) => {
      const iframe = page.frameLocator(IFRAME_SELECTOR);
      const clientFrameErrorMessage = page.locator(ERROR_MESSAGE_SELECTOR).first();

      const cardExpiry = iframe.locator(INPUT_SELECTOR).first();
      await cardExpiry.fill(expiryDate);
      await expect(cardExpiry).toHaveAttribute('aria-invalid', 'true');
      await expect(clientFrameErrorMessage).toHaveText(INVALID_EXPIRY_MESSAGE);
    });
  });

  validExpiryDates.forEach(async (expiryDate) => {
    test(`should not raise validation error when card expiry is valid: [input:${expiryDate}]`, async ({ page }) => {
      const iframe = page.frameLocator(IFRAME_SELECTOR);
      const clientFrameErrorMessage = page.locator(ERROR_MESSAGE_SELECTOR).first();

      const cardExpiry = iframe.locator(INPUT_SELECTOR).first();
      await cardExpiry.fill(expiryDate);
      await expect(cardExpiry).not.toHaveAttribute('aria-invalid');
      await expect(clientFrameErrorMessage).toHaveText('');
    });
  });
});
