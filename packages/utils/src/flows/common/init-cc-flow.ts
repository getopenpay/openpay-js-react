import { z } from 'zod';
import { addErrorCatcherForInit, createOjsFlowLoggers, InitOjsFlow, OjsContext } from '../ojs-flow';
import { findCpmMatchingType } from './common-flow-utils';
import { parseEventPayload } from '../../event';
import { CheckoutPaymentMethod, LoadedEventPayload } from '../../shared-models';

const { log__ } = createOjsFlowLoggers('init-cc');

export type InitCCFlowSuccess = {
  isAvailable: true;
  cpm: CheckoutPaymentMethod;
  elements: {
    sessionId: string;
  };
};
export type InitCCFlowResult =
  | InitCCFlowSuccess
  | {
      isAvailable: false;
      reason: string;
    };

export const CCProcessorCpm = z.object({
  provider: z.literal('credit_card'),
});
export type CCProcessorCpm = z.infer<typeof CCProcessorCpm>;

/*
 * Initializes the CC flow (for all processors)
 */
export const initCCFlow: InitOjsFlow<InitCCFlowResult> = addErrorCatcherForInit(
  async ({ context, allCPMs }): Promise<InitCCFlowResult> => {
    log__(`Checking if there are any CPMs for CC...`);
    const cpm = findCpmMatchingType(allCPMs, CCProcessorCpm);

    const loadedPayload = await waitForLoadMessage(context);
    log__(`loadedPayload`, loadedPayload);

    return { isAvailable: true, cpm, elements: { sessionId: loadedPayload.sessionId } };
  }
);

const waitForLoadMessage = (context: OjsContext): Promise<LoadedEventPayload> => {
  return new Promise((resolve) => {
    const listener = (event: MessageEvent) => {
      // TODO ASAP: do this
      // if (event.origin !== this.formInstance.config._frameUrl?.origin) {
      //   // Skipping if origin does not match
      //   return;
      // }
      if (typeof event.data === 'object' && event.data['penpal']) {
        // Penpal message, do not handle
        return;
      }

      log__(`event: ${event}`);
      log__(`context: ${context}`);

      const eventData = parseEventPayload(JSON.parse(event.data));

      // TODO ASAP: do this
      // if (eventData.formId !== formId || !eventData.elementId) {
      //   console.warn('[form] Ignoring unknown event:', eventData);
      //   return;
      // }
      // const isValid = validateEvent(eventData);
      // if (!isValid) return;

      if (eventData.payload.type === 'LOADED') {
        window.removeEventListener('message', listener);
        log__(`Got payload ${eventData.payload}`);
        resolve(eventData.payload);
      }
    };
    window.addEventListener('message', listener);
  });
};
