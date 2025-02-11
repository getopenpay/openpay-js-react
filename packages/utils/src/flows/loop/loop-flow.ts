import { z } from 'zod';
import { getPrefill } from '../../cde-client';
import {
  addBasicCheckoutCallbackHandlers,
  addErrorCatcherForInit,
  createOjsFlowLoggers,
  InitOjsFlow,
  RunOjsFlow,
  SimpleOjsFlowResult,
} from '../ojs-flow';
import { findCpmMatchingType } from '../common/common-flow-utils';
import { LoopInitConnectProps, LoopWidgetProps, PayInCompleteEvent, PayInCustomerCreatedEvent, PayInFailedEvent } from './types';


const { log__, err__ } = createOjsFlowLoggers('loop');

// 👉 CustomParams are passed when the flow is run. It is optional, and can be undefined.
// - Most of the time, you can remove this type.
// - Params can be from anywhere, can even be passed from the user
// - Can also be used to differentiate different instances of runFlow
//   - E.g. 'apple_pay' or 'google_pay' for running stripe PR flow
export type LoopFlowCustomParams =
  | {
      customer: PayInCustomerCreatedEvent;
      payin: PayInCompleteEvent;
      success: true;
    }
  | {
      detail: PayInFailedEvent;
      success: false;
    };

// 👉 FlowSuccess is returned by initFlow, and is passed to runFlow.
// - If you don't have an init flow, you can remove this type.
export type InitLoopFlowSuccess =
  | {
      isAvailable: true;
      widgetProps: LoopWidgetProps;
      initLoopConnectProps: LoopInitConnectProps;
    }
  | {
      isAvailable: false;
    };

// 👉 For convenience, you can use zod to define which CPMs are accepted by this flow
// - See CheckoutPaymentMethod for more details
export const LoopCpm = z.object({
  processor_name: z.literal('loop'),
});
export type LoopCpm = z.infer<typeof LoopCpm>;

// 👉 initFlow -- this is optional, use this only when you need to initialize something at load time, before runFlow()
// - We use the decorator addErrorCatcherForInit to automatically catch errors (on error, it returns isAvailable: false)
// - 👉 Note! if you need to pass custom params to initFlow, please pass it through OjsContext.customInitParams
/*
 * Initializes the Loop flow (put more details here)
 */
export const initLoopFlow: InitOjsFlow<InitLoopFlowSuccess> = addErrorCatcherForInit(
  async ({ context }): Promise<InitLoopFlowSuccess> => {
    log__(`Checking if there are any CPMs for Loop...`);
    const checkoutPaymentMethod = findCpmMatchingType(context.checkoutPaymentMethods, LoopCpm);
    log__(`checkoutPaymentMethod: ${checkoutPaymentMethod}`);

    // 👉 Examples of logs. You can also use logs as headers/sections of code blocks
    log__(`Starting loop flow...`);
    const prefill = await getPrefill(context.anyCdeConnection);
    const isSetupMode = prefill.mode === 'setup';
    log__(`isSetupMode: ${isSetupMode}`);
    err__(`Example of an error log`);

    // 👉 Fill in the rest here
    // generate the props to pass to the react component here:
    const paymentUsdAmount = 100;
    // authorize for 3 years worth of payments (if monthly)
    const suggestedAuthorizationUsdAmount = paymentUsdAmount * 12 * 3;
    const subscriptionRefId = '';
    const customerRefId = '';
    const invoiceRefId = '';

    const widgetProps = {
      paymentUsdAmount,
      suggestedAuthorizationUsdAmount,
      subscriptionRefId,
      customerRefId,
      invoiceRefId,
    }

    const apiKey = '964d4532-3ce4-45b2-a339-192dc46ebc76';
    const entityId= 'dc1a2948-c72a-439e-9f0f-788e4c4cad80';
    const merchantId = 'dc1a2948-c72a-439e-9f0f-788e4c4cad80';
    const environment = 'staging';

    const onInitialized = ({ entityId }: { entityId: string }) => { log__(entityId) };
    const onInitFailed = ({ type, message, data }: { type: string, message: string, data: any }) => { log__(`${type} ${message} ${data}`) };
    const onWalletChange = ({ address }: { address: string }) => log__(`${address}`);
    const onNetworkChange = ({ id, name, chain }: { id: string, name: string, chain: string }) => log__(`${id} ${name} ${chain}`);

    const initLoopConnectProps: LoopInitConnectProps = {
      apiKey,
      entityId,
      merchantId,
      environment,
      onInitialized,
      onInitFailed,
      onWalletChange,
      onNetworkChange,
    };


    return {
      isAvailable: true,
      widgetProps,
      initLoopConnectProps,
    };
  }
);

