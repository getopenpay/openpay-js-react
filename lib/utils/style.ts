import { z } from 'zod';

const ElementStyleSchema = z.object({
  backgroundColor: z.string().optional(),
  color: z.string().optional(),
  fontFamily: z.string().optional(),
  fontSize: z.string().optional(),
  fontWeight: z.string().optional(),
  margin: z.string().optional(),
  padding: z.string().optional(),
});
export type ElementStyle = z.infer<typeof ElementStyleSchema>;

export const convertStylesToQueryString = (styles: ElementStyle): string => {
  const serializedStyles = encodeURIComponent(JSON.stringify(styles));
  return `styles=${serializedStyles}`;
};
