import Fraction from 'fraction.js';
import { ConversionRates } from './currency';

export const sum = (arr: number[]): number => {
  return arr.reduce((a, b) => a + b, 0);
};

export const atomToCurrency = (num: number, currency: string): number => {
  return new Fraction(num).div(ConversionRates[currency]).valueOf();
};
