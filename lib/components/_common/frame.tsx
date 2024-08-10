import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FRAME_BASE_URL } from '../../utils/constants';
import { convertStylesToQueryString, type ElementStyle } from '../../utils/style';
import { useOpenPayElements } from '../../hooks/use-openpay-elements';

type ElementFrameProps = {
  checkoutSecureToken?: string;
  subPath: string;
  styles?: ElementStyle;
}

const ElementFrame: FC<ElementFrameProps> = (props) => {
  const { subPath, styles } = props;
  const { contextId, dispatchEvent, formHeight, checkoutSecureToken } = useOpenPayElements();
  const [referer, setReferer] = useState<string>('');
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const elementStyle = useMemo(() => {
    if (!styles) return '';
    return convertStylesToQueryString(styles);
  }, [styles]);

  const frameStyle = useMemo(() => {
    return {
      border: 'none',
      width: '100%',
      height: formHeight,
    };
  }, [formHeight]);

  const queryString = useMemo(() => {
    if (!checkoutSecureToken) return '';
    const params = new URLSearchParams();

    params.append('referer', referer);
    params.append('styles', elementStyle);
    params.append('contextId', contextId);
    params.append('secureToken', checkoutSecureToken);

    return params.toString();
  }, [elementStyle, contextId, referer, checkoutSecureToken]);

  const onMessage = useCallback((event: MessageEvent) => {
    if (!iframeRef.current || event.origin == window.location.origin) return;

    if (event.origin !== FRAME_BASE_URL) {
      console.warn('[form] Ignoring message from unexpected origin:', event, '(expected:', FRAME_BASE_URL, ')');
    } else {
      dispatchEvent(event, iframeRef.current);
    }
  }, [dispatchEvent]);

  useEffect(() => {
    if (!iframeRef.current || !contextId) return;

    window.addEventListener('message', onMessage);
    setReferer(window.location.origin);

    // Ensure cleanup
    return () => window.removeEventListener('message', onMessage);
  }, [iframeRef, contextId, onMessage]);

  if (!checkoutSecureToken) {
    console.error('[form] Cannot render frame, no checkout secure token provided');
    return <div></div>;
  }

  return (
    <iframe
      src={`${FRAME_BASE_URL}/app/v1/${subPath}-element?${queryString}`}
      style={frameStyle}
      ref={iframeRef}
    />
  );
};

export default ElementFrame;
