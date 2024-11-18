import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ElementsContext, type ElementsContextValue } from '../hooks/context';
import {
  CdeConnection,
  constructSubmitEventPayload,
  createInputsDictFromForm,
  ElementType,
  emitEvent,
  findCheckoutPaymentMethodStrict,
  makeCallbackSafe,
  OjsFlows,
  parseEventPayload,
} from '@getopenpay/utils';
import { ElementsFormChildrenProps, ElementsFormProps } from '@getopenpay/utils';
import { CheckoutPaymentMethod, EventType, SubmitEventPayload } from '@getopenpay/utils';
import { FRAME_BASE_URL } from '@getopenpay/utils';
import { v4 as uuidv4 } from 'uuid';
import { usePaymentRequests } from '../hooks/use-payment-requests';
import { confirmPaymentFlowFor3DS, confirmPaymentFlowForStripePR } from '@getopenpay/utils';
import { PaymentRequestPaymentMethodEvent } from '@stripe/stripe-js';
import { getErrorMessage } from '@getopenpay/utils';
import { isJsonString } from '@getopenpay/utils';
import { getPrefill, confirmPaymentFlow as confirmPaymentFlowInCDE } from '@getopenpay/utils';
import { useDynamicPreview } from '../hooks/use-dynamic-preview';
import { OjsContext, OjsFlowCallbacks } from '@getopenpay/utils/src/flows/ojs-flow';
import { getElementTypeFromIframeId, useCdeConnection } from '../hooks/use-cde-connection';

