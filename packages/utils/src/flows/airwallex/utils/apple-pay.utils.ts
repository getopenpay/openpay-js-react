import { Amount, FieldName } from '../../../shared-models';
import { ApplePaymentRequest } from '../types/apple-pay.types';

export const getApplePaymentRequest = ({
  isSetupMode,
  initialPreview,
}: {
  isSetupMode: boolean;
  initialPreview: Amount;
}): ApplePaymentRequest => {
  return {
    countryCode: 'US',
    currencyCode: initialPreview.currency?.toUpperCase() ?? 'USD',
    supportedNetworks: ['visa', 'masterCard', 'amex', 'discover'],
    merchantCapabilities: [
      'supports3DS',
      'supportsCredit',
      'supportsDebit',
      'supportsEMV',
    ] as ApplePayJS.ApplePayMerchantCapability[],
    total: {
      label: isSetupMode ? 'Setup Payment' : 'Payment Total',
      amount: isSetupMode ? '0.00' : (initialPreview.amountAtom / 100).toFixed(2),
      type: 'final',
    },
  };
};

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
  billingContact: ApplePayJS.ApplePayPayment['billingContact']
): Record<string, unknown> => {
  const inputs = { ...formInputs };

  if (billingContact) {
    inputs[FieldName.EMAIL] = inputs[FieldName.EMAIL] || billingContact.emailAddress || 'op_unfilled@getopenpay.com';
    inputs[FieldName.COUNTRY] = inputs[FieldName.COUNTRY] || billingContact.countryCode || 'US';
    inputs[FieldName.ADDRESS] = inputs[FieldName.ADDRESS] || billingContact.addressLines?.[0] || '';
    inputs[FieldName.CITY] = inputs[FieldName.CITY] || billingContact.locality || '';
    inputs[FieldName.ZIP_CODE] = inputs[FieldName.ZIP_CODE] || billingContact.postalCode || '00000';
    inputs[FieldName.STATE] = inputs[FieldName.STATE] || billingContact.administrativeArea || '';
    inputs[FieldName.FIRST_NAME] = inputs[FieldName.FIRST_NAME] || billingContact.givenName || '_OP_UNKNOWN';
    inputs[FieldName.LAST_NAME] = inputs[FieldName.LAST_NAME] || billingContact.familyName || '_OP_UNKNOWN';
  }

  return inputs;
};
