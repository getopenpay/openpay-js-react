import { z } from 'zod';

export enum ElementEventType {
  BLUR = 'op-elements-blur',
  FOCUS = 'op-elements-focus',
  CHANGE = 'op-elements-change',
}

export const ElementEventSchema = z.object({
  type: z.nativeEnum(ElementEventType),
  payload: z.any(),
});
export type ElementEvent = z.infer<typeof ElementEventSchema>;
