import {
  createInputsDictFromForm,
  findCheckoutPaymentMethodStrict,
  FormCallbacks,
  OjsContext,
  OjsFlows,
  OjsInitFlowsPublishers,
  PaymentRequestProvider,
  PaymentRequestStartParams,
  PRStatuses,
} from '@getopenpay/utils';
import { InitStripePrFlowResult, InitStripePrFlowSuccess } from '@getopenpay/utils/src/flows/stripe/stripe-pr-flow';

type InitPrFlows = {
  stripePR: OjsInitFlowsPublishers['stripePR'];
};

export const setupPaymentRequestHandlers = (
  initPrFlows: InitPrFlows,
  context: OjsContext,
  callbacks: FormCallbacks
): void => {
  const { stripePR } = initPrFlows;

  stripePR.publisher.subscribe((result) => {
    if (result.isSuccess) {
      const initResult: InitStripePrFlowResult = result.loadedValue;
      const canApplePay = initResult.isAvailable && initResult.availableProviders.applePay;
      const canGooglePay = initResult.isAvailable && initResult.availableProviders.googlePay;
      const finalStatus: PRStatuses = {
        apple_pay: {
          isLoading: false,
          isAvailable: canApplePay,
          startFlow: async (userParams) => {
            if (canApplePay) {
              runStripePrFlow('apple_pay', initResult, context, callbacks, userParams);
            }
          },
        },
        google_pay: {
          isLoading: false,
          isAvailable: canGooglePay,
          startFlow: async (userParams) => {
            if (canGooglePay) {
              runStripePrFlow('google_pay', initResult, context, callbacks, userParams);
            }
          },
        },
      };
      callbacks.get.onPaymentRequestLoad?.(finalStatus);
    }
  });
};

const runStripePrFlow = (
  provider: PaymentRequestProvider,
  initResult: InitStripePrFlowSuccess,
  context: OjsContext,
  formCallbacks: FormCallbacks,
  params?: PaymentRequestStartParams
): Promise<void> => {
  return OjsFlows.stripePR.run({
    context,
    checkoutPaymentMethod: findCheckoutPaymentMethodStrict(context.checkoutPaymentMethods, provider),
    nonCdeFormInputs: createInputsDictFromForm(context.formDiv),
    formCallbacks,
    customParams: { provider, overridePaymentRequest: params?.overridePaymentRequest },
    initResult,
  });
};
