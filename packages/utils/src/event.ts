import { v4 as uuidv4 } from 'uuid';
import { ElementEvent, FieldName, EventPayload, SubmitEventPayload, CheckoutPaymentMethod } from './shared-models';
import { extractIssuesPerField } from './zod-errors';

export const createInputsDictFromForm = (
  formDiv: HTMLElement,
  initialDict: Record<string, unknown>
): Record<string, unknown> => {
  const includedInputs: HTMLInputElement[] = Array.from(formDiv.querySelectorAll('input[data-opid]') ?? []);
  const extraData = includedInputs.reduce((acc, input) => {
    const key = input.getAttribute('data-opid');
    if (!key) return acc;
    return { ...acc, [key]: input.value };
  }, initialDict);
  return extraData;
};

// TODO refactor
export const constructSubmitEventPayload = (
  eventType: 'TOKENIZE' | 'CHECKOUT' | 'START_PAYMENT_FLOW',
  sessionId: string,
  formDiv: HTMLElement,
  onValidationError: (field: FieldName, errors: string[], elementId?: string) => void,
  checkoutPaymentMethod: CheckoutPaymentMethod,
  doNotUseLegacyCCFlow: boolean,
  paymentFlowMetadata?: Record<string, unknown>
): SubmitEventPayload | null => {
  const extraData = createInputsDictFromForm(formDiv, {
    type: eventType,
    sessionId,
    checkoutPaymentMethod,
    paymentFlowMetadata,
    doNotUseLegacyCCFlow,
  });

  console.log(`[form] Constructing ${eventType} payload:`, JSON.stringify(extraData));

  if (checkoutPaymentMethod.provider === 'apple_pay' || checkoutPaymentMethod.provider === 'google_pay') {
    if (!extraData[FieldName.ZIP_CODE]) {
      console.log('[form] Overriding empty zip code (only for google and apple pay)');
      extraData[FieldName.ZIP_CODE] = '00000';
    }
  }

  const payload = SubmitEventPayload.safeParse(extraData);

  if (!payload.success) {
    const formatted = payload.error.format();
    const issues = extractIssuesPerField(formatted);
    for (const [fieldName, errors] of Object.entries(issues)) {
      onValidationError(fieldName as FieldName, errors, fieldName);
    }
    console.log('[form] Constructed payload in FAIL:', payload.data);
    return null;
  } else {
    console.log('[form] Constructed payload:', JSON.stringify(payload.data));
    return payload.data;
  }
};

export const parseEventPayload = (eventData: object): ElementEvent => {
  try {
    return ElementEvent.parse(eventData);
  } catch (error) {
    console.error('Error parsing event payload:', eventData, error);
    throw error;
  }
};

export const emitEvent = (
  target: MessageEventSource,
  formId: string,
  elementId: string,
  payload: EventPayload,
  baseUrl: string
): void => {
  const event: ElementEvent = {
    payload,
    nonce: uuidv4(),
    formId,
    elementId,
  };

  console.log(`[form ${formId}] Sending event to child ${elementId}:`, event);
  // @ts-expect-error postMessage typing error?
  target.postMessage(JSON.stringify(event), baseUrl);
};
