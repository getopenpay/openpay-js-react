import { OpenPayForm } from '@getopenpay/openpay-js';
import { ElementsFormPropsReact } from '../types';
import { AllCallbacks, FormCallbacks } from '@getopenpay/utils';

export const useReactiveFormCallbacks = (props: ElementsFormPropsReact): AllCallbacks => {
  const formCallbacks = FormCallbacks.fromObject({
    onFocus: props.onFocus,
    onBlur: props.onBlur,
    onChange: props.onChange,
    onLoad: props.onLoad,
    onLoadError: props.onLoadError,
    onValidationError: props.onValidationError,
    onCheckoutStarted: props.onCheckoutStarted,
    onCheckoutSuccess: props.onCheckoutSuccess,
    onSetupPaymentMethodSuccess: props.onSetupPaymentMethodSuccess,
    onCheckoutError: props.onCheckoutError,
    onPaymentRequestLoad: props.onPaymentRequestLoad,
  });

  if (OpenPayForm.getInstance()) {
    OpenPayForm.getInstance()?.updateCallbacks(formCallbacks.get);
  }

  return formCallbacks.get;
};
