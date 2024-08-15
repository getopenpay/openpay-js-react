import { ElementsStyle } from './shared-models';

export const convertStylesToQueryString = (styles: ElementsStyle): string => {
  const serializedStyles = encodeURIComponent(JSON.stringify(styles));
  return `styles=${serializedStyles}`;
};
