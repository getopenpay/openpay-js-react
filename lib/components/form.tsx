import { FC, PropsWithChildren, useCallback, useEffect, useRef, useState } from 'react';
import { ElementsContext, type ElementsContextValue } from '../hooks/context';
import { ElementEventType, parseEventPayload } from '../utils/event';

interface ElementsFormProps extends PropsWithChildren {
  className?: string;
  onFocus?: (elementId: string) => void;
  onBlur?: (elementId: string) => void;
  onChange?: (elementId: string) => void;
  onValidationError?: (message: string | number) => void;
}

const ElementsForm: FC<ElementsFormProps> = (props) => {
  const { children, className, onFocus, onBlur, onChange, onValidationError } = props;
  const [contextId, setContextId] = useState<string>('');
  const [nonces, setNonces] = useState<string[]>([]);
  const [width, setWidth] = useState<string>('1px');
  const [height, setHeight] = useState<string>('1px');
  const formRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setContextId(`op-elements-${window.crypto.randomUUID()}`);
  }, []);

  const resizeForm = useCallback((width?: string, height?: string) => {
    if (!formRef.current) return;

    setWidth(width ? `${width}px` : 'auto');
    setHeight(height ? `${height}px` : 'auto');
  }, [formRef]);

  const dispatchEvent = useCallback((event: MessageEvent) => {
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
    
    if (eventData.type === ElementEventType.VALIDATION_ERROR && !!onValidationError) {
      onValidationError(eventData.payload['message']);
    } else if (eventData.type === ElementEventType.FOCUS && !!onFocus) {
      onFocus(eventData.elementId);
    } else if (eventData.type === ElementEventType.BLUR && !!onBlur) {
      onBlur(eventData.elementId);
    } else if (eventData.type === ElementEventType.CHANGE && !!onChange) {
      onChange(eventData.elementId);
    } else if (eventData.type === ElementEventType.RESIZE) {
      console.log('[form] Resizing form:', eventData.payload);
      resizeForm(eventData.payload['width'], eventData.payload['height']);
    }
  }, [contextId, nonces, onValidationError, onFocus, onBlur, onChange, resizeForm]);

  const value: ElementsContextValue = {
    contextId,
    createToken: () => {},
    dispatchEvent,
  };

  return (
    <ElementsContext.Provider value={value}>
      <div className={className} style={{ width, height }} ref={formRef}>
        {children}
      </div>
    </ElementsContext.Provider>
  );
};

export default ElementsForm;
