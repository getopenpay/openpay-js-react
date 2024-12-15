import {
  createOjsFlowLoggers,
  InitOjsFlow,
  InitOjsFlowParams,
  InitOjsFlowResult,
  OjsContext,
  OjsFlowCallbacks,
} from './ojs-flow';
import { StripeLinkController } from './stripe/stripe-link-flow';
import { OjsFlows } from './all-flows';
import { getErrorMessage } from '../errors';
import { LoadedOncePublisher } from '../loaded-once-publisher';

const { log__, err__ } = createOjsFlowLoggers('init-flows');

export type OjsInitFlowsPublishers = ReturnType<typeof createInitFlowsPublishers>;
export type { StripeLinkController };

type InitFlowLoader<T extends InitOjsFlowResult> = {
  /**
   * A publisher that can be used to observe the flow
   */
  publisher: LoadedOncePublisher<T>;

  /**
   * Internal method to run the flow.
   * This function is not meant to be used outside of this file.
   */
  _runInitFlow: (initParams: InitOjsFlowParams) => Promise<void>;
};

/**
 * Helper function to create a BehaviorSubject and a runner for an init flow.
 */
const createInitFlowPublisher = <T extends InitOjsFlowResult>(
  flowName: string,
  initFlow: InitOjsFlow<T>
): InitFlowLoader<T> => {
  const publisher = new LoadedOncePublisher<T>();
  return {
    publisher,
    _runInitFlow: async (initParams: InitOjsFlowParams) => {
      try {
        const initResult = await initFlow(initParams);
        log__(`✔ ${flowName} flow initialized successfully. Result:`, initResult);
        publisher.set(initResult);
      } catch (error) {
        err__(`𝙭 ${flowName} flow initialization failed. Error:`, getErrorMessage(error), 'Details:', error);
        publisher.setError(error, getErrorMessage(error));
      }
    },
  };
};

/**
 * Initializes all OJS flows
 */
export const startAllInitFlows = async (
  flows: OjsInitFlowsPublishers,
  context: OjsContext,
  flowCallbacks: OjsFlowCallbacks
): Promise<void> => {
  await Promise.all(Object.values(flows).map((flow) => flow._runInitFlow({ context, flowCallbacks })));
};

/**
 * Creates a set of BehaviorSubjects for all OJS flows.
 * All init flows should be added to this function.
 */
export const createInitFlowsPublishers = () => {
  return {
    // 💡 Add new init flows here

    // Stripe PR
    stripePR: createInitFlowPublisher('Stripe PR', OjsFlows.stripePR.init),

    // Stripe Link
    stripeLink: createInitFlowPublisher('Stripe Link', OjsFlows.stripeLink.init),

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as const satisfies Record<string, InitFlowLoader<any>>;
};
