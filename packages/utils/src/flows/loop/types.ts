export type LoopWidgetProps = {
  paymentUsdAmount: number;
  suggestedAuthorizationUsdAmount: number;
  subscriptionRefId: string;
  customerRefId: string;
  invoiceRefId: string;
};

export type LoopInitConnectProps = {
  onInitialized: (params: { entityId: string, [key: string]: any }) => void;
  onInitFailed: (params: { type: string, message: string, data: any, [key: string]: any }) => void;
  onWalletChange: (params: { address: string, [key: string]: any }) => void;
  onNetworkChange: (params: { id: string, name: string, chain: string, [key: string]: any }) => void;
  apiKey: string;
  entityId: string;
  merchantId: string;
  environment: string;
};


// Below types copied from are from @loop-crypto/connect v0.3.1, see here for
// type explanations: https://loopcrypto.readme.io/docs/payment-widget
export enum Blockchain {
  EVM = "EVM",
  SOL = "Solana",
}

export type BlockchainNetwork = keyof typeof Blockchain;

export interface CustomerResponse {
  /**
   * The unique identifier that represents the customer
   * @example "1234567890abcdef"
   */
  customerId: string;
  /**
   * The external customer reference ID used to tie this customer to a customer in an external system.
   * @example "1234567890abcdef"
   */
  customerRefId: string | null;
  /**
   * The external subscription reference ID used to tie this customer to a subscription in an external system.
   * @example "1234567890abcdef"
   */
  subscriptionRefId: string | null;
  /**
   * The date the customer record was created, represented as a Unix timestamp in seconds.
   * @example 1716211200
   */
  createdDate: number;
  /**
   * The merchant the customer is associated with.
   */
  merchant: Omit<MerchantResponse, "paymentTypes" | "payoutDestinations">;
  /**
   * The payment methods configured for this customer to make payments with.
   */
  paymentMethods: Omit<PaymentMethodResponse, "merchantId" | "entityId">[];
}

export type CustomStyles = string;

export type Environment =
| "development"
| "staging"
| "production"
| "demo"
| "local";

export interface ExchangableToken
extends Omit<TokenExchangeDetailsResponse, "exchangeRates"> {
  wrapsTo?: string;
  exchange: ExchangeRateDetails;
}

export interface ExchangeRateDetails {
  currency: string;
  rate: number;
  updated: number;
  provider: string;
}

export declare const getLoopConnectConfig: () => LoopConnectConfig | null;

export interface InitFailedEvent {
  type: "initFailed";
  message: string;
  data: Record<string, any>;
}

export interface InitializedEvent {
  entityId: string;
}

export declare const initLoopConnect: (config: LoopConnectConfig) => Promise<void>;

export declare interface LoopConnectConfig {
  apiKey: string;
  entityId: string;
  merchantId?: string;
  environment?: Environment;
  customStyles?: CustomStyles;
  onInitialized?: (detail: InitializedEvent) => void;
  onInitFailed?: (detail: InitFailedEvent) => void;
  onWalletChange?: (detail: WalletChangeEvent) => void;
  onNetworkChange?: (detail: NetworkChangeEvent) => void;
}

export declare const LoopConnectPayInElement: CustomElementConstructor;

export interface LoopConnectPayInProps extends LoopConnectWidget {
  paymentUsdAmount: number;
  minimumAuthorizationUsdAmount?: number;
  suggestedAuthorizationUsdAmount?: number;
  stateNotification?: NotificationMode | `${NotificationMode}`;
  failureNotification?: NotificationMode | `${NotificationMode}`;
  completeNotification?: NotificationMode | `${NotificationMode}`;
  onWalletChange?: (detail: WalletChangeEvent) => void;
  onNetworkChange?: (detail: NetworkChangeEvent) => void;
  onPayInReady?: (detail: PayInReadyEvent) => void;
  onPayInReadyFailed?: (detail: PayInReadyFailedEvent) => void;
  onPayInStateChange?: (detail: PayInStateChangeEvent) => void;
  onPayInFailed?: (detail: PayInFailedEvent) => void;
  onPayInTokenChange?: (detail: PayInTokenChangeEvent) => void;
  onPayInAuthorizationUpdated?: (detail: PayInAuthorizationUpdatedEvent) => void;
  onPayInCustomerCreated?: (detail: PayInCustomerCreatedEvent) => void;
  onPayInComplete?: (detail: PayInCompleteEvent) => void;
  subscriptionRefId?: string;
  customerRefId?: string;
  invoiceRefId?: string;
}

