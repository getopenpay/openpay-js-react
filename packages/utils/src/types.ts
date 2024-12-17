export const isJsonString = (str: unknown): boolean => {
  if (typeof str !== 'string') return false;
  try {
    JSON.parse(str);
    return true;
  } catch (e) {
    return false;
  }
};

export function assertNever(value: never): never {
  throw new Error(`Unhandled case: ${value}`);
}
