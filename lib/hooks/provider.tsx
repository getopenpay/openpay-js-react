import { FC, PropsWithChildren } from 'react';
import { ElementsContext, type ElementsContextValue } from './context';

const OpenPayElementsProvider: FC<PropsWithChildren> = ({ children }) => {
  const value: ElementsContextValue = {
    createToken: () => {},
  };

  return <ElementsContext.Provider value={value}>{children}</ElementsContext.Provider>;
};

export default OpenPayElementsProvider;
