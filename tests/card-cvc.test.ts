import { test, expect } from '@playwright/test';
import { CARD_CVC_INPUT_SELECTOR, ERROR_MESSAGE_SELECTOR, INVALID_CVC_MESSAGE, invalidCVCNumbers, validCVCNumbers } from './constants';

const IFRAME_SELECTOR = 'iframe[name=card-cvc-element]';
const INPUT_SELECTOR = CARD_CVC_INPUT_SELECTOR;
const PAGE_PATH = '/elements/card-cvc';

test.describe('Card CVC element', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PAGE_PATH);
  });

  test('should render card cvc element', async ({ page }) => {
    const element = page.locator(IFRAME_SELECTOR);
    await expect(element).toBeVisible();
  });

  test('should be able to focus on card cvc input', async ({ page }) => {
    const iframe = page.frameLocator(IFRAME_SELECTOR);
    const element = iframe.locator(INPUT_SELECTOR).first();
    await element.focus();
    await expect(element).toBeFocused();
  });

  test('should be able to input only valid number', async ({ page }) => {
    const iframe = page.frameLocator(IFRAME_SELECTOR);
    const clientFrameErrorMessage = page.locator(ERROR_MESSAGE_SELECTOR).first();

    const cardCVC = iframe.locator(INPUT_SELECTOR).first();
    await cardCVC.fill('asdf');

    await expect(cardCVC).toHaveAttribute('aria-invalid', 'true');
    await expect(clientFrameErrorMessage).toHaveText(INVALID_CVC_MESSAGE);
  });

  invalidCVCNumbers.forEach(async (cvc) => {
    test(`should raise validation error when card cvc is invalid: [input:${cvc}]`, async ({ page }) => {
      const iframe = page.frameLocator(IFRAME_SELECTOR);
      const clientFrameErrorMessage = page.locator(ERROR_MESSAGE_SELECTOR).first();

      const element = iframe.locator(INPUT_SELECTOR).first();
      await element.fill(cvc);
      await expect(element).toHaveAttribute('aria-invalid', 'true');
      await expect(clientFrameErrorMessage).toHaveText(INVALID_CVC_MESSAGE);
    });
  });

  validCVCNumbers.forEach(async (cvc) => {
    test(`should not raise validation error when card cvc is valid: [input:${cvc}]`, async ({ page }) => {
      const iframe = page.frameLocator(IFRAME_SELECTOR);
      const clientFrameErrorMessage = page.locator(ERROR_MESSAGE_SELECTOR).first();

      const element = iframe.locator(INPUT_SELECTOR).first();
      await element.fill(cvc);
      // CVC should be truncated to max 4 characters
      await expect(element).toHaveValue(cvc.replace(/\D/g, '').slice(0, 4));
      await expect(element).not.toHaveAttribute('aria-invalid');
      await expect(clientFrameErrorMessage).toHaveText('');
    });
  });
});
