import { v4 as uuidv4 } from 'uuid';
import { FRAME_BASE_URL } from './constants';
import { ElementEvent, EventPayload, SubmitEventPayload } from './shared-models';

export const constructSubmitEventPayload = (formDiv: HTMLDivElement): SubmitEventPayload => {
  const includedInputs: HTMLInputElement[] = Array.from(formDiv.querySelectorAll('input[data-opid]') ?? []);
  const extraData = includedInputs.reduce((acc, input) => {
    const key = input.getAttribute('data-opid');
    if (!key) return acc;
    return { ...acc, [key]: input.value };
  }, {});

  return SubmitEventPayload.parse(extraData);
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
  payload: EventPayload
): void => {
  const event: ElementEvent = {
    payload,
    nonce: uuidv4(),
    formId,
    elementId,
  };

  console.log(`[form ${formId}] Sending event to child ${elementId}:`, event);
  target.postMessage(JSON.stringify(event), FRAME_BASE_URL);
};
