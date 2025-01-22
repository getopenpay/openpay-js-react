import { Amount } from '../../../shared-models';
import { PaymentDataRequest } from '../types/google-pay.types';

export const getPaymentDataRequest = ({
  gateway,
  gatewayMerchantId,
  merchantName,
  merchantId,
  initialPreview,
}: {
  gateway: string;
  gatewayMerchantId: string;
  merchantName: string;
  merchantId?: string;
  initialPreview?: Amount;
}): PaymentDataRequest => {
  const baseRequest = {
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
      // TODO: asap for prod - airwallex has no docs for this
      // https://developers.google.com/pay/api/web/reference/request-objects#MerchantInfo
      merchantId: merchantId,
      merchantName: merchantName,
    },
  };

  if (!initialPreview) {
    return baseRequest;
  }

  const totalPrice = Math.max(initialPreview.amountAtom / 100, 0);

  return {
    ...baseRequest,
    transactionInfo: {
      countryCode: 'US',
      currencyCode: initialPreview.currency?.toUpperCase() ?? 'USD',
      totalPriceStatus: 'FINAL',
      totalPrice: totalPrice.toFixed(2),
    },
  };
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
