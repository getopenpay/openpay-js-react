import { FC, useCallback, useEffect, useRef, useState } from 'react';
import { ElementsContext, type ElementsContextValue } from '../hooks/context';
import { constructSubmitEventPayload, emitEvent, parseEventPayload } from '../utils/event';
import { ElementsFormProps } from '../utils/models';
import { ElementEventType, SubmitEventPayload } from '../utils/shared-models';
import { FRAME_BASE_URL } from '../utils/constants';

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
    onSubmitSuccess,
    onSubmitError,
  } = props;

  const [referer, setReferer] = useState<string | undefined>(undefined);
  const [contextId, setContextId] = useState<string>('');
  const [nonces, setNonces] = useState<string[]>([]);
  const [targets, setTargets] = useState<Record<string, MessageEventSource>>({});
  const [formHeight, setFormHeight] = useState<string>('1px');
  const [loaded, setLoaded] = useState<boolean>(false);
  const [extraData, setExtraData] = useState<SubmitEventPayload | undefined>(undefined);
  const formRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => setContextId(`opjs-form-${window.crypto.randomUUID()}`), []);

  const onMessage = useCallback(
    (event: MessageEvent) => {
      const eventSource = event.source;

      if (event.origin !== FRAME_BASE_URL || !eventSource) return;

      const eventData = parseEventPayload(JSON.parse(event.data));
      const elementId = eventData.elementId;
      const formId = eventData.formId;

      if (formId !== contextId || !elementId) {
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

      if (eventType === ElementEventType.FOCUS && !!onFocus) {
        onFocus(eventData.elementId);
      } else if (eventType === ElementEventType.BLUR && !!onBlur) {
        onBlur(eventData.elementId);
      } else if (eventType === ElementEventType.CHANGE && !!onChange) {
        onChange(eventData.elementId);
      } else if (eventType === ElementEventType.LOADED) {
        console.log(`[form] Element ${elementId} loaded with height:`, eventPayload.height);
        setTargets((prevTargets) => ({ ...prevTargets, [elementId]: eventSource }));

        const height = eventPayload.height ? `${eventPayload.height}px` : '100%';
        setFormHeight(height);

        if (onLoad) onLoad();
      } else if (eventType === ElementEventType.TOKENIZE_SUCCESS && !!extraData) {
        console.log('[form] Tokenization complete:', eventPayload.paymentToken);

        emitEvent(eventSource, contextId, elementId, extraData);
        setExtraData(undefined);
      } else if (eventType === ElementEventType.CHECKOUT_SUCCESS) {
        console.log('[form] Checkout complete:', eventPayload.invoiceUrls);

        if (onSubmitSuccess) onSubmitSuccess(eventPayload.invoiceUrls);
      } else if (eventType === ElementEventType.LOAD_ERROR) {
        console.error('[form] Error loading iframe:', eventPayload.message);

        if (onLoadError) onLoadError(eventPayload.message);
      } else if (eventType === ElementEventType.VALIDATION_ERROR) {
        console.error('[form] Validation error:', eventPayload.message);

        if (onValidationError) onValidationError(eventPayload.message, elementId);
      } else if (eventType === ElementEventType.TOKENIZE_ERROR || eventType === ElementEventType.CHECKOUT_ERROR) {
        console.error('[form] API error from element:', eventPayload.message);

        if (onSubmitError) onSubmitError(eventPayload.message);
      }
    },
    [
      contextId,
      nonces,
      extraData,
      onBlur,
      onChange,
      onFocus,
      onLoad,
      onLoadError,
      onSubmitError,
      onSubmitSuccess,
      onValidationError,
    ]
  );

  const submit = useCallback(() => {
    if (!formRef.current) return;

    const extraData = constructSubmitEventPayload(formRef.current);
    console.log('[form] Submitting form:', extraData);

    for (const [elementId, target] of Object.entries(targets)) {
      if (!target) continue;
      emitEvent(target, contextId, elementId, extraData);
    }

    extraData.type = ElementEventType.CHECKOUT;
    setExtraData(extraData);
  }, [formRef, targets, contextId]);

  useEffect(() => {
    if (loaded || !formRef.current) return;

    const iframes = formRef.current.querySelectorAll('iframe');

    if (iframes.length === Object.keys(targets).length) {
      console.log('[form] All iframes loaded');
      setLoaded(true);
      if (onLoad) onLoad();
    }
  }, [targets, loaded, onLoad]);

  useEffect(() => {
    window.addEventListener('message', onMessage);
    setReferer(window.location.origin);

    // Ensure cleanup
    return () => window.removeEventListener('message', onMessage);
  }, [onMessage]);

  const value: ElementsContextValue = {
    contextId,
    formHeight,
    referer,
    checkoutSecureToken,
  };

  return (
    <ElementsContext.Provider value={value}>
      <div className={className} ref={formRef}>
        {children({ submit })}
      </div>
    </ElementsContext.Provider>
  );
};

export default ElementsForm;