const ElementsForm: FC<ElementsFormProps> = (props) => {
  const {
    children,
    checkoutSecureToken,
    className,
    onFocus,
    onBlur,
    onChange,
    onLoad,
    onLoadError,
    onValidationError,
    onCheckoutStarted,
    onCheckoutSuccess,
    onCheckoutError,
    onSetupPaymentMethodSuccess,
    baseUrl,
    enableDynamicPreviews,
  } = props;

  const frameBaseUrl: string = baseUrl ?? FRAME_BASE_URL;
  const [referer, setReferer] = useState<string | undefined>(undefined);
  const [nonces, setNonces] = useState<string[]>([]);
  const [formHeight, setFormHeight] = useState<string>('1px');
  const [loaded, setLoaded] = useState<boolean>(false);
  const [extraData, setExtraData] = useState<SubmitEventPayload | undefined>(undefined);
  const [preventClose, setPreventClose] = useState<boolean>(false);

  const [iframes, setIframes] = useState<HTMLIFrameElement[]>([]);
  const [eventTargets, setEventTargets] = useState<Record<string, MessageEventSource>>({});
  const [tokenized, setTokenized] = useState<number>(0);
  const [checkoutFired, setCheckoutFired] = useState<boolean>(false);
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);

  // From load event
  const [currency, setCurrency] = useState<string | undefined>(undefined);
  const [totalAmountAtoms, setTotalAmountAtoms] = useState<number | undefined>(undefined);
  const [checkoutPaymentMethods, setCheckoutPaymentMethods] = useState<CheckoutPaymentMethod[] | undefined>(undefined);
  const [stripePm, setStripePm] = useState<PaymentRequestPaymentMethodEvent | undefined>(undefined);

  const formId = useMemo(() => `opjs-form-${uuidv4()}`, []);
  const formRef = useRef<HTMLDivElement | null>(null);
  const { cdeConns, anyCdeConn, connectToCdeIframe } = useCdeConnection();

  useEffect(() => {
    const ojs_version = { version: __APP_VERSION__, release_version: __RELEASE_VERSION__ };
    // @ts-expect-error window typing
    window['ojs_version'] = ojs_version;
    console.log('OJS version:', ojs_version);
  }, []);

  const dynamicPreview = useDynamicPreview(
    enableDynamicPreviews ?? false,
    anyCdeConn,
    checkoutSecureToken,
    formRef.current
  );

  const onMessage = useCallback(
    (event: MessageEvent) => {
      // Since window.postMessage allows any source to post messages
      // to a specific target, we need to ensure that messages are
      // originating from CDE.
      // https://html.spec.whatwg.org/multipage/web-messaging.html#authors
      if (event.origin !== frameBaseUrl) return;

      // MessageEvent.source is a non-null MessageEventSource for
      // messages sent via window.postMessage, but it is null for
      // messages sent via BroadcastChannel.postMessage.
      // We are not interested in the latter, and it's cleaner to
      // convince TypeScript about this using a temp variable
      // than to recheck inside the if blocks.
      if (!event.source) return;
      const eventSource = event.source;

      if (!isJsonString(event.data)) {
        return;
      }

      const raw = JSON.parse(event.data);
      const eventData = parseEventPayload(raw);
      const elementId = eventData.elementId;
      const targetFormId = eventData.formId;

      if (targetFormId !== formId || !elementId) {
        console.warn('[form] Ignoring unknown event:', eventData);
        return;
      }

      if (eventData.nonce in nonces) {
        console.warn('[form] Ignoring duplicate event:', eventData);
        return;
      }
      setNonces((prevNonces) => [...prevNonces, eventData.nonce]);

      const eventPayload = eventData.payload;
      const eventType = eventPayload.type;

      console.log(`[form] Received ${eventType} event from ${elementId}:`, eventData.payload);

      if (eventType === EventType.enum.LAYOUT) {
        const height = eventPayload.height ? `${eventPayload.height}px` : '100%';
        setFormHeight(height);
        console.log(`[form] Element height set to: ${height}`);
      } else if (eventType === EventType.enum.FOCUS && !!onFocus) {
        onFocus(eventData.elementId);
      } else if (eventType === EventType.enum.BLUR && !!onBlur) {
        onBlur(eventData.elementId);
      } else if (eventType === EventType.enum.CHANGE && !!onChange) {
        onChange(eventData.elementId);
      } else if (eventType === EventType.enum.LOADED) {
        const matchingIframe = iframes.find((iframe) => iframe.contentWindow === eventSource);
        setPreventClose(false);

        if (!matchingIframe) {
          console.warn('[form] Ignoring LOADED event from unregistered iframe:', eventData);
          return;
        }
        setEventTargets((prevTargets) => ({ ...prevTargets, [elementId]: eventSource }));

        setTotalAmountAtoms(eventPayload.totalAmountAtoms);
        setCurrency(eventPayload.currency);
        setCheckoutPaymentMethods(eventPayload.checkoutPaymentMethods);

        if (!sessionId) setSessionId(eventPayload.sessionId);

        console.log(`[form] Element loaded with prefill data:`, eventPayload);
      } else if (eventType === EventType.enum.TOKENIZE_STARTED) {
        console.log('[form] Tokenization started');
        setPreventClose(true);
      } else if (eventType === EventType.enum.CHECKOUT_STARTED) {
        // Firing onCheckoutStarted here to correct the behavior for separate elements
        // This has a delay issue with combined elements
        if (onCheckoutStarted) onCheckoutStarted();
      } else if (eventType === EventType.enum.PAYMENT_FLOW_STARTED) {
        if (!extraData) {
          throw new Error(`extraData not populated`);
        }
        if (!anyCdeConn) {
          throw new Error(`Not connected to CDE`);
        }

        const confirmPaymentFlow = async (): Promise<{ proceedToCheckout: boolean }> => {
          const nextActionType = eventPayload.nextActionMetadata['type'];
          console.log('[form] Confirm payment flow: next actions:', eventPayload.nextActionMetadata);
          if (nextActionType === undefined) {
            console.log('[form] Confirming payment flow (No-op)');
            // Nothing to do
          } else if (nextActionType === 'stripe_3ds') {
            console.log('[form] Confirming payment flow (Stripe 3DS');
            await confirmPaymentFlowFor3DS(eventPayload);
          } else if (nextActionType === 'stripe_payment_request') {
            if (!stripePm) {
              // This is only applicable for PRs
              throw new Error(`Stripe PM not set`);
            }
            console.log('[form] Confirming payment flow (Stripe PR)');
            await confirmPaymentFlowForStripePR(eventPayload, stripePm);
          } else {
            throw new Error(`Unknown next action type: ${nextActionType}`);
          }
          const prefill = await getPrefill(anyCdeConn);
          if (prefill.mode === 'setup') {
            const { payment_methods } = await confirmPaymentFlowInCDE(anyCdeConn, {
              secure_token: prefill.token,
              existing_cc_pm_id: extraData.existingCCPMId,
            });
            if (payment_methods.length !== 1) {
              throw new Error(`Expected exactly one payment method, got ${payment_methods.length}`);
            }
            console.log('[form] PF setup payment method complete:', payment_methods);
            setPreventClose(false);
            setTokenized(0);
            setCheckoutFired(false);

            if (onSetupPaymentMethodSuccess) {
              onSetupPaymentMethodSuccess(payment_methods[0].id);
            }
            return {
              proceedToCheckout: false,
            };
          } else {
            // If not in setup mode, proceed to checkout
            return {
              proceedToCheckout: true,
            };
          }
        };

        confirmPaymentFlow()
          .then(({ proceedToCheckout }) => {
            if (!proceedToCheckout) {
              console.log('[form] NOT proceeding to checkout after confirmation.');
              return;
            }
            console.log('[form] Starting checkout from payment flow.');

            let existingCCPMId: string | undefined;
            if (extraData.checkoutPaymentMethod.provider === 'credit_card') {
              // Currently, if a credit card passes through this flow, it is 3DS
              // In the future, we want to handle all CC flows here regardless of 3DS or not
              existingCCPMId = eventPayload.startPFMetadata?.cc_pm_id;
              if (!existingCCPMId) {
                throw new Error(`CC PM ID not found`);
              }
            }

            emitEvent(
              eventSource,
              formId,
              elementId,
              { ...extraData, type: 'CHECKOUT', doNotUseLegacyCCFlow: true, existingCCPMId },
              frameBaseUrl
            );
            setCheckoutFired(true);
            setExtraData(undefined);
            if (onCheckoutStarted) onCheckoutStarted();
          })
          .catch((e) => {
            console.log('[form] Confirmation payment flow error');
            console.error(e);
            const errMsg = getErrorMessage(e);
            setPreventClose(false);
            setCheckoutFired(false);

            if (onCheckoutError) onCheckoutError(errMsg);
          });
      } else if (eventType === EventType.enum.TOKENIZE_SUCCESS && !!extraData) {
        // When using separate elements for card number, expiry, and CVC,
        // there are instances where CDE tokenizes all three successfully
        // but does not return is_ready=True for any of them. This is due
        // to the fact that the tokenization is done in parallel.
        // To work around this, we keep track of the number of tokenized
        // elements and only fire the checkout event when either all
        // elements have been tokenized or at least one of them has
        // received is_ready=True from the backend.
        const totalTokenized = tokenized + 1;
        const allTokenized = totalTokenized === Object.keys(eventTargets).length;

        if (!checkoutFired && (allTokenized || eventPayload.isReadyForCheckout)) {
          console.log('[form] Tokenized card is ready for checkout');
          emitEvent(eventSource, formId, elementId, extraData, frameBaseUrl);
          setCheckoutFired(true);
          setExtraData(undefined);
        } else {
          console.log(`[form] Element ${elementId} finished tokenization but card not yet ready for checkout`);
          setTokenized(totalTokenized);
        }
      } else if (eventType === EventType.enum.CHECKOUT_SUCCESS) {
        console.log('[form] Checkout complete:', eventPayload);
        setPreventClose(false);
        setTokenized(0);
        setCheckoutFired(false);

        if (onCheckoutSuccess) {
          onCheckoutSuccess(eventPayload.invoiceUrls, eventPayload.subscriptionIds, eventPayload.customerId);
        }
      } else if (eventType === EventType.enum.SETUP_PAYMENT_METHOD_SUCCESS) {
        console.log('[form] Setup payment method complete:', eventPayload);
        setPreventClose(false);
        setTokenized(0);
        setCheckoutFired(false);

        if (onSetupPaymentMethodSuccess) {
          onSetupPaymentMethodSuccess(eventPayload.paymentMethodId);
        }
      } else if (eventType === EventType.enum.LOAD_ERROR) {
        console.error('[form] Error loading iframe:', eventPayload.message);

        if (onLoadError) onLoadError(eventPayload.message);
      } else if (eventType === EventType.enum.VALIDATION_ERROR) {
        const provider = extraData?.checkoutPaymentMethod.provider;
        if (provider === 'credit_card' || provider === undefined) {
          console.error(`[form] Validation error for ${eventPayload.elementType}:`, eventPayload.errors);
          if (onValidationError) onValidationError(eventPayload.elementType, eventPayload.errors, elementId);
        }
      } else if (eventType === EventType.enum.TOKENIZE_ERROR || eventType === EventType.enum.CHECKOUT_ERROR) {
        console.error('[form] API error from element:', eventPayload.message);
        if (eventPayload.message === '3DS_REQUIRED') {
          // TODO refactor later
          const cardCpm = checkoutPaymentMethods?.find((cpm) => cpm.provider === 'credit_card');
          if (!sessionId || !formRef.current || !onValidationError || !cardCpm) return;
          // Try all iframe targets, note that this loop will break as soon as one succeeds
          for (const [elementId, target] of Object.entries(eventTargets)) {
            if (!target) continue;
            const startPaymentFlowEvent = constructSubmitEventPayload(
              EventType.enum.START_PAYMENT_FLOW,
              sessionId,
              formRef.current,
              onValidationError,
              // Only stripe supports frontend 3DS right now,
              // so we pass processor_name: 'stripe' to tell delegator to only use stripe
              { ...cardCpm, processor_name: 'stripe' },
              false
            );
            if (!startPaymentFlowEvent) continue;
            setCheckoutFired(true);
            setExtraData(startPaymentFlowEvent);
            emitEvent(target, formId, elementId, startPaymentFlowEvent, frameBaseUrl);
            // If first one succeeds, break
            break;
          }
        } else {
          setPreventClose(false);
          setCheckoutFired(false);
          if (onCheckoutError) onCheckoutError(eventPayload.message);
        }
      }
    },
    [
      formId,
      sessionId,
      nonces,
      extraData,
      iframes,
      eventTargets,
      tokenized,
      checkoutFired,
      onBlur,
      onChange,
      onFocus,
      onLoadError,
      onCheckoutStarted,
      onCheckoutSuccess,
      onSetupPaymentMethodSuccess,
      onCheckoutError,
      onValidationError,
      frameBaseUrl,
      stripePm,
      checkoutPaymentMethods,
      anyCdeConn,
    ]
  );

  const ojsFlowCallbacks: OjsFlowCallbacks = useMemo(() => {
    const noOp = () => {};
    return {
      onCheckoutError: makeCallbackSafe('onCheckoutError', onCheckoutError ?? noOp),
      onCheckoutStarted: makeCallbackSafe('onCheckoutStarted', onCheckoutStarted ?? noOp),
      onCheckoutSuccess: makeCallbackSafe('onCheckoutSuccess', onCheckoutSuccess ?? noOp),
      onSetupPaymentMethodSuccess: makeCallbackSafe('onSetupPaymentMethodSuccess', onSetupPaymentMethodSuccess ?? noOp),
      onValidationError: makeCallbackSafe('onValidationError', onValidationError ?? noOp),
    };
  }, [onCheckoutError, onCheckoutStarted, onCheckoutSuccess, onSetupPaymentMethodSuccess, onValidationError]);

  const generateOjsFlowContext = (): OjsContext | null => {
    if (!formRef.current || !sessionId) return null;

    const cdeConnections: Map<ElementType, CdeConnection> = new Map();
    Object.entries(cdeConns).forEach(([elementType, cdeConn]) => {
      if (cdeConn) {
        cdeConnections.set(elementType as ElementType, cdeConn);
      }
    });

    const context: OjsContext = {
      formDiv: formRef.current,
      elementsSessionId: sessionId,
      cdeConnections,
    };
    return context;
  };

  const submitCard = () => {
    const context = generateOjsFlowContext();
    if (!formRef.current || !sessionId || !anyCdeConn || !checkoutPaymentMethods || !context) return;
    OjsFlows.runStripeCcFlow({
      context,
      checkoutPaymentMethod: findCheckoutPaymentMethodStrict(checkoutPaymentMethods, 'credit_card'),
      nonCdeFormInputs: createInputsDictFromForm(formRef.current),
      flowCallbacks: ojsFlowCallbacks,
    });
  };

  const onBeforeUnload = useCallback(
    (e: BeforeUnloadEvent) => {
      if (preventClose) e.preventDefault();
    },
    [preventClose]
  );

  /**
   * Check if all iframes have loaded and invoke `onLoad` callback
   */
  useEffect(() => {
    if (loaded || !formRef.current) return;

    const areIframesLoaded = iframes.length > 0 && iframes.length === Object.keys(eventTargets).length;

    if (areIframesLoaded) {
      console.log('[form] All elements loaded');
      setLoaded(true);
      // Total amount will be undefined if mode is 'setup'
      if (onLoad) onLoad(totalAmountAtoms, currency);
    }
  }, [iframes, eventTargets, loaded, onLoad, totalAmountAtoms, currency]);

  useEffect(() => {
    setReferer(window.location.origin);
    window.addEventListener('message', onMessage);
    window.addEventListener('beforeunload', onBeforeUnload);

    // Ensure cleanup
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      window.removeEventListener('message', onMessage);
    };
  }, [sessionId, onMessage, onBeforeUnload]);

  const registerIframe = useCallback(
    async (iframe: HTMLIFrameElement) => {
      // If the iframe is already registered, do nothing
      const existingIframe = iframes.find((existingIframe) => existingIframe.contentWindow === iframe.contentWindow);
      if (existingIframe) return;
      setIframes((prevIframes) => [...prevIframes, iframe]);

      console.log('[form] Registering iframe:', iframe);
      const elementType = getElementTypeFromIframeId(iframe.id);
      await connectToCdeIframe(elementType, iframe);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [iframes]
  );

  const onUserCompletePaymentRequestUI = async (
    stripePm: PaymentRequestPaymentMethodEvent | null,
    checkoutPaymentMethod: CheckoutPaymentMethod
  ): Promise<void> => {
    if (!formRef.current || !onValidationError || !sessionId || !checkoutPaymentMethods) return;
    // Try all iframe targets, note that this loop will break as soon as one succeeds
    for (const [elementId, target] of Object.entries(eventTargets)) {
      if (!target) continue;
      const paymentFlowMetadata = stripePm
        ? {
            stripePmId: stripePm.paymentMethod.id,
            checkoutPaymentMethod,
          }
        : {
            checkoutPaymentMethod,
          };
      const startPaymentFlowEvent = constructSubmitEventPayload(
        EventType.enum.START_PAYMENT_FLOW,
        sessionId,
        formRef.current,
        onValidationError,
        checkoutPaymentMethod,
        false,
        paymentFlowMetadata
      );
      if (!startPaymentFlowEvent) continue;
      if (stripePm) {
        setStripePm(stripePm);
      }
      setCheckoutFired(true);
      setExtraData(startPaymentFlowEvent);
      emitEvent(target, formId, elementId, startPaymentFlowEvent, frameBaseUrl);
      // If first one succeeds, break
      break;
    }
  };

  const onPaymentRequestError = (errMsg: string): void => {
    console.error('[form] Error from payment request:', errMsg);
    setCheckoutFired(false);
    if (onCheckoutError) onCheckoutError(errMsg);
  };

  const value: ElementsContextValue = {
    formId,
    formHeight,
    referer,
    checkoutSecureToken,
    registerIframe,
    baseUrl: frameBaseUrl,
  };

  const paymentRequests = usePaymentRequests(
    anyCdeConn,
    checkoutSecureToken,
    checkoutPaymentMethods,
    formRef.current,
    onUserCompletePaymentRequestUI,
    onValidationError,
    onPaymentRequestError,
    dynamicPreview
  );

  // TODO: uncomment if we need stripe elements later.
  // Better if we can make stripe link work in prod without elements.
  // const stripeElements = useStripeElements(
  //   cdeConn,
  //   checkoutSecureToken,
  //   checkoutPaymentMethods,
  //   formRef.current,
  //   (cpm: CheckoutPaymentMethod) => onUserCompletePaymentRequestUI(null, cpm),
  //   dynamicPreview
  // );

  const childrenProps: ElementsFormChildrenProps = {
    submit: submitCard,
    applePay: paymentRequests.apple_pay,
    googlePay: paymentRequests.google_pay,
    stripeLink: {
      // TODO: uncomment if we need stripe elements later.
      // Better if we can make stripe link work in prod without elements.
      // button: stripeElements.isReady ? StripeLinkButton : NoOpElement,
      // authElement: stripeElements.isReady ? StripeLinkAuthElement : NoOpElement,
      pr: paymentRequests.stripe_link,
    },
    loaded,
    preview: dynamicPreview,
  };

  return (
    <ElementsContext.Provider value={value}>
      <div className={className} ref={formRef}>
        {children(childrenProps)}
      </div>
    </ElementsContext.Provider>
  );
};

export default ElementsForm;
