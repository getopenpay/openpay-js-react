import { z } from 'zod';
import {
  Amount,
  Common3DSNextActionMetadata,
  createInputsDictFromForm,
  FieldName,
  OjsFlows,
  ThreeDSStatus,
} from '../../..';
import { start3dsVerification } from '../../3ds-elements/events';
import {
  confirmPaymentFlow,
  getCheckoutPreviewAmount,
  getPrefill,
  getProcessorAccount,
  performCheckout,
  startPaymentFlow,
} from '../../cde-client';
import { CheckoutRequest, StartPaymentFlowResponse } from '../../cde_models';
import { validateNonCdeFormFieldsForCC } from '../common/cc-flow-utils';
import { findCpmMatchingType } from '../common/common-flow-utils';
import {
  addBasicCheckoutCallbackHandlers,
  addErrorCatcherForInit,
  createOjsFlowLoggers,
  InitOjsFlow,
  RunOjsFlow,
  SimpleOjsFlowResult,
} from '../ojs-flow';

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

export type AirwallexGooglePayController = {
  mountButton: () => void;
  dismountButton: () => void;
  waitForButtonToMount: () => Promise<HTMLElement>;
  startFlow: () => Promise<void>;
};

interface PaymentClientConfig {
  environment: 'TEST' | 'PRODUCTION';
  merchantInfo?: {
    merchantId?: string;
    merchantName?: string;
  };
}

interface PaymentsClient {
  createButton: (options: Window['google']) => HTMLElement;
  isReadyToPay: (request: PaymentDataRequest) => Promise<{ result: boolean }>;
  loadPaymentData: (request: PaymentDataRequest) => Promise<google.payments.api.PaymentData>;
}

interface PaymentDataRequest {
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

interface AllowedPaymentMethod {
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

// Base configuration for Google Pay
const getPaymentDataRequest = (
  gateway: string,
  gatewayMerchantId: string,
  isSetupMode?: boolean,
  initialPreview?: Amount
): PaymentDataRequest => {
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
      merchantName: 'OpenPay Demo',
    },
  };

  // If no preview amount provided, return base request
  if (!initialPreview) {
    return baseRequest;
  }

  // Google Pay error when amount is 0
  const totalPrice = Math.max(initialPreview.amountAtom / 100, 0.01);
  log__('Total price', totalPrice, initialPreview.amountAtom / 100);

  return {
    ...baseRequest,
    transactionInfo: {
      countryCode: 'US',
      currencyCode: initialPreview.currency?.toUpperCase() ?? 'USD',
      totalPriceStatus: 'FINAL',
      totalPrice: totalPrice.toFixed(2),
      ...(isSetupMode && {
        displayItems: [
          {
            label: 'Subscription total',
            price: totalPrice.toFixed(2),
            type: 'SUBTOTAL',
          },
        ],
      }),
    },
  };
};

// Google Pay client singleton
let paymentsClient: PaymentsClient | null = null;

const getGooglePaymentsClient = (environment: 'TEST' | 'PRODUCTION' = 'TEST'): PaymentsClient => {
  if (paymentsClient === null) {
    paymentsClient = new window.google!.payments.api.PaymentsClient({
      environment,
      merchantInfo: getPaymentDataRequest('', '').merchantInfo,
    });
  }
  return paymentsClient;
};

const OJS_GPAY_BTN_ID = 'ojs-airwallex-gpay-btn';
const { log__, err__ } = createOjsFlowLoggers('gpay');

export type InitGooglePayFlowResult =
  | {
      isAvailable: true;
      controller: AirwallexGooglePayController;
    }
  | {
      isAvailable: false;
    };

export const GooglePayCpm = z.object({
  provider: z.literal('google_pay'),
  processor_name: z.literal('airwallex'),
});
export type GooglePayCpm = z.infer<typeof GooglePayCpm>;

const loadGooglePayScript = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://pay.google.com/gp/p/js/pay.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Pay SDK'));
    document.body.appendChild(script);
  });
};

