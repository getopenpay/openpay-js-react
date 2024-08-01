import { useContext } from 'react';
import { ElementsContextValue, ElementsContext } from './context';

const useOpenPayElements = (): ElementsContextValue => {
  const context = useContext(ElementsContext);
  if (!context) {
    throw new Error('useOpenPayElements must be used within an OpenPayElementsProvider');
  }
  return context;
};

export default useOpenPayElements;
