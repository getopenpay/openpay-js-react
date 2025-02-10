import { Amount, DefaultFieldValues } from '../../../..';

export type AirwallexGooglePayFlowCustomParams = {
  overridePaymentRequest?: {
    amount: Amount;
    pending?: boolean;
    googlePayPaymentRequest?: google.payments.api.PaymentDataRequest;
  };
  defaultFieldValues?: DefaultFieldValues;
};

export type InitAirwallexGooglePayFlowResult = {
  isAvailable: boolean;
  isLoading: boolean;
  startFlow: (customParams?: AirwallexGooglePayFlowCustomParams) => Promise<void>;
};

export type PaymentsClient = google.payments.api.PaymentsClient;

export type PaymentDataRequest = google.payments.api.PaymentDataRequest;

export type AllowedPaymentMethod = google.payments.api.PaymentMethodData;

export type RunGooglePayFlowParams = {
  paymentData: google.payments.api.PaymentData;
};

export type AirwallexProcessorMetadata = {
  processor_account_id: string;
  processor_account_name: string;
};
