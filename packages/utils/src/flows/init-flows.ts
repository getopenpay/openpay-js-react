import { OjsFlows } from './all-flows';
import { Loadable } from './common/common-flow-utils';
import { createOjsFlowLoggers, InitOjsFlowParams, InitOjsFlowResult, OjsContext, OjsFlowCallbacks } from './ojs-flow';
import Observable from 'zen-observable';
import { StripeLinkController } from './stripe/stripe-link-flow';

const { log__, err__ } = createOjsFlowLoggers('init-flows');

/**
 * This object should only be used for debugging purposes.
 * If you need to use OJS initialization results for RunFlows, please pass it properly from the corresponding InitFlows.
 */
const getOjsInitResultsDebugObject = () => {
  if (!('ojs_init_results' in window)) {
    // @ts-expect-error window typing
    window['ojs_init_results'] = {};
  }
  // @ts-expect-error window typing
  return window['ojs_init_results'];
};

/**
 * Initializes all OJS flows.
 * All init flows should be added to this function.
 */
export const initializeOjsFlows = (context: OjsContext, flowCallbacks: OjsFlowCallbacks) => {
  const initParams: InitOjsFlowParams = { context, flowCallbacks };
  console.log('[OJS] initializing OJS flows...');
  return {
    // Stripe PR
    stripePR: runInitFlowAsObservable('stripePR', OjsFlows.stripePR.init(initParams)),

    // Stripe Link
    stripeLink: runInitFlowAsObservable('stripeLink', OjsFlows.stripeLink.init(initParams)),

    // 👉 Add initialization flows here
  };
};

/**
 * Runs an InitOjsFlow (i.e. an OJS flow initialization step) as an observable
 */
const runInitFlowAsObservable = <T extends InitOjsFlowResult>(
  flowName: string,
  initFlow: Promise<T>
): Observable<Loadable<T>> => {
  const observable = new Observable<Loadable<T>>((observer) => {
    observer.next({ status: 'loading' });
    initFlow
      .then((result) => {
        observer.next({ status: 'loaded', result });
      })
      .catch((error) => {
        observer.next({ status: 'error', message: error.message });
      });
  });

  // We subscribe right away so that Observables are not lazy and are immediately executed
  observable.subscribe({
    next: (result) => {
      log__(`${flowName} flow result`, result);
      getOjsInitResultsDebugObject()[flowName] = result;
    },
    error: (error) => {
      err__(`${flowName} flow initialization error:\n${JSON.stringify(error)}`);
      // This shouldn't happen, since we're handling all the errors in the .catch block
      throw error;
    },
  });

  return observable;
};

export type OjsFlowsInitialization = ReturnType<typeof initializeOjsFlows>;
export type { StripeLinkController };
