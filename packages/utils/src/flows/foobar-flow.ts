import { z } from 'zod';
import { getPrefill } from '../cde-client';
import {
  addBasicCheckoutCallbackHandlers,
  addErrorCatcherForInit,
  createOjsFlowLoggers,
  InitOjsFlow,
  RunOjsFlow,
  SimpleOjsFlowResult,
} from './ojs-flow';
import { findCpmMatchingType } from './common/common-flow-utils';

// 👉 Special loggers, edit this to reflect the flow name
const { log__, err__ } = createOjsFlowLoggers('foobar');

// 👉 CustomParams are passed when the flow is run. It is optional, and can be undefined
// - Params can be from anywhere, can even be passed from the user
// - Can also be used to differentiate different instances of runFlow
//   - E.g. 'apple_pay' or 'google_pay' for running stripe PR flow
export type FoobarFlowCustomParams = {
  // Can be of any form
};

// 👉 FlowSuccess is returned by initFlow, and is passed to runFlow.
// - If you don't have an init flow, you can remove this type.
export type InitFoobarFlowSuccess = {
  // Should conform to InitOjsFlowResult
  isAvailable: boolean;
};

// 👉 For convenience, you can use zod to define which CPMs are accepted by this flow
export const FoobarCpm = z.object({
  processor_name: z.literal('foobar'),
});
export type FoobarCpm = z.infer<typeof FoobarCpm>;

// 👉 initFlow -- this is optional, use this only when you need to initialize something at load time, before runFlow()
// - We use the decorator addErrorCatcherForInit to automatically catch errors. It returns isAvailable: false
/*
 * Initializes the Foobar flow (put more details here)
 */
export const initFoobarFlow: InitOjsFlow<InitFoobarFlowSuccess> = addErrorCatcherForInit(
  async ({ context }): Promise<InitFoobarFlowSuccess> => {
    log__(`Checking if there are any CPMs for Stripe PR...`);
    const checkoutPaymentMethod = findCpmMatchingType(context.checkoutPaymentMethods, FoobarCpm);
    log__(`checkoutPaymentMethod: ${checkoutPaymentMethod}`);

    // 👉 Examples of logs. You can also use logs as headers/sections of code blocks
    log__(`Starting foobar flow...`);
    const anyCdeConnection = Array.from(context.cdeConnections.values())[0];
    const prefill = await getPrefill(anyCdeConnection);
    const isSetupMode = prefill.mode === 'setup';
    log__(`isSetupMode: ${isSetupMode}`);
    err__(`Example of an error log`);

    // 👉 Fill in the rest here
    const x = 42;
    if (x === 42) {
      // 👉 Since we have addErrorCatcherForInit, errors are automatically handled properly
      throw new Error('Not implemented yet');
    }

    return {
      isAvailable: true,
    };
  }
);

/*
 * Runs the main Stripe PaymentRequest flow
 */
export const runFoobarFlow: RunOjsFlow<FoobarFlowCustomParams, InitFoobarFlowSuccess> =
  addBasicCheckoutCallbackHandlers(
    async ({
      context,
      checkoutPaymentMethod,
      nonCdeFormInputs,
      flowCallbacks,
      customParams,
      initResult,
    }): Promise<SimpleOjsFlowResult> => {
      // 👉 There are multiple params passed to runFlow
      // - See the definitions in OjsFlowParams for more details
      log__('context', context);
      log__('checkoutPaymentMethod', checkoutPaymentMethod);
      log__('nonCdeFormInputs', nonCdeFormInputs);
      log__('flowCallbacks', flowCallbacks);
      log__('customParams', customParams);
      log__('initResult', initResult);

      // 👉 For the decorator addBasicCheckoutCallbackHandlers,
      // we need to return a CheckoutSuccessResponse or SetupCheckoutResponse through SimpleOjsFlowResult
      // - CDE functions like performCheckout return these objects for you. See cde-client.ts for more details
      return {
        mode: 'checkout',
        result: {
          invoice_urls: [],
          subscription_ids: [],
          customer_id: '',
        },
      };
    }
  );
