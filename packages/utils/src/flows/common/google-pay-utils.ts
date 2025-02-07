import { StartPaymentFlowResponse } from '../../cde_models';
import { Amount, Common3DSNextActionMetadata, CommonNextActionMetadata, FieldName } from '../../shared-models';

export type PaymentsClient = google.payments.api.PaymentsClient;

export type PaymentDataRequest = google.payments.api.PaymentDataRequest;

export type CommonGooglePayFlowCustomParams = {
  overridePaymentRequest?: {
    amount: Amount;
    pending?: boolean;
    googlePayPaymentRequest?: google.payments.api.PaymentDataRequest;
  };
};

export const getPaymentDataRequest = ({
  gateway,
  gatewayMerchantId,
  merchantName,
  merchantId,
  initialPreview,
  overridePaymentRequest,
}: {
  /**
   * The name identifier of the payment processor/gateway
   * @example `airwallex`, `authorize_net`
   */
  gateway: string;
  /**
   * The merchant identifier of the merchant on the payment processor/gateway
   * @example `acct_xxxx` for airwallex
   */
  gatewayMerchantId: string;
  merchantName: string;
  /**
   * GooglePay's merchant identifier.
   * PROD env will need this
   * https://developers.google.com/pay/api/web/reference/request-objects#MerchantInfo
   * @example `BCR2DN4TX7I3FRIU`
   */
  merchantId?: string;
  initialPreview?: Amount;
  overridePaymentRequest?: CommonGooglePayFlowCustomParams['overridePaymentRequest'];
}): PaymentDataRequest => {
  const amountAtom = overridePaymentRequest?.amount?.amountAtom ?? initialPreview?.amountAtom ?? 0;
  const totalPrice = Math.max(amountAtom / 100, 0);

  const currencyCode = (overridePaymentRequest?.amount?.currency ?? initialPreview?.currency ?? 'USD').toUpperCase();

  const baseRequest: Partial<PaymentDataRequest> = {
    apiVersion: 2,
    apiVersionMinor: 0,
    allowedPaymentMethods: [
      {
        type: 'CARD',
        parameters: {
          allowedAuthMethods: ['PAN_ONLY', 'CRYPTOGRAM_3DS'],
          allowedCardNetworks: ['AMEX', 'DISCOVER', 'INTERAC', 'JCB', 'MASTERCARD', 'VISA'],
          billingAddressRequired: true,
          billingAddressParameters: {
            format: 'FULL',
          },
          allowCreditCards: true,
          allowPrepaidCards: true,
        },
        tokenizationSpecification: {
          type: 'PAYMENT_GATEWAY',
          parameters: {
            gateway: gateway,
            gatewayMerchantId: gatewayMerchantId,
          },
        },
      },
    ],
    emailRequired: true,
    merchantInfo: {
      // PROD env will need this
      // https://developers.google.com/pay/api/web/reference/request-objects#MerchantInfo
      merchantId: merchantId ?? '',
      merchantName: merchantName,
    },
    transactionInfo: {
      countryCode: 'US',
      currencyCode,
      totalPriceStatus: overridePaymentRequest?.pending ? 'ESTIMATED' : 'FINAL',
      totalPrice: totalPrice.toFixed(2),
    },
  };

  if (overridePaymentRequest?.googlePayPaymentRequest) {
    return { ...baseRequest, ...overridePaymentRequest.googlePayPaymentRequest };
  }

  return baseRequest as PaymentDataRequest;
};

export const loadGooglePayScript = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://pay.google.com/gp/p/js/pay.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Pay SDK'));
    document.body.appendChild(script);
  });
};

export const parseAirwallex3DSNextActionMetadata = (
  response: StartPaymentFlowResponse
): Common3DSNextActionMetadata | null => {
  const commonAction = response.required_user_actions.find((action) => action.type === 'airwallex_payment_consent');
  if (!commonAction) {
    return null;
  }
  return Common3DSNextActionMetadata.parse(commonAction);
};

export const parseAirwallexStartPaymentFlowResponse = (response: StartPaymentFlowResponse) => {
  const commonAction = response.required_user_actions.find((action) => action.type === 'airwallex_payment_consent');
  if (!commonAction) {
    return null;
  }
  return CommonNextActionMetadata.parse(commonAction);
};

export const fillEmptyFormInputsWithGooglePay = (
  formInputs: Record<string, unknown>,
  paymentData: google.payments.api.PaymentData
): Record<string, unknown> => {
  const inputs = { ...formInputs };
  const billingAddress = paymentData.paymentMethodData?.info?.billingAddress;

  if (billingAddress) {
    // Split name into first and last if available
    const [firstName, ...lastNameParts] = billingAddress.name?.trim()?.split(/\s+/) ?? [];
    const lastName = lastNameParts.join(' ') || undefined;

    // Note: we use ||, not ?? to ensure that blanks are falsish
    inputs[FieldName.EMAIL] = inputs[FieldName.EMAIL] || paymentData.email || 'op_unfilled@getopenpay.com';
    inputs[FieldName.COUNTRY] = inputs[FieldName.COUNTRY] || billingAddress.countryCode || 'US';
    inputs[FieldName.ADDRESS] = inputs[FieldName.ADDRESS] || billingAddress.address1 || '';
    inputs[FieldName.CITY] = inputs[FieldName.CITY] || billingAddress.locality || '';
    inputs[FieldName.ZIP_CODE] = inputs[FieldName.ZIP_CODE] || billingAddress.postalCode || '00000';
    inputs[FieldName.STATE] = inputs[FieldName.STATE] || billingAddress.administrativeArea || '';
    inputs[FieldName.FIRST_NAME] = inputs[FieldName.FIRST_NAME] || firstName || '_OP_UNKNOWN';
    inputs[FieldName.LAST_NAME] = inputs[FieldName.LAST_NAME] || lastName || '_OP_UNKNOWN';
  }

  return inputs;
};
