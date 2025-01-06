import { AdyenCheckout, PaymentAction } from '@adyen/adyen-web';

// TODO ASAP: get this from CPM
const ADYEN_CLIENT_KEY = 'test_YOAL2TVUI5EMFKL3GSDBJAZJPMKKQZA4';

export const showAdyen3dsWindow = async (action: PaymentAction) => {
  const checkout = await AdyenCheckout({
    clientKey: ADYEN_CLIENT_KEY,
    environment: 'test',
    locale: 'en-US',
    countryCode: 'US',
    // onAdditionalDetails: async (state, _component, actions) => {
    //   // Make the /payments/details call and pass the resultCode back to the Component.
    //   const { action, resultCode } = await makePaymentDetails(state.data);
    //   actions.resolve({ resultCode });
    // },
    onPaymentCompleted(result, component) {
      // Handle the successful payment flow.
      console.log('onPaymentCompleted', result, component);
    },
    onPaymentFailed(result, component) {
      // Handle the failed payment flow.
      console.log('onPaymentFailed', result, component);
    },
    // ... Your other AdyenCheckout configurations.
  });

  checkout.createFromAction(action, { challengeWindowSize: '02' }).mount('#adyen-example');
};

// @ts-expect-error window is not typed
window.showAdyen3dsWindow = showAdyen3dsWindow;
