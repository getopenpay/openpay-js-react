import {
  FC,
  PropsWithChildren,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { ElementsContext, type ElementsContextValue } from "../hooks/context";
import { emitEvent, ElementEventType, parseEventPayload } from "../utils/event";

interface ElementsFormProps extends PropsWithChildren {
  className?: string;
  onFocus?: (elementId: string) => void;
  onBlur?: (elementId: string) => void;
  onChange?: (elementId: string) => void;
  onValidationError?: (message: string, elementId?: string) => void;
}

const ElementsForm: FC<ElementsFormProps> = (props) => {
  const { children, className, onFocus, onBlur, onChange, onValidationError } =
    props;
  const [contextId, setContextId] = useState<string>("");
  const [nonces, setNonces] = useState<string[]>([]);
  const [targets, setTargets] = useState<Record<string, HTMLIFrameElement>>({});
  const [formHeight, setFormHeight] = useState<string>("1px");
  const formRef = useRef<HTMLDivElement | null>(null);

  useEffect(
    () => setContextId(`op-elements-${window.crypto.randomUUID()}`),
    []
  );

  useEffect(() => {
    if (!formRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.target) return;
        const { width } = entry.contentRect;

        // Resize all target iframes
        Object.values(targets).forEach((target) => {
          if (!target) return;
          emitEvent(target, contextId, "root", ElementEventType.RESIZE, {
            width: width.toString(),
          });
        });
      });
    });

    resizeObserver.observe(formRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [formRef, contextId, targets]);

  const dispatchEvent = useCallback(
    (event: MessageEvent, frame: HTMLIFrameElement) => {
      const eventData = parseEventPayload(JSON.parse(event.data));

      if (eventData.formId !== contextId) {
        console.warn(
          "[form] Ignoring event for different form. Expected:",
          contextId,
          "Got:",
          eventData.formId
        );
        return;
      }

      if (eventData.nonce in nonces) {
        console.warn("[form] Ignoring duplicate event:", eventData);
        return;
      }

      setNonces((prevNonces) => [...prevNonces, eventData.nonce]);
      console.log("[form] Received event:", eventData);

      if (
        eventData.type === ElementEventType.VALIDATION_ERROR &&
        !!onValidationError
      ) {
        onValidationError(eventData.payload["message"], eventData.elementId);
      } else if (eventData.type === ElementEventType.FOCUS && !!onFocus) {
        onFocus(eventData.elementId);
      } else if (eventData.type === ElementEventType.BLUR && !!onBlur) {
        onBlur(eventData.elementId);
      } else if (eventData.type === ElementEventType.CHANGE && !!onChange) {
        onChange(eventData.elementId);
      } else if (eventData.type === ElementEventType.LOADED) {
        const elementId = eventData.elementId;
        if (!elementId) return;

        setTargets((prevTargets) => ({ ...prevTargets, [elementId]: frame }));

        const height = eventData.payload.height
          ? `${eventData.payload.height}px`
          : "100%";
        setFormHeight(height);
      }
    },
    [contextId, nonces, onValidationError, onFocus, onBlur, onChange]
  );

  const value: ElementsContextValue = {
    contextId,
    createToken: () => {},
    dispatchEvent,
    formHeight,
  };

  return (
    <ElementsContext.Provider value={value}>
      <div className={className} ref={formRef}>
        {children}
      </div>
    </ElementsContext.Provider>
  );
};

export default ElementsForm;
