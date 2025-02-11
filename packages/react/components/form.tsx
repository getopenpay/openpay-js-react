import { FC, useEffect, useState } from 'react';
import { ElementsContext, type ElementsContextValue } from '../hooks/context';
import { OpenPayForm } from '@getopenpay/openpay-js';
import { ElementsFormChildrenProps, StripeLinkController } from '@getopenpay/utils';
import { ElementsFormPropsReact } from '../types';
import { useReactiveFormCallbacks } from '../hooks/use-form-callbacks';
import { usePaymentRequests } from '../hooks/use-payment-requests';
import { InitAirwallexGooglePayFlowResult } from '@getopenpay/utils/src/flows/airwallex/types/google-pay.types';
import { InitAirwallexApplePayFlowResult } from '@getopenpay/utils/src/flows/airwallex/types/apple-pay.types';
import { AWX_LOADING } from '@getopenpay/utils/src/flows/airwallex/airwallex-utils';
import { LoopWidgetProps } from '@getopenpay/utils/src/flows/loop/types';
const FORM_TARGET = 'op_ojs_form';

const ElementsForm: FC<ElementsFormPropsReact> = (props) => {
  const [opForm, setOpForm] = useState<OpenPayForm | null>();
  const [elementsContextValue, setElementsContextValue] = useState<ElementsContextValue | null>(null);
  const { paymentRequests, overridenOnPaymentRequestLoad } = usePaymentRequests(props.onPaymentRequestLoad);
  const [loaded, setLoaded] = useState(false);
  const [stripeLinkCtrl, setStripeLinkCtrl] = useState<StripeLinkController | null>(null);
  const [loopWidgetProps, setLoopWidgetProps] = useState<LoopWidgetProps | null>(null);
  const [airwallex, setAirwallex] = useState<{
    googlePay: InitAirwallexGooglePayFlowResult;
    applePay: InitAirwallexApplePayFlowResult;
  }>({
    googlePay: AWX_LOADING,
    applePay: AWX_LOADING,
  });

  // TODO ASAP: make sure stripe link is not visible while not yet loaded
  // TODO ASAP: make sure formCallbacks are called
  // - Do vanilla example and check each callback
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

    setOpForm(form);
    const value = getElementsContextValue(form);
    setElementsContextValue(value);

    form.initFlows.stripeLink.publisher.subscribe((result) => {
      if (result.isSuccess && result.loadedValue.isAvailable) {
        setStripeLinkCtrl(result.loadedValue.controller);
      }
    });

    form.initFlows.loop.publisher.subscribe((result) => {
      if (result.isSuccess && result.loadedValue.isAvailable) {
        setLoopWidgetProps(result.loadedValue.widgetProps);
      }
    });

    form.initFlows.airwallexGooglePay.publisher.subscribe((result) => {
      if (result.isSuccess && result.loadedValue.isAvailable) {
        setAirwallex((prev) => ({
          applePay: prev.applePay,
          googlePay: result.loadedValue,
        }));
      }
    });

    form.initFlows.airwallexApplePay.publisher.subscribe((result) => {
      if (result.isSuccess && result.loadedValue.isAvailable) {
        setAirwallex((prev) => ({
          googlePay: prev.googlePay,
          applePay: {
            ...result.loadedValue,
            isLoading: false,
          },
        }));
      }
    });

    return () => {
      form.destroy();
    };

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
    submitWith: opForm.generalSubmit,
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
    airwallex,
    loop: loopWidgetProps,
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
