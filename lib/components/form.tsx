import { FC, useCallback, useEffect, useRef, useState } from 'react';
import { ElementsContext, type ElementsContextValue } from '../hooks/context';
import { parseEventPayload, submitForm } from '../utils/event';
import { ElementEventType } from '../utils/models';

interface ElementsFormChildrenProps {
  submit: () => void;
}

interface ElementsFormProps {
  className?: string;
  checkoutSecureToken: string;
  children: (props: ElementsFormChildrenProps) => JSX.Element;
  onFocus?: (elementId: string) => void;
  onBlur?: (elementId: string) => void;
  onChange?: (elementId: string) => void;
  onValidationError?: (message: string) => void;
  onSubmitSuccess?: () => void;
  onSubmitError?: () => void;
}

const ElementsForm: FC<ElementsFormProps> = (props) => {
  const {
    children,
    checkoutSecureToken,
    className,
    onFocus,
    onBlur,
    onChange,
    onValidationError,
    onSubmitSuccess,
    onSubmitError
  } = props;

  const [contextId, setContextId] = useState<string>('');
  const [nonces, setNonces] = useState<string[]>([]);
  const [targets, setTargets] = useState<Record<string, HTMLIFrameElement>>({});
  const [formHeight, setFormHeight] = useState<string>('1px');
  const formRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => setContextId(`opjs-form-${window.crypto.randomUUID()}`), []);

  const dispatchEvent = useCallback((event: MessageEvent, frame: HTMLIFrameElement) => {
    const eventData = parseEventPayload(JSON.parse(event.data));

    if (eventData.formId !== contextId) {
      console.warn('[form] Ignoring event for different form. Expected:', contextId, 'Got:', eventData.formId);
      return;
    }

    if (eventData.nonce in nonces) {
      console.warn('[form] Ignoring duplicate event:', eventData);
      return;
    }

    setNonces((prevNonces) => [...prevNonces, eventData.nonce]);
    console.log('[form] Received event:', eventData);
    
    if (eventData.type === ElementEventType.LOADED) {
      const elementId = eventData.elementId;
      if (!elementId) return;

      setTargets((prevTargets) => ({ ...prevTargets, [elementId]: frame }));

      const height = eventData.payload.height ? `${eventData.payload.height}px` : '100%';
      setFormHeight(height);
    } else if (eventData.type === ElementEventType.FOCUS && !!onFocus) {
      onFocus(eventData.elementId);
    } else if (eventData.type === ElementEventType.BLUR && !!onBlur) {
      onBlur(eventData.elementId);
    } else if (eventData.type === ElementEventType.CHANGE && !!onChange) {
      onChange(eventData.elementId);
    } else if (eventData.type === ElementEventType.VALIDATION_ERROR && !!onValidationError) {
      onValidationError(eventData.payload['message']);
    } else if (eventData.type === ElementEventType.SUBMIT_SUCCESS && !!onSubmitSuccess) {
      onSubmitSuccess();
    } else if (eventData.type === ElementEventType.SUBMIT_ERROR && !!onSubmitError) {
      onSubmitError();
    }
  }, [contextId, nonces, onValidationError, onFocus, onBlur, onChange, onSubmitSuccess, onSubmitError]);

  const submit = useCallback(() => {
    if (!formRef.current) return;

    const includedInputs: HTMLInputElement[] = Array.from(formRef.current.querySelectorAll('input[data-opid]') ?? []);
    const extraData = includedInputs.reduce((acc, input) => {
      const key = input.getAttribute('data-opid');
      if (!key) return acc;
      return { ...acc, [key]: input.value };
    }, {} as Record<string, string>);

    console.log('[form] Submitting form:', extraData);

    for (const target of Object.values(targets)) {
      if (!target) continue;

      try {
        submitForm(target, contextId, {
          checkoutSecureToken,
          ...extraData
        });
      } catch (error) {
        console.error('[form] Error submitting form:', error);
        if (onSubmitError) onSubmitError();
      }
    }
  }, [formRef, targets, contextId, checkoutSecureToken, onSubmitError]);

  const value: ElementsContextValue = {
    contextId,
    formHeight,
    createToken: () => {},
    dispatchEvent,
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
