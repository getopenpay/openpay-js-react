import { createContext, useContext, FC, PropsWithChildren } from 'react';
import { type ElementStyle } from '../utils/style';
import CardElement from '../components/card';

enum ElementType {
  Card = 'card',
}

interface ElementsContextValue {
  createElement: (type: ElementType, style?: ElementStyle) => void;
}

const ElementsContext = createContext<ElementsContextValue>({
  createElement: () => {},
});

export const useOpenPayElements = (): ElementsContextValue => {
  const context = useContext(ElementsContext);
  if (!context) {
    throw new Error('useOpenPayElements must be used within an OpenPayElementsProvider');
  }
  return context;
};

export const OpenPayElementsProvider: FC<PropsWithChildren> = ({ children }) => {
  const value: ElementsContextValue = {
    createElement: (type: ElementType, style?: ElementStyle) => {
      switch (type) {
        case ElementType.Card:
          return <CardElement styles={style} />;
      }
    },
  };

  return <ElementsContext.Provider value={value}>{children}</ElementsContext.Provider>;
};
