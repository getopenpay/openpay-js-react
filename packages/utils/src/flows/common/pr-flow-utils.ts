import { PaymentRequestStatus } from '../../shared-models';

export const PR_LOADING: PaymentRequestStatus = {
  isLoading: true,
  isAvailable: false,
  startFlow: async () => {
    console.warn(
      `startFlow triggered while payment request is still not ready. 
      You can check the ".isLoading" param to know when a payment request is still loading, 
      and ".isAvailable" to know if a payment request is available.`
    );
  },
};

export const PR_ERROR: PaymentRequestStatus = {
  isLoading: false,
  isAvailable: false,
  startFlow: async () => {
    console.error(`startFlow triggered when payment request is not available.`);
  },
};
