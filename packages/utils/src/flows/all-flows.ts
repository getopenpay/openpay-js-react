import { CheckoutPaymentMethod } from '../shared-models';
import { OjsContext, OjsFlow } from './ojs-flow';
import { initStripeLinkFlow, runStripeLinkFlow } from './stripe/stripe-link-flow';
import { runCommonCcFlow } from './card/common-cc-flow';
import { initStripePrFlow, runStripePrFlow } from './stripe/stripe-pr-flow';

export const findCheckoutPaymentMethodStrict = (
  cpms: CheckoutPaymentMethod[],
  withProvider: string,
  withProcessor?: string
): CheckoutPaymentMethod => {
  const matches = cpms.filter((cpm) => {
    const matchesProcessor = withProcessor === undefined ? true : cpm.processor_name === withProcessor;
    const matchesProvider = cpm.provider === withProvider;
    return matchesProcessor && matchesProvider;
  });
  if (matches.length === 0) {
    console.error('CPMs list', cpms);
    throw new Error(`No CPMs found with provider '${withProvider}' and processor '${withProcessor}'`);
  }
  if (matches.length !== 1) {
    console.error('CPMs list', cpms);
    throw new Error(`More than one CPM found with provider '${withProvider}' and processor '${withProcessor}'`);
  }
  return matches[0];
};

export const OjsFlows = {
  // ✋ Note: For flows that require initialization, please add them to `init-flows.ts`

  // Common
  commonCC: {
    init: async () => {},
    run: runCommonCcFlow,
  },

  // Stripe
  stripePR: {
    init: initStripePrFlow,
    run: runStripePrFlow,
  },
  stripeLink: {
    init: initStripeLinkFlow,
    run: runStripeLinkFlow,
  },

  // 👉 Add more flows here

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} satisfies Record<string, OjsFlow<any, any>>;

export type { OjsContext };
