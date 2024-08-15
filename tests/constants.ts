export const INVALID_CVC_MESSAGE = 'Invalid CVV/CVC';
export const INVALID_EXPIRY_MESSAGE = 'Invalid card expiry';
export const INVALID_NUMBER_MESSAGE = 'Invalid card number';

export const ERROR_MESSAGE_SELECTOR = '[data-testid=error-message]';

export const CARD_NUMBER_INPUT_SELECTOR = 'input[name=cardNumber]';
export const CARD_EXPIRY_INPUT_SELECTOR = 'input[name=cardExpiry]';
export const CARD_CVC_INPUT_SELECTOR = 'input[name=cardCvc]';

export const cardElementTestCases = [
  {
    cardNumber: '4242424242424241',
    cardExpiry: '12/2020',
    cardCvc: '123',
    expected: {
      cardNumber: false,
      cardExpiry: false,
      cardCvc: true,
    },
  },
  {
    cardNumber: '4242424242424242',
    cardExpiry: '12/2021',
    cardCvc: '123',
    expected: {
      cardNumber: true,
      cardExpiry: false,
      cardCvc: true,
    },
  },
  {
    cardNumber: '4242424242424242',
    cardExpiry: '12/2022',
    cardCvc: '1234',
    expected: {
      cardNumber: true,
      cardExpiry: false,
      cardCvc: true,
    },
  },
  {
    cardNumber: '5555 5555 5555 6666',
    cardExpiry: '12/2022',
    cardCvc: '12',
    expected: {
      cardNumber: false,
      cardExpiry: false,
      cardCvc: false,
    },
  },
  {
    cardNumber: '371449a635398431',
    cardExpiry: '12/2022',
    cardCvc: '123',
    expected: {
      cardNumber: false,
      cardExpiry: false,
      cardCvc: true,
    },
  },
  {
    cardNumber: '5523 3657 4787 2301',
    cardExpiry: '042027',
    cardCvc: '987',
    expected: {
      cardNumber: true,
      cardExpiry: true,
      cardCvc: true,
    },
  },
  {
    cardNumber: '4587517354648608',
    cardExpiry: '09/2026',
    cardCvc: '087',
    expected: {
      cardNumber: true,
      cardExpiry: true,
      cardCvc: true,
    },
  },
];

export const invalidCardNumbers = ['4242424242424241', '5555 5555 5555 6666', '371449a635398431', '37144-963539-8431'];
export const validCardNumbers = [
  '4443 2338 3330 3641',
  '4242424242424242',
  '5523 3657 4787 2301',
  '3671 5815 4264 223xxx',
  '4587517354648608',
];

export const invalidExpiryDates = [
  '12/2020',
  '12/2021',
  '12/2022',
  '122023',
  '13/2025',
  '12/202',
  '1220',
  '12/2',
  '12/',
  '12',
  '1',
];
export const validExpiryDates = ['12/2024', '12/2025', '122026', '082027'];

export const validCVCNumbers = ['123', '1234', '111', '12345', '123456', '123aaa', '1234aaa'];
export const invalidCVCNumbers = ['32ee', 'aaaa', 'e12', '1e1', '1', '12', '24ee4'];
