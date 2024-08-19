import { ElementsStyle } from './shared-models';

export const convertStylesToQueryString = (styles: ElementsStyle): string => {
  const serializedStyles = JSON.stringify(styles);
  return serializedStyles;
};
