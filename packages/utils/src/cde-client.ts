import { z } from 'zod';
import { CdeConnection, CdeMessage } from './cde-connection';
import {
  Amount,
  CardElementsCheckoutRequest,
  CheckoutPreviewRequest,
  ConfirmPaymentFlowRequest,
  ConfirmPaymentFlowResponse,
  ElementType,
  FieldName,
  PaymentFlowStartedEventPayload,
  SetupCheckoutRequest,
  SubmitEventPayload,
  TokenizeCardRequest,
  TokenizeCardResponse,
} from './shared-models';
import {
  CDEResponseError,
  CheckoutSuccessResponse,
  PaymentFormPrefill,
  PreviewCheckoutResponse,
  SetupCheckoutResponse,
  StartPaymentFlowForCCRequest,
  StartPaymentFlowForCCResponse,
} from './cde_models';
import { sleep } from './stripe';
import { sum } from './math';
import { CustomError } from 'ts-custom-error';

/*
 * An actual custom Error object, created from a CDEResponseError object
 * Note that CDEResponseError is a normal JSON (zod) object returned by CDE endpoints,
 * while this class is a real subclass of Error.
 */
export class CdeError extends CustomError {
  response: CDEResponseError;

  public constructor(response: CDEResponseError) {
    const friendlyMessage = `[cde-client] Error querying CDE: ${response.message}`;
    super(friendlyMessage);
    this.response = response;
  }

  get originalErrorMessage(): string {
    return this.response.message;
  }
}

export const queryCDE = async <T extends z.ZodType>(
  cdeConn: CdeConnection,
  data: CdeMessage,
  responseSchema: T
): Promise<z.infer<T>> => {
  // Leaving these as commented out for easier debugging later
  console.log('[cde-client] Querying CDE with path and connection:', data.type, cdeConn);
  const response = await cdeConn.send(data);
  if (isCDEResponseError(response)) {
    throw new CdeError(response);
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

export const startPaymentFlowForCC = async (
  cdeConn: CdeConnection,
  payload: StartPaymentFlowForCCRequest
): Promise<StartPaymentFlowForCCResponse> => {
  return await queryCDE(cdeConn, { type: 'start_payment_flow_for_cc', payload }, StartPaymentFlowForCCResponse);
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

export const tokenizeCard = async (
  allCdeConnections: Map<ElementType, CdeConnection>,
  payload: TokenizeCardRequest
): Promise<TokenizeCardResponse[]> => {
  if (allCdeConnections.size === 0) {
    throw new Error('No CDE connections found');
  }
  const responses = await Promise.all(
    Array.from(allCdeConnections.values()).map((cdeConn) =>
      queryCDE(cdeConn, { type: 'tokenize_card', payload }, TokenizeCardResponse)
    )
  );
  return responses;
};

export const checkoutCardElements = async (
  cdeConn: CdeConnection,
  payload: CardElementsCheckoutRequest
): Promise<CheckoutSuccessResponse> => {
  return await queryCDE(cdeConn, { type: 'checkout_card_elements', payload }, CheckoutSuccessResponse);
};

export const setupCheckout = async (
  cdeConn: CdeConnection,
  payload: SetupCheckoutRequest
): Promise<SetupCheckoutResponse> => {
  return await queryCDE(cdeConn, { type: 'setup_payment_method', payload }, SetupCheckoutResponse);
};
