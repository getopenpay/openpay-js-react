declare global {
  interface Window {
    google?: {
      payments: {
        api: {
          PaymentsClient: new (config: PaymentClientConfig) => PaymentsClient;
          ButtonOptions: {
            onClick: () => void;
            buttonType?: string;
            buttonColor?: string;
          };
        };
      };
    };
  }
}

export interface PaymentClientConfig {
  environment: 'TEST' | 'PRODUCTION';
  merchantInfo?: {
    merchantId?: string;
    merchantName?: string;
  };
}

export interface PaymentsClient {
  createButton: (options: Window['google']) => HTMLElement;
  isReadyToPay: (request: PaymentDataRequest) => Promise<{ result: boolean }>;
  loadPaymentData: (request: PaymentDataRequest) => Promise<google.payments.api.PaymentData>;
}

export interface PaymentDataRequest {
  apiVersion: number;
  apiVersionMinor: number;
  allowedPaymentMethods: AllowedPaymentMethod[];
  merchantInfo: {
    merchantId?: string;
    merchantName?: string;
  };
  transactionInfo?: {
    countryCode: string;
    currencyCode: string;
    totalPriceStatus: string;
    totalPrice: string;
  };
}

export interface AllowedPaymentMethod {
  type: string;
  parameters: {
    allowedAuthMethods: string[];
    allowedCardNetworks: string[];
  };
  tokenizationSpecification: {
    type: string;
    parameters: {
      gateway: string;
      gatewayMerchantId: string;
    };
  };
}

export type InitGooglePayFlowResult =
  | {
      isAvailable: true;
      startFlow: () => Promise<void>;
    }
  | {
      isAvailable: false;
    };

export type RunGooglePayFlowParams = {
  paymentData: google.payments.api.PaymentData;
};

export type AirwallexProcessorMetadata = {
  processor_account_id: string;
  processor_account_name: string;
};
