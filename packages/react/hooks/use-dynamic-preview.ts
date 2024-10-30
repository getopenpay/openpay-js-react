import useAsyncEffect from 'use-async-effect';
import {
  Amount,
  FieldName,
  CdeConnection,
  getErrorMessage,
  getPrefill,
  DynamicPreview,
  waitForFormFieldInput,
  getCheckoutPreviewAmount,
} from '@getopenpay/utils';
import { useState } from 'react';
import useDebounce from './use-debounce';

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
