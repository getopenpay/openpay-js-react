import useAsyncEffect from 'use-async-effect';
import { Amount, FieldName } from '@getopenpay/utils';
import { sleep } from '@getopenpay/utils';
import { useState } from 'react';
import useDebounce from './use-debounce';
import { getCheckoutPreview, getPrefill } from '@getopenpay/utils';
import { CdeConnection } from '@getopenpay/utils';
import { sum } from '@getopenpay/utils';
import { getErrorMessage } from '@getopenpay/utils';

export type DynamicPreview = {
  amount: Amount | null;
  isLoading: boolean;
  error: string | null;
};

export const useDynamicPreview = (
  isEnabled: boolean,
  cdeConn: CdeConnection | null,
  secureToken: string | undefined,
  formDiv: HTMLDivElement | null
): DynamicPreview => {
  const [promoCodeInput, setPromoCodeInput] = useState<string>('');
  const [promoCodeDebounced, setPromoCodeDebounced] = useState<string>('');
  const [previewAmt, setPreviewAmt] = useState<Amount | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState<boolean>(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Setup input listeners
  useAsyncEffect(async () => {
    if (!formDiv || !isEnabled) {
      return;
    }
    const promoCodeInput = await waitForFormFieldInput(formDiv, FieldName.PROMOTION_CODE);
    promoCodeInput?.addEventListener('input', () => {
      setIsPreviewLoading(true);
      setPreviewError(null);
      setPromoCodeInput(promoCodeInput.value);
    });
  }, [!!formDiv, isEnabled]);

  // Debounce inputs
  useDebounce(
    () => {
      if (!isEnabled) {
        return;
      }
      setPromoCodeDebounced(promoCodeInput);
    },
    1000,
    [promoCodeInput, isEnabled]
  );

  // Fire queries based on debounced inputs
  useAsyncEffect(
    async (isMounted) => {
      try {
        if (!cdeConn || !secureToken || !isEnabled) {
          return;
        }
        const prefill = await getPrefill(cdeConn);
        const isSetupMode = prefill.mode === 'setup';
        const preview = await getCheckoutPreviewAmount(cdeConn, secureToken, isSetupMode, promoCodeDebounced);
        console.log('[useDynamicPreview] Querying. Promo code:', promoCodeDebounced);
        if (isMounted()) {
          console.log('[useDynamicPreview] Setting preview:', promoCodeDebounced, preview);
          setPreviewError(null);
          setPreviewAmt(preview);
        } else {
          console.log('[useDynamicPreview] Discarding:', preview);
        }
      } catch (e) {
        if (isMounted()) {
          console.error(`[useDynamicPreview] Error doing preview`, getErrorMessage(e));
          setPreviewError(getErrorMessage(e));
        }
      } finally {
        if (isMounted()) {
          setIsPreviewLoading(false);
        }
      }
    },
    [!cdeConn, !secureToken, promoCodeDebounced, isEnabled]
  );

  return {
    amount: previewAmt,
    isLoading: isPreviewLoading,
    error: previewError,
  };
};

const waitForFormFieldInput = async (
  formDiv: HTMLDivElement,
  fieldName: FieldName,
  waitTimeMs?: number
): Promise<HTMLInputElement | null> => {
  const startWaitTime = Date.now();
  waitTimeMs = waitTimeMs ?? 5000;
  while (Date.now() - startWaitTime < waitTimeMs) {
    const match = formDiv.querySelector(`input[data-opid=${fieldName}]`);
    if (match !== null) {
      if (!(match instanceof HTMLInputElement)) {
        throw new Error(`Invalid state: matched input element had wrong class: ${match.tagName}`);
      }
      return match;
    }
    await sleep(300);
  }
  console.warn('Cannot find promo code input');
  return null;
};

const getCheckoutValue = async (
  cdeConn: CdeConnection,
  secureToken: string,
  promoCode: string | undefined
): Promise<Amount> => {
  const checkoutPreview = await getCheckoutPreview(cdeConn, {
    secure_token: secureToken,
    promotion_code: promoCode,
  });
  const currencies = new Set(checkoutPreview.preview.invoices.map((inv) => inv.currency));
  if (currencies.size !== 1) {
    throw new Error(`Expected exactly one currency, got ${currencies.size}`);
  }
  const currency = currencies.values().next().value ?? 'usd';
  const amountAtom = sum(checkoutPreview.preview.invoices.map((inv) => inv.remaining_amount_atom));
  return {
    currency,
    amountAtom,
  };
};

export const getCheckoutPreviewAmount = async (
  cdeConn: CdeConnection,
  secureToken: string,
  isSetupMode: boolean,
  promoCode: string | undefined
): Promise<Amount> => {
  // TODO refactor this later
  if (isSetupMode) {
    // TODO check later if there's a way to know currency in advance for setup mode
    return { amountAtom: 0, currency: 'usd' };
  } else {
    promoCode = !promoCode ? undefined : promoCode;
    const checkoutPreview = await getCheckoutValue(cdeConn, secureToken, promoCode);
    return { amountAtom: checkoutPreview.amountAtom, currency: checkoutPreview.currency };
  }
};
