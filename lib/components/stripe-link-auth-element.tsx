import { FC, useEffect } from 'react';
import { getGlobalStripeElements } from '../utils/stripe';

export type LinkAuthElementProps = {
  className?: string;
};

const OJS_STRIPE_LINK_AUTH_ID = 'ojs-stripe-link-auth';

const mountElement = (): void => {
  try {
    const { elements } = getGlobalStripeElements();
    // Note: please keep this here for now
    // const expressCheckoutElement = elements.create('expressCheckout', {
    //   buttonHeight,
    //   paymentMethods: {
    //     amazonPay: 'never',
    //     applePay: 'never',
    //     googlePay: 'never',
    //     paypal: 'never',
    //   },
    // });
    // expressCheckoutElement.mount(`#${OJS_STRIPE_LINK_ID}`);
    // expressCheckoutElement.on('confirm', (event) => {
    //   console.log('Stripe link confirmed', event);
    //   confirmListener();
    // });
    // const linkAuthenticationElement = elements.create('linkAuthentication');
    // linkAuthenticationElement.mount(`#${OJS_STRIPE_LINK_AUTH_ID}`);

    const paymentElement = elements.create('payment', {
      wallets: {
        googlePay: 'never',
      },
    });
    paymentElement.mount(`#${OJS_STRIPE_LINK_AUTH_ID}`);
  } catch (e) {
    console.error(e);
  }
};

export const StripeLinkAuthElement: FC<LinkAuthElementProps> = (props) => {
  const { className } = props;

  useEffect(() => {
    mountElement();
  }, []);

  return <div id={OJS_STRIPE_LINK_AUTH_ID} className={className}></div>;
};
