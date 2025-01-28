declare global {
  interface Window {
    ApplePaySession?: typeof ApplePaySession;
  }
}

export type InitApplePayFlowResult =
  | {
      isAvailable: true;
      startFlow: () => Promise<void>;
    }
  | {
      isAvailable: false;
    };

export interface ApplePaymentRequest {
  countryCode: string;
  currencyCode: string;
  supportedNetworks: string[];
  merchantCapabilities: ApplePayJS.ApplePayMerchantCapability[];
  total: {
    label: string;
    amount: string;
    type: 'final';
  };
}

export interface ApplePayFormInputs {
  emailAddress?: string;
  countryCode?: string;
  addressLines?: string[];
  locality?: string; // city
  postalCode?: string;
  administrativeArea?: string; // state
  givenName?: string; // first name
  familyName?: string; // last name
}
