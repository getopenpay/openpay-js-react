export const isJsonString = (str: unknown): boolean => {
  if (typeof str !== 'string') return false;
  try {
    JSON.parse(str);
    return true;
  } catch (e) {
    return false;
  }
};
