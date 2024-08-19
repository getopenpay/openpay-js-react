import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ElementsContext, type ElementsContextValue } from '../hooks/context';
import { constructTokenizeEventPayload, emitEvent, parseEventPayload } from '../utils/event';
import { ElementsFormProps } from '../utils/models';
import { EventType, SubmitEventPayload } from '../utils/shared-models';
import { FRAME_BASE_URL } from '../utils/constants';
import { v4 as uuidv4 } from 'uuid';
import { createStripeContext, StripeContext } from '../utils/stripe';
import { usePaymentRequests } from '../hooks/use-payment-requests';

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
  } = props;

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
  const [stripeContext, setStripeContext] = useState<StripeContext | null>(null);
  const paymentRequests = usePaymentRequests(stripeContext?.stripePubKey, totalAmountAtoms, currency);

  const formId = useMemo(() => `opjs-form-${uuidv4()}`, []);
  const formRef = useRef<HTMLDivElement | null>(null);

  const onMessage = useCallback(
    (event: MessageEvent) => {
      // Since window.postMessage allows any source to post messages
      // to a specific target, we need to ensure that messages are
      // originating from CDE.
      // https://html.spec.whatwg.org/multipage/web-messaging.html#authors
      if (event.origin !== FRAME_BASE_URL) return;

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
        setStripeContext(createStripeContext(eventPayload));

        if (!sessionId) setSessionId(eventPayload.sessionId);

        console.log(`[form] Element ${elementId} loaded with height ${height}`);
      } else if (eventType === EventType.enum.TOKENIZE_STARTED) {
        console.log('[form] Tokenization started');
        setPreventClose(true);

        if (onCheckoutStarted) onCheckoutStarted();
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
          emitEvent(eventSource, formId, elementId, extraData);
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

        if (onCheckoutSuccess) onCheckoutSuccess(eventPayload.invoiceUrls);
      } else if (eventType === EventType.enum.LOAD_ERROR) {
        console.error('[form] Error loading iframe:', eventPayload.message);

        if (onLoadError) onLoadError(eventPayload.message);
      } else if (eventType === EventType.enum.VALIDATION_ERROR) {
        console.error(`[form] Validation error for ${eventPayload.elementType}:`, eventPayload.errors);

        if (onValidationError) onValidationError(eventPayload.elementType, eventPayload.errors, elementId);
      } else if (eventType === EventType.enum.TOKENIZE_ERROR || eventType === EventType.enum.CHECKOUT_ERROR) {
        console.error('[form] API error from element:', eventPayload.message);
        setPreventClose(false);

        if (onCheckoutError) onCheckoutError(eventPayload.message);
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
    ]
  );

  const submit = useCallback(() => {
    if (!formRef.current || !onValidationError || !sessionId) return;

    const extraData = constructTokenizeEventPayload(sessionId, formRef.current, onValidationError);
    if (!extraData) return;

    console.log('[form] Submitting form:', extraData);

    for (const [elementId, target] of Object.entries(eventTargets)) {
      if (!target) continue;
      emitEvent(target, formId, elementId, extraData);
    }

    extraData.type = EventType.enum.CHECKOUT;
    setExtraData(extraData);
  }, [formRef, eventTargets, formId, onValidationError, sessionId]);

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

  const value: ElementsContextValue = {
    formId,
    formHeight,
    referer,
    checkoutSecureToken,
    stripeContext,
    registerIframe,
  };

  return (
    <ElementsContext.Provider value={value}>
      <div className={className} ref={formRef}>
        {children({ submit, applePay: paymentRequests.apple_pay })}
      </div>
    </ElementsContext.Provider>
  );
};

export default ElementsForm;
