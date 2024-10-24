import { FC, useEffect } from 'react';
import { getGlobalStripeElements } from '../utils/stripe';

export type StripeLinkButtonProps = {
  className?: string;
  // Note that this can be from 40-55 px only
  buttonHeight?: number;
};

const OJS_STRIPE_LINK_ID = 'ojs-stripe-link-checkout';

const mountStripeLinkButton = (buttonHeight?: number): void => {
  if (buttonHeight !== undefined && buttonHeight > 55 && buttonHeight < 40) {
    console.warn(`stripeLink.button height must be between 40 and 55px. Got: ${buttonHeight} px`);
  }
  try {
    const { elements, confirmListener } = getGlobalStripeElements();
    const expressCheckoutElement = elements.create('expressCheckout', {
      buttonHeight,
      paymentMethods: {
        amazonPay: 'never',
        applePay: 'never',
        googlePay: 'never',
        paypal: 'never',
      },
    });
    expressCheckoutElement.mount(`#${OJS_STRIPE_LINK_ID}`);
    expressCheckoutElement.on('confirm', (event) => {
      console.log('Stripe link confirmed', event);
      confirmListener();
    });
  } catch (e) {
    console.error(e);
  }
};

export const StripeLinkButton: FC<StripeLinkButtonProps> = (props) => {
  const { className, buttonHeight } = props;

  useEffect(() => {
    mountStripeLinkButton(buttonHeight);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div id={OJS_STRIPE_LINK_ID} className={className}></div>;
};
