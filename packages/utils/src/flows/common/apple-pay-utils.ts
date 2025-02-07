import { z } from 'zod';
import { FieldName } from '../../shared-models';

export const loadApplePayScript = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://applepay.cdn-apple.com/jsapi/1.latest/apple-pay-sdk.js';
    script.crossOrigin = 'anonymous';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Apple Pay SDK'));
    document.body.appendChild(script);
  });
};

export const fillEmptyFormInputsWithApplePay = (
  formInputs: Record<string, unknown>,
  applePayPayment: ApplePayJS.ApplePayPayment
): Record<string, unknown> => {
  const pmBillingContact = applePayPayment.token.paymentMethod.billingContact;
  const billingContact = applePayPayment.billingContact;
  const shippingContact = applePayPayment.shippingContact;

  const inputs = { ...formInputs };

  if (pmBillingContact || billingContact || shippingContact) {
    inputs[FieldName.EMAIL] =
      inputs[FieldName.EMAIL] ||
      pmBillingContact?.emailAddress ||
      billingContact?.emailAddress ||
      shippingContact?.emailAddress ||
      'op_unfilled@email.com';

    inputs[FieldName.COUNTRY] =
      inputs[FieldName.COUNTRY] ||
      pmBillingContact?.countryCode ||
      billingContact?.countryCode ||
      shippingContact?.countryCode ||
      'US';

    inputs[FieldName.ZIP_CODE] =
      inputs[FieldName.ZIP_CODE] ||
      pmBillingContact?.postalCode ||
      billingContact?.postalCode ||
      shippingContact?.postalCode ||
      '00000';

    inputs[FieldName.FIRST_NAME] =
      inputs[FieldName.FIRST_NAME] ||
      pmBillingContact?.givenName ||
      billingContact?.givenName ||
      shippingContact?.givenName ||
      '_OP_UNKNOWN';

    inputs[FieldName.LAST_NAME] =
      inputs[FieldName.LAST_NAME] ||
      pmBillingContact?.familyName ||
      billingContact?.familyName ||
      shippingContact?.familyName ||
      '_OP_UNKNOWN';
  }

  return inputs;
};

const ApplePayEventSchema = z.object({
  data: z.object({
    messageHeaders: z.record(z.string(), z.any()),
    errors: z.array(z.any()),
    messageType: z.string(),
    messageBody: z.record(z.string(), z.any()),
  }),
  origin: z.literal('https://applepay.cdn-apple.com'),
});
type ApplePayEvent = z.infer<typeof ApplePayEventSchema>;

export const parseApplePayEvent = (event: MessageEvent): ApplePayEvent | undefined => {
  const parsed = ApplePayEventSchema.safeParse(event);
  return parsed.data;
};

/**
 * ApplePaySession.oncancel is only fired in Safari and not fired in
 * non-Safari browsers - https://developer.apple.com/forums/thread/773868.
 *
 * This event handler responsible for catching event for popup window closed by user
 * fires by: Apple Pay's CDN (applepay.cdn-apple.com)
 *
 * dev-note: `monitorEvents(window, 'message')` in console helped identify which event is fired when closed
 *
 * @param onCancel - Callback function to handle the cancellation
 * @returns {cleanupCancelListener: () => void} - Cleanup function to remove the event listener
 */
export const handleApplePayQRPopupClose = (onCancel: () => void): { cleanupCancelListener: () => void } => {
  // Used AbortController instead of removeEventLister
  // https://css-tricks.com/using-abortcontroller-as-an-alternative-for-removing-event-listeners/
  const eventAbortController = new AbortController();

  window.addEventListener(
    'message',
    (event) => {
      const mayBeApplePayEvent = parseApplePayEvent(event);
      if (mayBeApplePayEvent?.data?.messageType === 'windowclosing') {
        onCancel();
        eventAbortController.abort();
      }
    },
    {
      signal: eventAbortController.signal,
    }
  );

  return {
    cleanupCancelListener: () => eventAbortController.abort(),
  };
};
