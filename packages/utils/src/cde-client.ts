import { z } from 'zod';
import { CdeConnection, CdeMessage } from './cde-connection';
import {
  CheckoutPreviewRequest,
  ConfirmPaymentFlowRequest,
  ConfirmPaymentFlowResponse,
  PaymentFlowStartedEventPayload,
  SubmitEventPayload,
} from './shared-models';
import { CDEResponseError, PaymentFormPrefill, PreviewCheckoutResponse } from './cde_models';

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
