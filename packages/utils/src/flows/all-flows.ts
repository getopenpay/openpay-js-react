import { CheckoutPaymentMethod } from '../shared-models';
import { OjsContext } from './ojs-flow';
import { runStripeCcFlow } from './stripe/stripe-cc-flow';

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
  // Add all flows here, remember to run `make build` after to expose to the dependent libraries
  runStripeCcFlow,
};

export type { OjsContext };