export const initAirwallexGooglePayFlow: InitOjsFlow<InitGooglePayFlowResult> = addErrorCatcherForInit(
  async ({ context, formCallbacks }): Promise<InitGooglePayFlowResult> => {
    const initParams = context.customInitParams.googlePay;
    const googlePayCpm = findCpmMatchingType(context.checkoutPaymentMethods, GooglePayCpm);
    if (!googlePayCpm) {
      return { isAvailable: false };
    }

    log__('Google Pay CPM', googlePayCpm);

    // Get processor account details
    const processorAccount = await getProcessorAccount(context.anyCdeConnection, {
      checkout_secure_token: context.checkoutSecureToken,
      checkout_payment_method: googlePayCpm,
    });

    log__('Processor account', processorAccount);
    if (!processorAccount.id) {
      err__('No gateway merchant ID found in processor account');
      return { isAvailable: false };
    }

    log__(`Loading Google Pay SDK...`);
    await loadGooglePayScript();

    if (!window.google?.payments?.api) {
      err__('Google Pay SDK not loaded properly');
      return { isAvailable: false };
    }

    log__('Google Pay SDK loaded', window.google.payments);

    const anyCdeConnection = context.anyCdeConnection;
    const prefill = await getPrefill(anyCdeConnection);
    const isSetupMode = prefill.mode === 'setup';
    const initialPreview = await getCheckoutPreviewAmount(anyCdeConnection, prefill.token, isSetupMode, undefined);

    // Check if Google Pay is available for the user
    try {
      const { result: isReadyToPay } = await getGooglePaymentsClient().isReadyToPay(
        getPaymentDataRequest('airwallex', processorAccount.id)
      );
      if (!isReadyToPay) {
        log__('Google Pay is not available for this user');
        return { isAvailable: false };
      }
    } catch (err) {
      err__('Error checking Google Pay availability', err);
      return { isAvailable: false };
    }

    const paymentDataRequest = getPaymentDataRequest('airwallex', processorAccount.id, isSetupMode, initialPreview);
    const onGooglePayStartFlow = async () => {
      try {
        const paymentData = await getGooglePaymentsClient().loadPaymentData(paymentDataRequest);
        log__('Google Pay Payment data', paymentData);
        const billingAddress = paymentData.paymentMethodData?.info?.billingAddress;

        log__('Billing address', billingAddress);

        OjsFlows.airwallexGooglePay.run({
          context,
          checkoutPaymentMethod: googlePayCpm,
          nonCdeFormInputs: createInputsDictFromForm(context.formDiv),
          formCallbacks,
          customParams: { paymentData },
          initResult: {
            isAvailable: true,
            controller: {
              mountButton,
              dismountButton,
              waitForButtonToMount: async () => await getElementByIdAsync(OJS_GPAY_BTN_ID),
              startFlow: async () => {},
            },
          },
        });
      } catch (err) {
        err__('Google Pay payment error', err);
        formCallbacks.get.onCheckoutError((err as Error)?.message ?? 'Unknown error');
      }
    };

    let googlePayButton: HTMLElement | null = null;
    const mountButton = async () => {
      const container = document.getElementById(OJS_GPAY_BTN_ID);
      if (container) {
        googlePayButton = getGooglePaymentsClient().createButton({
          // @ts-expect-error - onClick do not exists in createButton
          onClick: onGooglePayStartFlow,
        });

        container.appendChild(googlePayButton);
      }
    };

    const dismountButton = () => {
      if (googlePayButton) {
        googlePayButton.remove();
        googlePayButton = null;
      }
    };

    if (!initParams?.doNotMountOnInit) {
      log__('Mounting Google Pay button...');
      await mountButton();
    }

    return {
      isAvailable: true,
      controller: {
        mountButton,
        dismountButton,
        waitForButtonToMount: async () => await getElementByIdAsync(OJS_GPAY_BTN_ID),
        startFlow: async () => {
          log__('Starting Google Pay flow by clicking button...');
          await onGooglePayStartFlow();
        },
      },
    };
  }
);

const getElementByIdAsync = (id: string) =>
  new Promise<HTMLElement>((resolve) => {
    const getElement = () => {
      const element = document.getElementById(id);
      if (element) {
        resolve(element);
      } else {
        requestAnimationFrame(getElement);
      }
    };
    getElement();
  });

