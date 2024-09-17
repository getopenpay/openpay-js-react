import { z } from 'zod';
import { ElementsStyle } from './shared-models';

export const convertStylesToQueryString = (styles: ElementsStyle<z.ZodAny>): string => {
  const serializedStyles = JSON.stringify(styles);
  return serializedStyles;
};
