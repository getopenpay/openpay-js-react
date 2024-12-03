import { CdeConnection } from '../cde-connection';
import { CheckoutSuccessResponse, SetupCheckoutResponse } from '../cde_models';
import { getErrorMessage } from '../errors';
import { AllFieldNames, CheckoutPaymentMethod, ElementType } from '../shared-models';
import chalk from 'chalk';

export type OjsFlowParams<T_PARAMS = void, T_INIT_RESULT = void> = {
  /**
   * Contains the context where OJS is run.
   * Ideally this only contains "background" context (OJS-level objects), and not flow-level objects.
   */
  context: OjsContext;

  /**
   * The checkout payment method object to be used for the flow.
   */
  checkoutPaymentMethod: CheckoutPaymentMethod;

  /**
   * Inputs from non-CDE fields (i.e. those which are part of the OJS form, but not the sensitive CDE form).
   */
  nonCdeFormInputs: Record<string, unknown>;

  /**
   * Lifecycle callbacks for OJS flows.
   */
  flowCallbacks: OjsFlowCallbacks;

  /**
   * Custom parameters for the flow.
   */
  customParams: T_PARAMS;

  /**
   * The result of the InitOjsFlow function.
   */
  initResult: T_INIT_RESULT;
};

export type InitOjsFlowParams = {
  /**
   * Contains the context where OJS is run.
   * Ideally this only contains "background" context (OJS-level objects), and not flow-level objects.
   */
  context: OjsContext;

  /**
   * Lifecycle callbacks for OJS flows.
   */
  flowCallbacks: OjsFlowCallbacks;
};

export type InitOjsFlowResult = {
  isAvailable: boolean;
};

export type InitOjsFlow<T extends InitOjsFlowResult> = (params: InitOjsFlowParams) => Promise<T>;

export type RunOjsFlow<T_PARAMS = undefined, T_INIT_RESULT = undefined> = (
  params: OjsFlowParams<T_PARAMS, T_INIT_RESULT>
) => Promise<void>;

export type OjsFlow<T_PARAMS = unknown, T_INIT_RESULT extends InitOjsFlowResult = InitOjsFlowResult> = {
  init?: InitOjsFlow<T_INIT_RESULT>;
  run: RunOjsFlow<T_PARAMS, T_INIT_RESULT>;
};

export type SimpleOjsFlowResult =
  | {
      mode: 'checkout';
      result: CheckoutSuccessResponse;
    }
  | {
      mode: 'setup';
      result: SetupCheckoutResponse;
    };

export type OnCheckoutError = (message: string) => void;
export type OnCheckoutStarted = () => void;
export type OnCheckoutSuccess = (invoiceUrls: string[], subscriptionIds: string[], customerId: string) => void;
export type OnSetupPaymentMethodSuccess = (paymentMethodId: string) => void;
export type OnValidationError = (field: AllFieldNames, errors: string[], elementId?: string) => void;

export type OjsFlowCallbacks = {
  onCheckoutError: OnCheckoutError;
  onCheckoutStarted: OnCheckoutStarted;
  onCheckoutSuccess: OnCheckoutSuccess;
  onSetupPaymentMethodSuccess: OnSetupPaymentMethodSuccess;
  onValidationError: OnValidationError;
};

export type OjsContext = {
  /**
   * The form element for the OJS form (non-CDE form).
   */
  formDiv: HTMLElement;

  /**
   * The elements/partial session ID.
   */
  elementsSessionId: string;

  /**
   * All the checkout payment methods available in the session.
   */
  checkoutPaymentMethods: CheckoutPaymentMethod[];

  /**
   * All the CDE connection objects (one for each CDE iframe).
   */
  cdeConnections: Map<ElementType, CdeConnection>;

  /**
   * Custom init params for init flows.
   */
  customInitParams: CustomInitParams;

  /**
   * The base URL of the CDE iframe.
   */
  baseUrl: string;
};

export type CustomInitParams = {
  stripeLink?: {
    /**
     * The height of the Stripe Link button. By default, the height of the buttons are 44px.
     * You can override this to specify a custom button height in the range of 40px-55px.
     *
     * See more: https://docs.stripe.com/js/elements_object/create_express_checkout_element#express_checkout_element_create-options-buttonHeight
     */
    buttonHeight?: number;

    /**
     * If this function returns false, the stripe link submit process is aborted.
     * This can be used for additional pre-submit checks (e.g. additional form validation).
     * Note that this function must complete within 1 second, or the submission will fail.
     */
    overrideLinkSubmit?: () => Promise<boolean>;

    /**
     * By default, the stripe link button is mounted on OJS initialization.
     * If this value is true, the stripe link is not mounted on init, and should instead be manually mounted.
     */
    doNotMountOnInit?: boolean;
  };
};

/**
 * A decorator to automatically handle checkout callbacks for an OJS flow.
 * The decorated function must return a `SimpleOjsFlowResult` object, not void.
 * This decorator handles the following callbacks:
 * - `onCheckoutStarted`
 * - `onCheckoutError`
 * - `onCheckoutSuccess`
 * - `onSetupPaymentMethodSuccess`
 *
 * This does **NOT** handle other callbacks, such as `onValidationError`.
 */
export const addBasicCheckoutCallbackHandlers = <T_PARAMS, T_INIT_RESULT>(
  simpleOjsFlow: (params: OjsFlowParams<T_PARAMS, T_INIT_RESULT>) => Promise<SimpleOjsFlowResult>
): RunOjsFlow<T_PARAMS, T_INIT_RESULT> => {
  return async (params: OjsFlowParams<T_PARAMS, T_INIT_RESULT>): Promise<void> => {
    try {
      params.flowCallbacks.onCheckoutStarted();
      const flowResult = await simpleOjsFlow(params);
      if (flowResult.mode === 'setup') {
        params.flowCallbacks.onSetupPaymentMethodSuccess(flowResult.result.payment_method_id);
      } else if (flowResult.mode === 'checkout') {
        params.flowCallbacks.onCheckoutSuccess(
          flowResult.result.invoice_urls,
          flowResult.result.subscription_ids,
          flowResult.result.customer_id
        );
      } else {
        throw new Error(`Unhandled mode: ${flowResult}`);
      }
    } catch (error) {
      params.flowCallbacks.onCheckoutError(getErrorMessage(error));
      throw error;
    }
  };
};

export const addErrorCatcherForInit = <T extends InitOjsFlowResult>(init: InitOjsFlow<T>): InitOjsFlow<T> => {
  return async (params) => {
    try {
      return await init(params);
    } catch (error) {
      const { err__ } = createOjsFlowLoggers('init-error-catcher');
      err__(error);
      return { isAvailable: false, reason: getErrorMessage(error) } as unknown as T;
    }
  };
};

export const createOjsFlowLoggers = (
  prefix: string
): {
  log: typeof console.log;
  err: typeof console.error;
  log__: typeof console.log;
  err__: typeof console.error;
} => {
  const log: typeof console.log = (...args) => {
    // Do this to prevent minification issues
    window['console'].log(`${chalk.green.bold('ojs/')}${chalk.bold.gray(`${prefix}`)}\t`, ...args);
  };
  const err: typeof console.error = (...args) => {
    // Do this to prevent minification issues
    window['console'].error(`${chalk.red.bold('ojs/')}${chalk.bold.gray(`${prefix}`)}\t`, ...args);
  };
  return {
    log,
    err,
    log__: log,
    err__: err,
  };
};
