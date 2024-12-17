import { AllFieldNames, makeCallbackSafe, PRStatuses } from '@getopenpay/utils';
import { z } from 'zod';
import { createOjsFlowLoggers } from './flows/ojs-flow';

const { err__ } = createOjsFlowLoggers('form-callbacks');

// 💡 Note: when creating new callbacks, please add them to both these types:
//   - AllCallbacks
//   - ZodFormCallbacks

export type OnCheckoutError = (message: string) => void;
export type OnCheckoutStarted = () => void;
export type OnCheckoutSuccess = (invoiceUrls: string[], subscriptionIds: string[], customerId: string) => void;
export type OnSetupPaymentMethodSuccess = (paymentMethodId: string) => void;
export type OnValidationError = (field: AllFieldNames, errors: string[], elementId?: string) => void;

export type AllCallbacks = {
  onFocus?: (elementId: string, field: AllFieldNames) => void;
  onBlur?: (elementId: string, field: AllFieldNames) => void;
  onChange?: (elementId: string, field: AllFieldNames, errors?: string[]) => void;
  onLoad?: (totalAmountAtoms?: number, currency?: string) => void;
  onLoadError?: (message: string) => void;
  onValidationError?: OnValidationError;
  onCheckoutStarted?: OnCheckoutStarted;
  onCheckoutSuccess?: OnCheckoutSuccess;
  onSetupPaymentMethodSuccess?: OnSetupPaymentMethodSuccess;
  onCheckoutError?: OnCheckoutError;
  onPaymentRequestLoad?: (paymentRequests: PRStatuses) => void;
};

const OptionalFn = z.function().optional();

export const ZodFormCallbacks = z.object({
  onFocus: OptionalFn,
  onBlur: OptionalFn,
  onChange: OptionalFn,
  onLoad: OptionalFn,
  onLoadError: OptionalFn,
  onValidationError: OptionalFn,
  onCheckoutStarted: OptionalFn,
  onCheckoutSuccess: OptionalFn,
  onSetupPaymentMethodSuccess: OptionalFn,
  onCheckoutError: OptionalFn,
  onPaymentRequestLoad: OptionalFn,
});
export type ZodFormCallbacks = z.infer<typeof ZodFormCallbacks>;

export class FormCallbacks {
  private static readonly NOOP = () => {};
  private _callbacks: Required<AllCallbacks>;

  constructor() {
    this._callbacks = FormCallbacks.createEmptyCallbacks();
  }

  private static createEmptyCallbacks = (): Required<AllCallbacks> => {
    const x: AllCallbacks = {};
    Object.keys(ZodFormCallbacks.keyof().enum).forEach((key) => {
      // @ts-expect-error - trust the process
      x[key] = FormCallbacks.NOOP;
    });
    return x as Required<AllCallbacks>;
  };

  static fromObject = (obj: unknown) => {
    const instance = new FormCallbacks();
    instance.setCallbacks(ZodFormCallbacks.parse(obj));
    return instance;
  };

  /**
   * Sets ALL form callbacks. Note that all old callbacks are removed.
   */
  setCallbacks = (rawCallbacks: AllCallbacks) => {
    // Making sure to reinitialize
    this._callbacks = FormCallbacks.createEmptyCallbacks();
    Object.entries(rawCallbacks).forEach(([key, rawCallback]) => {
      const safeCallback = makeCallbackSafe(key, rawCallback ?? FormCallbacks.NOOP, err__);
      // @ts-expect-error - trust the process
      this._callbacks[key] = safeCallback;
    });
  };

  /**
   * Returns a read-only version of the callbacks object.
   */
  get get() {
    return { ...this._callbacks };
  }
}
