import { FC, useEffect, useMemo, useRef, useState } from 'react';
import { convertStylesToQueryString } from '@repo/utils';
import { CardPlaceholder, ElementsStyle } from '@repo/utils';
import { useOpenPayElements } from '../../hooks/use-openpay-elements';
import { z } from 'zod';

type ElementFrameProps<T extends z.ZodTypeAny = z.ZodOptional<z.ZodString | typeof CardPlaceholder>> = {
  checkoutSecureToken?: string;
  subPath: string;
  styles?: ElementsStyle<T>;
};

const ElementFrame: FC<ElementFrameProps> = (props) => {
  const { subPath, styles } = props;
  const { formId, referer, formHeight, checkoutSecureToken, registerIframe, baseUrl } = useOpenPayElements();

  const [hasLoaded, setHasLoaded] = useState<boolean>(false);
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
    if (!checkoutSecureToken || !referer) return '';
    const params = new URLSearchParams();

    params.append('referer', referer);
    params.append('styles', elementStyle);
    params.append('formId', formId);
    params.append('secureToken', checkoutSecureToken);

    return params.toString();
  }, [elementStyle, formId, referer, checkoutSecureToken]);

  useEffect(() => setHasLoaded(true), []);
  useEffect(() => {
    if (!iframeRef.current || !hasLoaded) return;
    registerIframe(iframeRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasLoaded]);

  if (!checkoutSecureToken) {
    console.error('[form] Cannot render partially initialized frame');
    return <div></div>;
  }

  return (
    <iframe
      name={`${subPath}-element`}
      src={`${baseUrl}/app/v1/${subPath}-element/?${queryString}`}
      style={frameStyle}
      ref={iframeRef}
    />
  );
};

export default ElementFrame;
