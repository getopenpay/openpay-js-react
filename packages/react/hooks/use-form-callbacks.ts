import { useMemo, useRef } from 'react';
import { ElementsFormPropsReact } from '../types';
import { FormCallbacks } from '@getopenpay/utils';

export const useReactiveFormCallbacks = (props: ElementsFormPropsReact): FormCallbacks => {
  const formCallbacksRef = useRef<FormCallbacks>(props);
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