type RunGooglePayFlowParams = {
  paymentData: google.payments.api.PaymentData;
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

export const runAirwallexGooglePayFlow: RunOjsFlow<RunGooglePayFlowParams, InitGooglePayFlowResult> =
  addBasicCheckoutCallbackHandlers(
    async ({
      context,
      checkoutPaymentMethod,
      nonCdeFormInputs,
      customParams,
      formCallbacks,
    }): Promise<SimpleOjsFlowResult> => {
      log__('Starting Google Pay flow...', customParams.paymentData);
      const extractedBillingAddress = customParams.paymentData.paymentMethodData?.info?.billingAddress;

      // If billing form fields are empty, try to replace with GooglePay billing address
      if (extractedBillingAddress) {
        const googlePayAddressToOjsFormFields = {
          [FieldName.EMAIL]: customParams.paymentData?.email,
          [FieldName.COUNTRY]: extractedBillingAddress?.countryCode,
          [FieldName.ADDRESS]: extractedBillingAddress?.address1,
          [FieldName.CITY]: extractedBillingAddress?.locality,
          [FieldName.ZIP_CODE]: extractedBillingAddress?.postalCode,
          [FieldName.STATE]: extractedBillingAddress?.administrativeArea,
          [FieldName.FIRST_NAME]: extractedBillingAddress?.name?.split(' ')?.[0],
          [FieldName.LAST_NAME]: extractedBillingAddress?.name?.split(' ')?.[1],
        };

        for (const [fieldName, value] of Object.entries(googlePayAddressToOjsFormFields)) {
          if (!nonCdeFormInputs[fieldName]) {
            nonCdeFormInputs[fieldName] = value;
          }
        }
      }

      log__('Non-CDE fields to validate', nonCdeFormInputs);
      const nonCdeFormFields = validateNonCdeFormFieldsForCC(nonCdeFormInputs, formCallbacks.get.onValidationError);
      const anyCdeConnection = context.anyCdeConnection;
      const prefill = await getPrefill(anyCdeConnection);

      // Extract encrypted payment token from Google Pay response
      const encryptedPaymentToken = customParams.paymentData.paymentMethodData?.tokenizationData?.token;
      if (!encryptedPaymentToken) {
        throw new Error('No payment token received from Google Pay');
      }

      const startPaymentFlowResponse = await startPaymentFlow(anyCdeConnection, {
        payment_provider: checkoutPaymentMethod.provider,
        checkout_payment_method: checkoutPaymentMethod,
        new_customer_email: nonCdeFormFields[FieldName.EMAIL],
        new_customer_first_name: nonCdeFormFields[FieldName.FIRST_NAME],
        new_customer_last_name: nonCdeFormFields[FieldName.LAST_NAME],
        payment_method_data: {
          type: 'googlepay',
          googlepay: {
            payment_data_type: 'encrypted_payment_token',
            encrypted_payment_token: encryptedPaymentToken,
          },
        },
      });

      let ourPmId: string | undefined = undefined;
      let possibleNextAction: Common3DSNextActionMetadata | null = null;

      try {
        possibleNextAction = parseAirwallex3DSNextActionMetadata(startPaymentFlowResponse);
        log__('Possible next action', possibleNextAction);
      } catch (e) {
        err__('Not required 3DS verification', e);
      }
      // Handle 3DS if required
      if (possibleNextAction?.type === 'airwallex_payment_consent' && possibleNextAction.redirect_url) {
        const { status } = await start3dsVerification({
          url: possibleNextAction.redirect_url,
          baseUrl: context.baseUrl,
        });
        log__(`╰ 3DS verification completed [Status: ${status}]`);
        if (status === ThreeDSStatus.CANCELLED) {
          throw new Error('3DS verification cancelled');
        }
        if (status === ThreeDSStatus.FAILURE) {
          throw new Error('3DS verification failed');
        }
      }

      // Always confirm payment flow, with or without 3DS
      const confirmResult = await confirmPaymentFlow(anyCdeConnection, {
        secure_token: prefill.token,
        consent_id: possibleNextAction?.consent_id,
        their_pm_id: possibleNextAction?.their_pm_id,
        payment_method_data: {
          type: 'googlepay',
          googlepay: {
            payment_data_type: 'encrypted_payment_token',
            encrypted_payment_token: encryptedPaymentToken,
          },
        },
      });
      log__('Confirm result', confirmResult);
      ourPmId = confirmResult.payment_methods?.[0]?.id;

      log__('Start payment flow response', startPaymentFlowResponse);
      const nextActionMetadata = startPaymentFlowResponse.required_user_actions;
      log__('Next action metadata', nextActionMetadata);

      if (prefill.mode === 'setup') {
        if (!ourPmId) {
          throw new Error('No PM ID found');
        }
        return { mode: 'setup', result: { payment_method_id: ourPmId } };
      } else {
        // Handle one-time payment flow
        log__(`Starting one-time payment flow...`);
        const checkoutRequest: CheckoutRequest = {
          secure_token: prefill.token,
          payment_input: {
            provider_type: checkoutPaymentMethod.provider,
          },
          do_not_use_legacy_cc_flow: true,
          use_confirmed_pm_id: ourPmId,
          line_items: prefill.line_items,
          total_amount_atom: prefill.amount_total_atom,
          cancel_at_end: false,
          checkout_payment_method: checkoutPaymentMethod,
          customer_email: nonCdeFormFields[FieldName.EMAIL],
          customer_zip_code: nonCdeFormFields[FieldName.ZIP_CODE],
          customer_country: nonCdeFormFields[FieldName.COUNTRY],
          promotion_code: nonCdeFormFields[FieldName.PROMOTION_CODE],
        };
        const result = await performCheckout(anyCdeConnection, checkoutRequest);
        return { mode: 'checkout', result };
      }
    }
  );
