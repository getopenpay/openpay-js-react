import { FRAME_BASE_URL } from './constants';

export const getCdeBaseUrl = () => {
  // @ts-expect-error ojs is not defined in the global scope
  return new URL(window?.ojs?.config?.baseUrl ?? FRAME_BASE_URL).origin;
};
