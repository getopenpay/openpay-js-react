import { z } from 'zod';
import { CdeConnection, CdeMessage } from './cde-connection';
import {
  Amount,
  CheckoutPreviewRequest,
  ConfirmPaymentFlowRequest,
  ConfirmPaymentFlowResponse,
  FieldName,
  PaymentFlowStartedEventPayload,
  SubmitEventPayload,
} from './shared-models';
import { CDEResponseError, PaymentFormPrefill, PreviewCheckoutResponse } from './cde_models';
import { sleep } from './stripe';
import { sum } from './math';

export const queryCDE = async <T extends z.ZodType>(
  cdeConn: CdeConnection,
  data: CdeMessage,
  responseSchema: T
): Promise<z.infer<T>> => {
  // Leaving these as commented out for easier debugging later
  console.log('[cde-client] Querying CDE with path and connection:', data.type, cdeConn);
  const response = await cdeConn.send(data);
  if (isCDEResponseError(response)) {
    throw new Error(`[cde-client] Error querying CDE: ${response.message}`);
  }
  console.log('[cde-client] Got response from CDE:', response);
  if (!checkIfConformsToSchema(response, responseSchema)) {
    const result = responseSchema.safeParse(response);
    if (result.success) throw new Error('Invalid state');
    console.error('OJS queryApi got a schema error. Expected schema:', responseSchema, 'Actual:', response);
    throw result.error;
  }
  return response;
};

const checkIfConformsToSchema = <T extends z.ZodType>(value: unknown, schema: T): value is T => {
  return schema.safeParse(value).success;
};

const isCDEResponseError = (response: unknown): response is CDEResponseError => {
  return CDEResponseError.safeParse(response).success;
};

// Endpoints start here

export const getCheckoutPreview = async (
  cdeConn: CdeConnection,
  request: CheckoutPreviewRequest
): Promise<PreviewCheckoutResponse> => {
  return await queryCDE(cdeConn, { type: 'get_checkout_preview', payload: request }, PreviewCheckoutResponse);
};

export const getPrefill = async (cdeConn: CdeConnection): Promise<PaymentFormPrefill> => {
  return await queryCDE(cdeConn, { type: 'get_prefill', payload: {} }, PaymentFormPrefill);
};

export const startPaymentFlow = async (
  cdeConn: CdeConnection,
  payload: SubmitEventPayload
): Promise<PaymentFlowStartedEventPayload> => {
  return await queryCDE(cdeConn, { type: 'start_payment_flow', payload }, PaymentFlowStartedEventPayload);
};

export const confirmPaymentFlow = async (
  cdeConn: CdeConnection,
  payload: ConfirmPaymentFlowRequest
): Promise<ConfirmPaymentFlowResponse> => {
  return await queryCDE(cdeConn, { type: 'confirm_payment_flow', payload }, ConfirmPaymentFlowResponse);
};

export const waitForFormFieldInput = async (
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

export const getCheckoutValue = async (
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