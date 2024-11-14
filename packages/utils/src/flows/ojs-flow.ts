import { CdeConnection } from '../cde-connection';
import { CheckoutSuccessResponse, SetupCheckoutResponse } from '../cde_models';
import { getErrorMessage } from '../errors';
import { AllFieldNames, CheckoutPaymentMethod, ElementType } from '../shared-models';

export type OjsFlowParams = {
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
};

export interface OjsFlow {
  /**
   * Runs the OJS flow
   */
  runFlow: RunOjsFlow;
}

export type RunOjsFlow = (params: OjsFlowParams) => Promise<void>;

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
   * All the CDE connection objects (one for each CDE iframe).
   */
  cdeConnections: Map<ElementType, CdeConnection>;
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
export const addBasicCheckoutCallbackHandlers = (
  simpleOjsFlow: (params: OjsFlowParams) => Promise<SimpleOjsFlowResult>
): RunOjsFlow => {
  return async (params: OjsFlowParams): Promise<void> => {
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
