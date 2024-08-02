import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FRAME_BASE_URL } from '../../utils/constants';
import { convertStylesToQueryString, type ElementStyle } from '../../utils/style';
import { useOpenPayElements } from '../../hooks/use-openpay-elements';

type ElementFrameProps = {
  subPath: string;
  styles?: ElementStyle;
}

const FRAME_STYLE: React.CSSProperties = {
  border: 'none',
};

const ElementFrame: FC<ElementFrameProps> = (props) => {
  const { subPath, styles } = props;
  const { contextId, dispatchEvent } = useOpenPayElements();
  const [referer, setReferer] = useState<string>('');
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const elementStyle = useMemo(() => {
    if (!styles) return '';
    return convertStylesToQueryString(styles);
  }, [styles]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();

    params.append('referer', referer);
    params.append('styles', elementStyle);
    params.append('contextId', contextId);

    return params.toString();
  }, [elementStyle, contextId, referer]);

  const onMessage = useCallback((event: MessageEvent) => {
    if (event.origin !== FRAME_BASE_URL || event.source !== iframeRef.current?.contentWindow) {
      return;
    }

    dispatchEvent(event);
  }, [dispatchEvent]);

  useEffect(() => {
    if (!iframeRef.current || !contextId) return;
    window.addEventListener('message', onMessage);
    setReferer(window.location.href);

    // Ensure cleanup
    return () => window.removeEventListener('message', onMessage);
  }, [iframeRef, contextId, onMessage]);

  return (
    <iframe
      src={`${FRAME_BASE_URL}/app/elements/${subPath}?${queryString}`}
      style={FRAME_STYLE}
      ref={iframeRef}
    />
  );
};

export default ElementFrame;
