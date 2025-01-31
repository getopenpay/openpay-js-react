import { FieldName } from '../../../shared-models';

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

  const inputs = { ...formInputs };

  if (pmBillingContact || billingContact) {
    inputs[FieldName.EMAIL] =
      inputs[FieldName.EMAIL] ||
      pmBillingContact?.emailAddress ||
      billingContact?.emailAddress ||
      'op_unfilled@email.com';

    inputs[FieldName.COUNTRY] =
      inputs[FieldName.COUNTRY] || pmBillingContact?.countryCode || billingContact?.countryCode || 'US';

    inputs[FieldName.ZIP_CODE] =
      inputs[FieldName.ZIP_CODE] || pmBillingContact?.postalCode || billingContact?.postalCode || '00000';

    inputs[FieldName.FIRST_NAME] =
      inputs[FieldName.FIRST_NAME] || pmBillingContact?.givenName || billingContact?.givenName || '_OP_UNKNOWN';

    inputs[FieldName.LAST_NAME] =
      inputs[FieldName.LAST_NAME] || pmBillingContact?.familyName || billingContact?.familyName || '_OP_UNKNOWN';
  }

  return inputs;
};
