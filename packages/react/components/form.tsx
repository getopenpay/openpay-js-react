import { FC, useEffect, useState } from 'react';
import { ElementsContext, type ElementsContextValue } from '../hooks/context';
import { OpenPayForm } from '@getopenpay/openpay-js';
import { ElementsFormChildrenProps, StripeLinkController } from '@getopenpay/utils';
import { ElementsFormPropsReact } from '../types';
import { useReactiveFormCallbacks } from '../hooks/use-form-callbacks';
import { usePaymentRequests } from '../hooks/use-payment-requests';

const FORM_TARGET = 'op_ojs_form';

const ElementsForm: FC<ElementsFormPropsReact> = (props) => {
  const [opForm, setOpForm] = useState<OpenPayForm | null>();
  const [elementsContextValue, setElementsContextValue] = useState<ElementsContextValue | null>(null);
  const { paymentRequests, overridenOnPaymentRequestLoad } = usePaymentRequests(props.onPaymentRequestLoad);
  const [loaded, setLoaded] = useState(false);
  const [stripeLinkCtrl] = useState<StripeLinkController | null>(null);

  // TODO ASAP: when CC fields are empty, we get wrong validation errors
  // TODO ASAP: make sure stripe link is not clickable while not yet loaded
  // TODO ASAP: make sure formCallbacks are called
  const formCallbacks = useReactiveFormCallbacks({
    ...props,
    onPaymentRequestLoad: overridenOnPaymentRequestLoad,
    onLoad: (totalAmountAtoms?: number, currency?: string) => {
      setLoaded(true);
      props.onLoad?.(totalAmountAtoms, currency);
    },
  });

  useEffect(() => {
    if (opForm) return;
    const form =
      OpenPayForm.getInstance() ??
      new OpenPayForm({
        checkoutSecureToken: props.checkoutSecureToken,
        formTarget: `#${FORM_TARGET}`,
        baseUrl: props.baseUrl,
        customInitParams: props.customInitParams,
        ...formCallbacks,
      });
    // TODO: make this loading process more explicit?

    setOpForm(form);
    const value = getElementsContextValue(form);
    console.log('Elements context value', value);
    setElementsContextValue(value);

    // initialization.stripeLink.subscribe((init) => {
    //   if (init.status === 'loaded' && init.result.isAvailable) {
    //     setStripeLinkCtrl(init.result.controller);
    //   }
    // });

    // TODO ASAP: subscribe to stripe link

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
    loaded,
    // Disable dynamic previews feature for now
    preview: {
      amount: null,
      isLoading: false,
      error: null,
    },
    stripeLink: stripeLinkCtrl,
  };

  return (
    <>
      {elementsContextValue ? (
        <ElementsContext.Provider value={elementsContextValue}>
          <div id={FORM_TARGET} className={props.className}>
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
    formId: opForm.formId,
    formHeight: opForm.formProperties.height,
    referrer: opForm.referrer,
    checkoutSecureToken: opForm.checkoutSecureToken,
    registerIframe: opForm.registerIframe,
    baseUrl: opForm.baseUrl,
  };
};

export default ElementsForm;