export type LoopConnectToken = ExchangableToken;

export interface LoopConnectWidget {
  customStyles?: CustomStyles;
}

export interface MerchantResponse {
  /**
   * The unique identifier for the merchant
   * @example "1234567890abcdef"
   */
  merchantId: string;
  /**
   * The name that identifies the merchant
   * @example "Loop Inc."
   */
  merchantName: string;
  /**
   * The unique reference ID used to identify the merchant in external systems
   * @example "1234567890"
   */
  merchantRefId: string | null;
  /**
   * The payout destinations supported by the organization
   */
  payoutDestinations: Omit<
  PayoutDestinationResponse,
  "entityId" | "merchantId"
  >[];

  /**
   * The payment types supported by the merchant
   */
  paymentTypes: Omit<
  PaymentTypeResponse,
  "entityId" | "merchantId" | "createdAt"
  >[];
}

export interface NetworkChangeEvent {
  id: number;
  name: string;
  chain: BlockchainNetwork;
}

export enum NotificationMode {
  EventOnly = "event-only",
  Embedded = "embedded"
}

export interface PayInAuthorizationUpdatedEvent {
  authorizationAmount: string;
  suggestedAuthorizationTokenAmount?: string;
  minimumAuthorizationTokenAmount?: string;
  tokenAddress: string;
  tokenSymbol: string;
  networkId: number;
}

export interface PayInCompleteEvent extends PayinResponse {
}

export interface PayInCustomerCreatedEvent extends CustomerResponse {
}

export enum PayInFailed {
  INSUFFICIENT_BALANCE = "insufficientBalance",
  INSUFFICIENT_AUTHORIZATION = "insufficientAuthorization",
  SIGNED_MESSAGE_REQUIRED = "signedMessageRequired",
  CUSTOMER_CREATION_FAILED = "customerCreationFailed",
  PAYMENT_FAILED = "paymentFailed"
}

export interface PayInFailedData {
  error?: Record<string, any>;
}

export interface PayInFailedEvent {
  type: PayInFailed;
  message: string;
  data: PayInFailedData;
}

export interface PayinPaymentMethodResponse extends PaymentMethodResponse {
  /**
   * The status of the payment method
   */
  status:
  | "ok"
  | "insufficient_balance"
  | "insufficient_authorization"
  | "insufficient_balance_authorization";
}

export interface PayInReadyEvent {
  entityId: string;
}

export interface PayInReadyFailedEvent {
  type: "payinReadyFailed";
  message: string;
  data: Record<string, any>;
}

export interface PayinResponse {
  /**
   * The unique identifier for the payin
   * @example "8f47c6e9-2b3a-4d5c-9f8e-1a2b3c4d5e6f"
   */
  payinId: string;
  /**
   * The date the customer record was created, represented as a Unix timestamp in seconds.
   * @example 1716211200
   */
  createdDate: number;
  /**
   * The unique identifier of the merchant this payin is associated with
   * @example "67e55044-10b1-426f-9247-bb680e5fe0c8"
   */
  merchantId: string;
  /**
   * The amount to be paid, specified in either fiat or crypto based on amountType
   * @example "100.00"
   */
  amount: string;
  /**
   * The type of the amount, either "fiat" or "token"
   * @example "fiat"
   */
  amountType: "fiat" | "token";
  /**
   * The date the payment will take place, represented as a Unix timestamp
   * @example 1716211200
   */
  billDate: number;
  /**
   * The unique invoice identifier representing this payin transaction
   * @example "1234567890abcdef"
   */
  invoiceId: string;
  /**
   * (Optional) A description or note that provides additional context about this payin. This can be used to help identify or provide details about the payment for internal reference or customer communications.
   * @example "Payment for Developer plan"
   */
  description: string | null;
  /**
   * (Optional) The external invoice ID used to tie this payin to an invoice in an external system
   * @example "1234567890abcdef"
   */
  externalInvoiceRef: string | null;
  /**
   * The type of the payin, either "subscription" or "invoice"
   * @example "subscription"
   */
  payinType: "subscription" | "invoice";
  /**
   * The status of the payin, can be "scheduled", "pending", "completed", or "failed"
   * @example "scheduled"
   */
  payinStatus:
  | "scheduled"
  | "pending"
  | "completed"
  | "failed"
  | "canceled"
  | "uncollectible"
  | "draft";
  /**
   * The payment method used for this payin
   */
  paymentMethod: Omit<PayinPaymentMethodResponse, "merchantId" | "entityId">;
  /**
   * The payout destination used for this payin
   */
  payoutDestination: Omit<
  PayoutDestinationResponse,
  "merchantId" | "entityId" | "isDefault"
  >;
}

