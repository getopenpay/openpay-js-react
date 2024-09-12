export const CurrencyEnum = {
  Usd: 'usd',
  Brl: 'brl',
} as const;
export type CurrencyEnum = (typeof CurrencyEnum)[keyof typeof CurrencyEnum];

// Define conversion rates or atomic units for different currencies
export const ConversionRates: Record<string, number> = {
  [CurrencyEnum.Usd]: 100, // e.g., 1 USD = 100 atoms (cents)
  [CurrencyEnum.Brl]: 100, // e.g., 1 BRL = 100 atoms (centavos)
};

export const CurrencySymbolMap: Record<string, string> = {
  [CurrencyEnum.Usd]: `$`,
  [CurrencyEnum.Brl]: `R$`,
};
