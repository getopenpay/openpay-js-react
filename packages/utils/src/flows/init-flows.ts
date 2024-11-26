import { OjsFlows } from './all-flows';
import { Loadable } from './common/common-flow-utils';
import { createOjsFlowLoggers, InitOjsFlowResult, OjsContext } from './ojs-flow';
import Observable from 'zen-observable';

const { log__, err__ } = createOjsFlowLoggers('init-flows');

/**
 * Initializes all OJS flows.
 * All init flows should be added to this function.
 */
export const initializeOjsFlows = (context: OjsContext) => {
  return {
    // Stripe PR
    stripePR: runInitFlowAsObservable('stripePR', OjsFlows.stripePR.init({ context })),

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

  observable.subscribe({
    next: (result) => {
      log__(`${flowName} flow result`, result);
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