export enum PayInState {
  IDLE = "idle",
  CONFIRMING_BALANCE = "confirmingBalance",
  CONFIRMING_AUTHORIZATION = "confirmingAuthorization",
  UPDATING_AUTHORIZATION = "updatingAuthorization",
  SIGNING_MESSAGE = "signingMessage",
  CREATING_CUSTOMER = "creatingCustomer",
  PROCESSING_PAYMENT = "processingPayment",
  COMPLETE = "complete"
}

export type PayInStateChangeEvent = {
  [K in keyof PayInStateDataMap]: {
      state: K;
      message: string;
      data: PayInStateDataMap[K];
  };
}[keyof PayInStateDataMap];

export interface PayInStateChangeEventComplete extends PayinResponse {
}

export interface PayInStateChangeEventConfirmingAuthorization {
  token: LoopConnectToken;
  minimumAuthorization: string | undefined;
  contractAddress: string;
  walletAddress: string;
  chain: BlockchainNetwork;
  networkName: string;
}

export interface PayInStateChangeEventConfirmingBalance {
  token: LoopConnectToken;
  amount: string;
  walletAddress: string;
  chain: BlockchainNetwork;
  networkName: string;
}

export interface PayInStateChangeEventCreatingCustomer {
  token: LoopConnectToken;
  walletAddress: string;
  chain: BlockchainNetwork;
  networkName: string;
}

export type PayInStateChangeEventIdle = unknown;

export interface PayInStateChangeEventProcessingPayment {
  token: LoopConnectToken;
  amount: string;
  walletAddress: string;
  chain: BlockchainNetwork;
  networkName: string;
  customerId: string;
  paymentMethodId: string;
}

export interface PayInStateChangeEventSigningMessage {
  walletAddress: string;
  chain: BlockchainNetwork;
  networkName: string;
  networkId: number;
}

export interface PayInStateChangeEventUpdatingAuthorization {
  token: LoopConnectToken;
  suggestedAuthorization: string | undefined;
  contractAddress: string;
  walletAddress: string;
  chain: BlockchainNetwork;
  networkName: string;
}

export type PayInStateDataMap = {
  [PayInState.IDLE]: PayInStateChangeEventIdle;
  [PayInState.CONFIRMING_BALANCE]: PayInStateChangeEventConfirmingBalance;
  [PayInState.CONFIRMING_AUTHORIZATION]: PayInStateChangeEventConfirmingAuthorization;
  [PayInState.UPDATING_AUTHORIZATION]: PayInStateChangeEventUpdatingAuthorization;
  [PayInState.SIGNING_MESSAGE]: PayInStateChangeEventSigningMessage;
  [PayInState.CREATING_CUSTOMER]: PayInStateChangeEventCreatingCustomer;
  [PayInState.PROCESSING_PAYMENT]: PayInStateChangeEventProcessingPayment;
  [PayInState.COMPLETE]: PayInStateChangeEventComplete;
};

export interface PayInTokenChangeEvent {
  address: string;
  networkId: number;
  name: string;
  symbol: string;
  decimals: number;
  logoUrl: string;
  exchange: ExchangeRateDetails;
}

export interface PaymentMethodPreAuthorization {
  /**
   * The balance of the payment method formatted in the token amount
   * @example "100"
   */
  balance: string;
  /**
   * The authorization amount of the payment method formatted in the token amount
   * @example "49.9"
   */
  authorization: string;
}

