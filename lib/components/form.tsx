import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ElementsContext, type ElementsContextValue } from '../hooks/context';
import { constructSubmitEventPayload, emitEvent, parseEventPayload } from '../utils/event';
import { ElementsFormChildrenProps, ElementsFormProps } from '../utils/models';
import { CheckoutPaymentMethod, EventType, SubmitEventPayload } from '../utils/shared-models';
import { FRAME_BASE_URL } from '../utils/constants';
import { v4 as uuidv4 } from 'uuid';
import { usePaymentRequests } from '../hooks/use-payment-requests';
import { confirmPaymentFlowFor3DS, confirmPaymentFlowForStripePR } from '../utils/stripe';
import { PaymentRequestPaymentMethodEvent } from '@stripe/stripe-js';
import { getErrorMessage } from '../utils/errors';

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
    baseUrl,
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

  // const start3dsCardPaymentFlow = async (checkoutPaymentMethod: CheckoutPaymentMethod): Promise<void> => {
  //   if (!formRef.current || !onValidationError || !sessionId || !checkoutPaymentMethods) return;

  // };

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

      const eventData = parseEventPayload(JSON.parse(event.data));
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

      if (eventType === EventType.enum.FOCUS && !!onFocus) {
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

        const height = eventPayload.height ? `${eventPayload.height}px` : '100%';
        setFormHeight(height);
        setTotalAmountAtoms(eventPayload.totalAmountAtoms);
        setCurrency(eventPayload.currency);
        setCheckoutPaymentMethods(eventPayload.checkoutPaymentMethods);

        if (!sessionId) setSessionId(eventPayload.sessionId);

        console.log(`[form] Element ${elementId} loaded with height ${height}`);
      } else if (eventType === EventType.enum.TOKENIZE_STARTED) {
        console.log('[form] Tokenization started');
        setPreventClose(true);

        if (onCheckoutStarted) onCheckoutStarted();
      } else if (eventType === EventType.enum.PAYMENT_FLOW_STARTED) {
        if (!extraData) {
          throw new Error(`extraData not populated`);
        }

        const confirmPaymentFlow = async (): Promise<void> => {
          const nextActionType = eventPayload.nextActionMetadata['type'];
          console.log('BINGBING CONFIRM', nextActionType);
          if (nextActionType === undefined) {
            // Nothing to do
          } else if (nextActionType === 'stripe_3ds') {
            // TODO ASAP
            await confirmPaymentFlowFor3DS(eventPayload);
          } else if (nextActionType === 'stripe_payment_request') {
            if (!stripePm) {
              // This is only applicable for PRs
              throw new Error(`Stripe PM not set`);
            }
            console.log('[form] Confirming payment flow');
            await confirmPaymentFlowForStripePR(eventPayload, stripePm);
          } else {
            throw new Error(`Unknown next action type: ${nextActionType}`);
          }
        };

        confirmPaymentFlow()
          .then(() => {
            console.log('[form] Starting checkout from payment flow.');
            emitEvent(
              eventSource,
              formId,
              elementId,
              { ...extraData, type: 'CHECKOUT', doNotUseLegacyCCFlow: true },
              frameBaseUrl
            );
            setCheckoutFired(true);
            setExtraData(undefined);
            if (onCheckoutStarted) onCheckoutStarted();
          })
          .catch((e) => {
            console.log('[form] Confirmation payment flow error');
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
        console.log('[form] Checkout complete:', eventPayload.invoiceUrls);
        setPreventClose(false);
        setTokenized(0);
        setCheckoutFired(false);

        if (onCheckoutSuccess)
          onCheckoutSuccess(eventPayload.invoiceUrls, eventPayload.subscriptionIds, eventPayload.customerId);
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
      onCheckoutError,
      onValidationError,
      frameBaseUrl,
      stripePm,
      checkoutPaymentMethods,
    ]
  );

  const submitCard = useCallback(() => {
    if (!formRef.current || !onValidationError || !sessionId || !checkoutPaymentMethods) return;

    const cardCpm = checkoutPaymentMethods.find((cpm) => cpm.provider === 'credit_card');
    if (!cardCpm) {
      throw new Error('Card not available as a payment method in checkout');
    }

    const extraData = constructSubmitEventPayload(
      EventType.enum.TOKENIZE,
      sessionId,
      formRef.current,
      onValidationError,
      cardCpm,
      false
    );
    if (!extraData) return;

    console.log('[form] Submitting form:', extraData);

    for (const [elementId, target] of Object.entries(eventTargets)) {
      if (!target) continue;
      emitEvent(target, formId, elementId, extraData, frameBaseUrl);
    }

    // TODO: refactor this lol
    extraData.type = EventType.enum.CHECKOUT;
    setExtraData(extraData);
  }, [formRef, eventTargets, formId, onValidationError, sessionId, frameBaseUrl, checkoutPaymentMethods]);

  const onBeforeUnload = useCallback(
    (e: BeforeUnloadEvent) => {
      if (preventClose) e.preventDefault();
    },
    [preventClose]
  );

  useEffect(() => {
    if (loaded || !formRef.current || !totalAmountAtoms) return;

    if (iframes.length === Object.keys(eventTargets).length) {
      console.log('[form] All elements loaded');
      setLoaded(true);
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
    (iframe: HTMLIFrameElement) => {
      const existingIframe = iframes.find((existingIframe) => existingIframe.contentWindow === iframe.contentWindow);
      if (existingIframe) return;

      console.log('[form] Registering iframe:', iframe);
      setIframes((prevIframes) => [...prevIframes, iframe]);
    },
    [iframes]
  );

  const onUserCompletePaymentRequestUI = async (
    stripePm: PaymentRequestPaymentMethodEvent,
    checkoutPaymentMethod: CheckoutPaymentMethod
  ): Promise<void> => {
    if (!formRef.current || !onValidationError || !sessionId || !checkoutPaymentMethods) return;
    // Try all iframe targets, note that this loop will break as soon as one succeeds
    for (const [elementId, target] of Object.entries(eventTargets)) {
      if (!target) continue;
      const paymentFlowMetadata = {
        stripePmId: stripePm.paymentMethod.id,
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
      setStripePm(stripePm);
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
    totalAmountAtoms,
    currency,
    checkoutPaymentMethods,
    formRef.current,
    onUserCompletePaymentRequestUI,
    onValidationError,
    onPaymentRequestError
  );

  const childrenProps: ElementsFormChildrenProps = {
    submit: submitCard,
    applePay: paymentRequests.apple_pay,
    googlePay: paymentRequests.google_pay,
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
