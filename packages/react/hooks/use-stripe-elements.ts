import { CdeConnection } from '@getopenpay/utils';
import { CheckoutPaymentMethod } from '@getopenpay/utils';
import { getCheckoutPreviewAmount } from './use-dynamic-preview';
import { DynamicPreview } from '@getopenpay/utils';
import { useEffect, useState } from 'react';
import useAsyncEffect from 'use-async-effect';
import {
  createElementsOptions,
  createStripeElements,
  getGlobalStripeElements,
  hasGlobalStripeElements,
  parseStripePubKey,
  setGlobalStripeElements,
} from '@getopenpay/utils';
import { getPrefill } from '@getopenpay/utils';

export type UseStripeElementsOutput = {
  isReady: boolean;
};

export const useStripeElements = (
  cdeConn: CdeConnection | null,
  secureToken: string | undefined,
  availableCPMs: CheckoutPaymentMethod[] | undefined,
  formDiv: HTMLDivElement | null,
  onUserCompleteUIFlow: (checkoutPaymentMethod: CheckoutPaymentMethod) => void,
  dynamicPreview: DynamicPreview
): UseStripeElementsOutput => {
  const isLoading = secureToken === undefined || availableCPMs === undefined || !formDiv || !cdeConn;
  const previewAmount = dynamicPreview.amount;
  const [isSetupMode, setIsSetupMode] = useState<boolean | null>(null);
  const [isReady, setIsReady] = useState<boolean>(false);

  // Update elements when preview changes
  useEffect(() => {
    if (!hasGlobalStripeElements() || !previewAmount || isSetupMode === null) {
      return;
    }
    const elements = getGlobalStripeElements().elements;
    elements.update(createElementsOptions(previewAmount));
  }, [previewAmount, isSetupMode]);

  // Stripe link
  useAsyncEffect(async () => {
    if (isLoading) {
      // Do nothing
      return;
    }

    const stripeLinkCPM = availableCPMs.filter(
      (cpm) => cpm.processor_name === 'stripe' && cpm.provider === 'stripe_link'
    );
    if (stripeLinkCPM.length === 0) {
      throw new Error(`Stripe link is not available as a checkout method`);
    }
    const stripePubKey = parseStripePubKey(stripeLinkCPM[0].metadata);
    const prefill = await getPrefill(cdeConn);
    const isSetupMode = prefill.mode === 'setup';
    setIsSetupMode(isSetupMode);

    const initialPreview = await getCheckoutPreviewAmount(cdeConn, secureToken, isSetupMode, undefined);

    const { elements, stripe } = await createStripeElements(stripePubKey, createElementsOptions(initialPreview));
    setGlobalStripeElements(elements, () => onUserCompleteUIFlow(stripeLinkCPM[0]), stripe);
    setIsReady(true);

    // const canMakePayment = await pr.canMakePayment();
    // console.log('Can make payment?', canMakePayment);
  }, [isLoading]);

  return {
    isReady,
  };
};