export interface PaymentMethodResponse {
  /**
   * The unique identifier for the payment method
   * @example "1234567890abcdef"
   */
  paymentMethodId: string;
  /**
   * The date the payment method was created, represented as a Unix timestamp in seconds.
   * @example 1716211200
   */
  createdAt: number;
  /**
   * The unique identifier of the merchant this payment method is associated with
   * @example "67e55044-10b1-426f-9247-bb680e5fe0c8"
   */
  merchantId: string;
  /**
   * The name of the payment method
   * @example "My Crypto Wallet"
   */
  paymentMethodName: string;
  /**
   * The blockchain network ID the payment method is associated with
   * @example 1
   */
  networkId: number;
  /**
   * The blockchain wallet address where payments will be sent from
   * @example "0x1234567890abcdef"
   */
  walletAddress: string;
  /**
   * Whether the payment method is the default payment method for wallet address
   * @example true
   */
  isDefault: boolean;
  /**
   * The token associated with the payment method
   */
  token: PaymentMethodToken;
  /**
   * The status of the payment method, including the wallet's balance and authorization status
   */
  preAuthorization: PaymentMethodPreAuthorization;
}

export interface PaymentMethodToken extends Omit<TokenResponse, "networkId"> {
  /**
   * The exchange rate of the token
   */
  exchangeRates: PaymentMethodTokenExchangeRate[];
}

export interface PaymentMethodTokenExchangeRate {
  /**
   * The currency code. Only "USD" is supported at this time.
   * @example "USD"
   */
  currency: string;
  /**
   * The price of the token in the specified currency code. Accurate to 4 decimal places, e.g. a price of "1.9900" represents $1.99
   * @example "10000"
   */
  price: string;
  /**
   * The Unix timestamp (in seconds) when this exchange rate was last updated
   * @example 1715731200
   */
  timestamp: number;
}

export interface PaymentTypeResponse {
  /**
   * The entity ID (top level organization) associated with this payment type.
   * @example "1234567890abcdef"
   */
  entityId: string;
  /**
   * The merchant ID associated with this payment type. If null, the payment type belongs to the organization.
   * @example "1234567890abcdef"
   */
  merchantId: string | null;
  /**
   * The unique identifier for the token used by the payment type.
   * @example "123e4567-e89b-12d3-a456-426614174000"
   */
  tokenId: string;
  /**
   * The blockchain network ID the token is associated with
   * @example 1
   */
  networkId: number;
  /**
   * The token symbol that identifies the token on the blockchain network
   * @example "USDC"
   */
  symbol: string;
  /**
   * The token contract address for the payment type
   * @example "0x1234567890abcdef"
   */
  address: string;
  /**
   * The number of decimal places used to represent token amounts
   * @example 6
   */
  decimals: number;
}

export interface PayoutDestinationResponse {
  /**
   * The unique identifier for the payout destination
   * @example "1234567890abcdef"
   */
  payoutDestinationId: string;
  /**
   * The blockchain network ID the payout destination is associated with
   * @example 1
   */
  networkId: number;
  /**
   * The blockchain wallet address where payments will be sent. Must be a valid address for the specified network.
   * @example "0x1234567890abcdef"
   */
  walletAddress: string;
  /**
   * The entity ID (top level organization) associated with this payout destination.
   * @example "1234567890abcdef"
   */
  entityId: string;
  /**
   * The merchant ID associated with this payout destination. If null, the payout destination belongs to the organization.
   * @example "1234567890abcdef"
   */
  merchantId: string | null;
  /**
   * Whether the payout destination is the default payout destination for the merchant.
   * @example true
   */
  isDefault: boolean;
}

export interface TokenExchangeDetailsResponse {
  name: string;
  logoUrl: string;
  symbol: string;
  decimals: number;
  address: string;
  networkId: number;
  exchangeRates: ExchangeRateDetails[];
}

export interface TokenResponse {
  /**
   * The unique identifier for the token used by the payment type.
   * @example "123e4567-e89b-12d3-a456-426614174000"
   */
  tokenId: string;
  /**
   * The blockchain network ID the token is associated with
   * @example 1
   */
  networkId: number;
  /**
   * The token symbol that identifies the token on the blockchain network
   * @example "USDC"
   */
  symbol: string;
  /**
   * The token contract address for the payment type
   * @example "0x1234567890abcdef"
   */
  address: string;
  /**
   * The number of decimal places used to represent token amounts
   * @example 6
   */
  decimals: number;
}

export interface WalletChangeEvent {
  address: string;
  ens: string | undefined;
}