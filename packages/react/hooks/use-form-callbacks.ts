import { useMemo, useRef } from 'react';
import { ElementsFormPropsReact } from '../types';
import { AllCallbacks } from '@getopenpay/utils';

export const useReactiveFormCallbacks = (props: ElementsFormPropsReact): AllCallbacks => {
  // TODO: leverage FormCallbacks class to dynamically update the callbacks.
  // Right now, this only updates once (on form setup).
  const formCallbacksRef = useRef<AllCallbacks>(props);
  const cb = formCallbacksRef.current;
  cb.onLoad = useMemo(() => props.onLoad, [props.onLoad]);
  cb.onLoadError = useMemo(() => props.onLoadError, [props.onLoadError]);
  cb.onValidationError = useMemo(() => props.onValidationError, [props.onValidationError]);
  cb.onFocus = useMemo(() => props.onFocus, [props.onFocus]);
  cb.onBlur = useMemo(() => props.onBlur, [props.onBlur]);
  cb.onChange = useMemo(() => props.onChange, [props.onChange]);
  cb.onCheckoutStarted = useMemo(() => props.onCheckoutStarted, [props.onCheckoutStarted]);
  cb.onCheckoutSuccess = useMemo(() => props.onCheckoutSuccess, [props.onCheckoutSuccess]);
  cb.onSetupPaymentMethodSuccess = useMemo(
    () => props.onSetupPaymentMethodSuccess,
    [props.onSetupPaymentMethodSuccess]
  );
  cb.onCheckoutError = useMemo(() => props.onCheckoutError, [props.onCheckoutError]);
  cb.onPaymentRequestLoad = useMemo(() => props.onPaymentRequestLoad, [props.onPaymentRequestLoad]);
  return formCallbacksRef.current;
};
