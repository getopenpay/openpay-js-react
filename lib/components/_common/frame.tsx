import { FC, useEffect, useMemo, useRef } from 'react';
import { FRAME_BASE_URL } from '../../utils/constants';
import { convertStylesToQueryString, type ElementStyle } from '../../utils/style';
import { ElementEventSchema, type ElementEvent } from '../../utils/event';

type ElementFrameProps = {
  subPath: string;
  styles?: ElementStyle;
  onEvent?: (event: ElementEvent) => void;
}

const FRAME_STYLE: React.CSSProperties = {
  border: 'none',
};

const parseEventPayload = (event: MessageEvent): ElementEvent => {
  const data = ElementEventSchema.parse(event.data);
  return data;
};

const ElementFrame: FC<ElementFrameProps> = (props) => {
  const { subPath, styles, onEvent } = props;
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const elementStyle = useMemo(() => {
    if (!styles) return '';
    return convertStylesToQueryString(styles);
  }, [styles]);

  useEffect(() => {
    if (!iframeRef.current) return;

    window.addEventListener('message', (event: MessageEvent) => {
      if (event.origin !== FRAME_BASE_URL || event.source !== iframeRef.current?.contentWindow) {
        return;
      }

      const data = parseEventPayload(event);
      if (onEvent !== undefined) {
        onEvent(data);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iframeRef]);

  return (
    <iframe
      src={`${FRAME_BASE_URL}/elements/${subPath}?${elementStyle}`}
      style={FRAME_STYLE}
      ref={iframeRef}
      width="100%"
      height="100%"
    />
  );
};

export default ElementFrame;
