import { PR_LOADING, PRStatuses } from '@getopenpay/utils';
import { useCallback, useState } from 'react';

type PRCallback = (paymentRequests: PRStatuses) => void;
type HookReturn = {
  paymentRequests: PRStatuses;
  overridenOnPaymentRequestLoad: PRCallback;
};

export const usePaymentRequests = (originalOnPaymentRequestLoad?: PRCallback): HookReturn => {
  const [paymentRequests, setPaymentRequests] = useState<PRStatuses>({
    apple_pay: PR_LOADING,
    google_pay: PR_LOADING,
  });

  const overridenOnPaymentRequestLoad = useCallback(
    (paymentRequests: PRStatuses) => {
      setPaymentRequests(paymentRequests);
      originalOnPaymentRequestLoad?.(paymentRequests);
    },
    [originalOnPaymentRequestLoad]
  );

  return { paymentRequests, overridenOnPaymentRequestLoad };
};
