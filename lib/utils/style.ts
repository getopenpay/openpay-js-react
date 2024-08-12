export const convertToQueryString = (styles: object): string => {
  const serializedStyles = encodeURIComponent(JSON.stringify(styles));
  return serializedStyles;
};
