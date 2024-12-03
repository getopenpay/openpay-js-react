import { ElementType, CdeConnection, createCdeConnection } from '@getopenpay/utils';
import useMap from './use-map';
import { useState } from 'react';

export const useCdeConnection = (): {
  cdeConns: Record<ElementType, CdeConnection | undefined>;
  anyCdeConn: CdeConnection | null;
  connectToCdeIframe: (elementType: ElementType, iframe: HTMLIFrameElement) => Promise<void>;
  numCdeConns: number;
} => {
  const [numCdeConns, setNumCdeConns] = useState<number>(0);
  const [cdeConns, cdeConnsSetter] = useMap<Record<ElementType, CdeConnection | undefined>>({
    card: undefined,
    'card-cvc': undefined,
    'card-expiry': undefined,
    'card-number': undefined,
  });
  const anyCdeConn: CdeConnection | null =
    Object.values(cdeConns).filter((cdeConn) => cdeConn !== undefined)[0] ?? null;
  return {
    cdeConns,
    anyCdeConn,
    connectToCdeIframe: async (elementType: ElementType, iframe: HTMLIFrameElement) => {
      cdeConnsSetter.set(elementType, await createCdeConnection(iframe));
      setNumCdeConns(Object.values(cdeConns).length);
    },
    numCdeConns,
  };
};

export const getElementTypeFromIframeId = (iframeId: string): ElementType => {
  const elementType = iframeId.replace('ojs-', '').replace('-element', '');
  const parsed = ElementType.safeParse(elementType);
  if (!parsed.success) {
    throw new Error(
      `Invalid element id: ${iframeId}, it needs to be in the format "ojs-{elementType}-element" (e.g. "ojs-card-number-element")`
    );
  }
  return parsed.data;
};
