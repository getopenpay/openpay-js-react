import { Amount } from '../../shared-models';

export type MobileWalletFlowCustomParams = {
  overridePaymentRequest?: {
    amount: Amount;
    pending?: boolean;
    label?: string;
    applePayPaymentRequest?: ApplePayJS.ApplePayPaymentRequest;
  };
};

export type InitMobileWalletFlowResult = {
  isAvailable: boolean;
  isLoading: boolean;
  startFlow: (customParams?: MobileWalletFlowCustomParams) => Promise<void>;
};

export const MOBILE_WALLET_LOADING: InitMobileWalletFlowResult = {
  isAvailable: false,
  isLoading: true,
  startFlow: async () => {},
};
