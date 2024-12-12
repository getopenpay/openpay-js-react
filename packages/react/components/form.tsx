import { FC, useEffect, useState } from 'react';
import { ElementsContext, type ElementsContextValue } from '../hooks/context';
import { OpenPayForm } from '@getopenpay/openpay-js';
import { ElementsFormChildrenProps } from '@getopenpay/utils';
import { ElementsFormPropsReact } from '../types';
import { useReactiveFormCallbacks } from '../hooks/use-form-callbacks';
import { usePaymentRequests } from '../hooks/use-payment-requests';

const FORM_ID = 'op_ojs_form';

const ElementsForm: FC<ElementsFormPropsReact> = (props) => {
  const [opForm, setOpForm] = useState<OpenPayForm | null>();
  const [elementsContextValue, setElementsContextValue] = useState<ElementsContextValue | null>(null);
  const { paymentRequests, overridenOnPaymentRequestLoad } = usePaymentRequests(props.onPaymentRequestLoad);

  const formCallbacks = useReactiveFormCallbacks({
    ...props,
    onPaymentRequestLoad: overridenOnPaymentRequestLoad,
  });

  useEffect(() => {
    if (opForm) return;
    const form =
      OpenPayForm.getInstance() ??
      new OpenPayForm({
        checkoutSecureToken: props.checkoutSecureToken,
        formTarget: `#${FORM_ID}`,
        baseUrl: props.baseUrl,
        customInitParams: props.customInitParams,
        ...formCallbacks,
      });
    // TODO: make this loading process more explicit?

    setOpForm(form);
    setElementsContextValue(getElementsContextValue(form));
    // Currently we initialize it once and only once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // TODO: better loading and error state?
  if (!opForm) {
    return <></>;
  }

  // ⛔️🪝 No hooks beyond this point

  const childrenProps: ElementsFormChildrenProps = {
    submit: opForm.submitCard,
    applePay: paymentRequests.apple_pay,
    googlePay: paymentRequests.google_pay,
    loaded: false,
    // Disable dynamic previews feature for now
    preview: {
      amount: null,
      isLoading: false,
      error: null,
    },
    stripeLink: null,
  };

  return (
    <>
      {elementsContextValue ? (
        <ElementsContext.Provider value={elementsContextValue}>
          <div id={FORM_ID} className={props.className}>
            {props.children(childrenProps)}
          </div>
        </ElementsContext.Provider>
      ) : (
        <></>
      )}
    </>
  );
};

const getElementsContextValue = (opForm: OpenPayForm): ElementsContextValue => {
  return {
    formId: FORM_ID,
    formHeight: opForm.formProperties.height,
    referrer: opForm.referrer,
    checkoutSecureToken: opForm.checkoutSecureToken,
    registerIframe: opForm.registerIframe.bind(opForm),
    baseUrl: opForm.baseUrl,
  };
};

export default ElementsForm;
