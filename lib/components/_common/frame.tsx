import { FC, useMemo, useRef } from 'react';
import { FRAME_BASE_URL } from '../../utils/constants';
import { convertToQueryString } from '../../utils/style';
import { ElementsStyle } from '../../utils/shared-models';
import { useOpenPayElements } from '../../hooks/use-openpay-elements';

type ElementFrameProps = {
  checkoutSecureToken?: string;
  subPath: string;
  styles?: ElementsStyle;
};

const ElementFrame: FC<ElementFrameProps> = (props) => {
  const { subPath, styles } = props;
  const { contextId, referer, formHeight, checkoutSecureToken, appearance } = useOpenPayElements();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const elementStyle = useMemo(() => {
    if (!styles) return '';
    return convertToQueryString(styles);
  }, [styles]);

  const formAppearance = useMemo(() => {
    if (!appearance) return '';
    return convertToQueryString(appearance);
  }, [appearance]);

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
    params.append('appearance', formAppearance);
    params.append('contextId', contextId);
    params.append('secureToken', checkoutSecureToken);

    return params.toString();
  }, [elementStyle, formAppearance, contextId, referer, checkoutSecureToken]);

  if (!checkoutSecureToken) {
    console.error('[form] Cannot render partially initialized frame');
    return <div></div>;
  }

  return (
    <iframe
      name={`${subPath}-element`}
      src={`${FRAME_BASE_URL}/app/v1/${subPath}-element?${queryString}`}
      style={frameStyle}
      ref={iframeRef}
    />
  );
};

export default ElementFrame;
