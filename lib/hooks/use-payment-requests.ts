import { useEffect, useState } from 'react';
import { createStripePaymentRequest } from '../utils/stripe';
import { PaymentRequestStatus } from '../utils/shared-models';

type PaymentRequestProvider = 'apple_pay';

const PR_LOADING: PaymentRequestStatus = {
  isLoading: true,
  isAvailable: false,
  startFlow: () => {
    console.warn(
      `startFlow triggered while payment request is still not ready. 
      You can check the ".isLoading" param to know when a payment request is still loading, 
      and ".isAvailable" to know if a payment request is available.`
    );
  },
};

const PR_ERROR: PaymentRequestStatus = {
  isLoading: false,
  isAvailable: false,
  startFlow: () => {
    console.error(`startFlow triggered when payment request is not available.`);
  },
};

export const usePaymentRequests = (
  stripePubKey: string | undefined,
  totalAmountAtom: number | undefined,
  currency: string | undefined
): Record<PaymentRequestProvider, PaymentRequestStatus> => {
  const [status, setStatus] = useState<Record<PaymentRequestProvider, PaymentRequestStatus>>({ apple_pay: PR_LOADING });

  useEffect(() => {
    const runStripeSetup = async (): Promise<void> => {
      try {
        if (stripePubKey === undefined || totalAmountAtom === undefined || currency === undefined) {
          throw new Error(`Cannot setup stripe yet: missing params`);
        }
        const pr = await createStripePaymentRequest(stripePubKey, totalAmountAtom, currency);
        const canMakePayment = await pr.canMakePayment();
        const PR_SUCCESS = {
          isLoading: false,
          isAvailable: true,
          startFlow: () => pr.show(),
        };
        setStatus({
          apple_pay: canMakePayment?.['applePay'] ? PR_SUCCESS : PR_ERROR,
        });
      } catch (e) {
        setStatus({
          apple_pay: PR_ERROR,
        });
      }
    };

    runStripeSetup();
  }, [stripePubKey, totalAmountAtom, currency]);

  return status;
};
