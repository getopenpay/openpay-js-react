import { BehaviorSubject } from 'rxjs';
import { Loadable } from './common/common-flow-utils';
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

const { log__, err__ } = createOjsFlowLoggers('init-flows');

export type OjsInitFlowsSubjects = ReturnType<typeof createInitFlowsSubjects>;
export type { StripeLinkController };

type InitFlowSubject<T extends InitOjsFlowResult> = {
  /**
   * Subject that will be used to observe the flow
   */
  subject: BehaviorSubject<Loadable<T>>;

  /**
   * Internal method to run the flow.
   * This function is not meant to be used outside of this file.
   */
  _runInitFlow: (initParams: InitOjsFlowParams) => Promise<void>;
};

const LOADING = { status: 'loading' } as const;

/**
 * Helper function to create a BehaviorSubject and a runner for an init flow.
 */
const createInitFlowSubject = <T extends InitOjsFlowResult>(
  flowName: string,
  initFlow: InitOjsFlow<T>
): {
  subject: BehaviorSubject<Loadable<T>>;
  _runInitFlow: (initParams: InitOjsFlowParams) => Promise<void>;
} => {
  const subject = new BehaviorSubject<Loadable<T>>(LOADING);
  return {
    subject,
    _runInitFlow: async (initParams: InitOjsFlowParams) => {
      try {
        const initResult = await initFlow(initParams);
        log__(`✔ ${flowName} flow initialized successfully. Result:`, initResult);
        subject.next({ status: 'loaded', result: initResult });
        subject.complete();
      } catch (error) {
        err__(`𝙭 ${flowName} flow initialization failed. Error:`, getErrorMessage(error), 'Details:', error);
        subject.next({ status: 'error', message: getErrorMessage(error) });
      }
    },
  };
};

/**
 * Initializes all OJS flows
 */
export const startAllInitFlows = async (
  flows: OjsInitFlowsSubjects,
  context: OjsContext,
  flowCallbacks: OjsFlowCallbacks
): Promise<void> => {
  await Promise.all(Object.values(flows).map((flow) => flow._runInitFlow({ context, flowCallbacks })));
};

/**
 * Creates a set of BehaviorSubjects for all OJS flows.
 * All init flows should be added to this function.
 */
export const createInitFlowsSubjects = () => {
  return {
    // 💡 Add new init flows here

    // Stripe PR
    stripePR: createInitFlowSubject('Stripe PR', OjsFlows.stripePR.init),

    // Stripe Link
    stripeLink: createInitFlowSubject('Stripe Link', OjsFlows.stripeLink.init),

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as const satisfies Record<string, InitFlowSubject<any>>;
};