/*
 * Runs the main foobar flow
 * 👉 runFlow -- this is the main submission flow, 90% of the time, it is meant to be triggered on checkout form submission.
 * 👉 The type arguments (FoobarFlowCustomParams, InitFoobarFlowSuccess) are optional, and can be set undefined.
 *    - i.e. you can use "RunOjsFlow" as-is, without any type arguments.
 */
export const runLoopFlow: RunOjsFlow<LoopFlowCustomParams, InitLoopFlowSuccess> =
  addBasicCheckoutCallbackHandlers(
    async ({
      context,
      checkoutPaymentMethod,
      nonCdeFormInputs,
      formCallbacks,
      customParams,
      initResult,
    }): Promise<SimpleOjsFlowResult> => {
      log__(`Running Loop flow...`);
      const anyCdeConnection = context.anyCdeConnection;
      log__(
        "anyCdeConnection is convenient if you just need to do a simple CDE query -- you usually don't need all of them",
        anyCdeConnection
      );

      // 👉 There are multiple params passed to runFlow
      // - See the definitions in OjsFlowParams for more details
      log__('context', context);
      log__('checkoutPaymentMethod', checkoutPaymentMethod);
      log__('nonCdeFormInputs', nonCdeFormInputs);
      log__('flowCallbacks', formCallbacks);
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



/**
customer:
{
    "customerId": "bdf7476c-151a-476c-b89a-87662dcf0d53",
    "customerRefId": null,
    "subscriptionRefId": null,
    "merchant": {
        "merchantId": "dc1a2948-c72a-439e-9f0f-788e4c4cad80",
        "merchantName": "BetaWorks Inc",
        "merchantRefId": null
    },
    "paymentMethods": [
        {
            "paymentMethodId": "7b28616a-2519-4571-8966-18f1eb11f078",
            "paymentMethodName": "0x6be5a6dc7760d9787097405c67391D134Da923e7",
            "networkId": 11155111,
            "walletAddress": "0x6be5a6dc7760d9787097405c67391D134Da923e7",
            "isDefault": true,
            "token": {
                "tokenId": "c4359c1f-bf26-11ef-8721-06361809e991",
                "address": "0x1c7d4b196cb0c7b01d743fbc6116a902379c7238",
                "symbol": "USDC",
                "decimals": 6,
                "exchangeRates": [
                    {
                        "currency": "USD",
                        "price": "10000",
                        "timestamp": 1739232065
                    }
                ]
            },
            "preAuthorization": {
                "balance": "19.0",
                "authorization": "99.0"
            }
        }
    ],
    "dateCreated": 1739232065
}

payin:
{
    "payinId": "ca67d0e0-0085-48f9-9905-de6e84e7290b",
    "merchantId": "dc1a2948-c72a-439e-9f0f-788e4c4cad80",
    "amount": "1000000",
    "amountType": "token",
    "billDate": 1739232067,
    "invoiceId": "6e947fda-5ba3-4ca6-a0c6-4c4f66e54f5e",
    "externalInvoiceRef": null,
    "payinType": "subscription",
    "payinStatus": "pending",
    "transaction": {
        "transactionId": "0xa40d19902e828aa85ee9a2e57a56e1e60b0bfa7d455ee1e0897245a75c30b833",
        "transactionUrl": "https://sepolia.etherscan.io//tx/0xa40d19902e828aa85ee9a2e57a56e1e60b0bfa7d455ee1e0897245a75c30b833",
        "amountTransferred": null,
        "exchangeRate": null
    },
    "paymentMethod": {
        "paymentMethodId": "7b28616a-2519-4571-8966-18f1eb11f078",
        "paymentMethodName": "0x6be5a6dc7760d9787097405c67391D134Da923e7",
        "networkId": 11155111,
        "walletAddress": "0x6be5a6dc7760d9787097405c67391D134Da923e7",
        "isDefault": true,
        "token": {
            "tokenId": "c4359c1f-bf26-11ef-8721-06361809e991",
            "address": "0x1c7d4b196cb0c7b01d743fbc6116a902379c7238",
            "symbol": "USDC",
            "decimals": 6,
            "exchangeRates": [
                {
                    "currency": "USD",
                    "price": "10000",
                    "timestamp": 1739232068
                }
            ]
        },
        "preAuthorization": {
            "balance": "19.0",
            "authorization": "99.0"
        },
        "status": "ok"
    },
    "payoutDestination": {
        "payoutDestinationId": "7bcb6ae1-196c-4a84-b27e-32e693224433",
        "networkId": 11155111,
        "walletAddress": "0x38487E6147928c014A749795a04b67cCC95Efe61"
    },
    "description": null,
    "dateCreated": 1739232067
}
 */