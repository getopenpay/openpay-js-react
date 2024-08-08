import { FC } from 'react';

interface PayButtonProps {
  amount: number;
  onClick: () => void;
}

const PayButton: FC<PayButtonProps> = (props) => {
  const { amount, onClick } = props;

  return (
    <button
      onClick={onClick}
      className="px-4 py-2 mt-2 w-full font-bold rounded-lg bg-emerald-500 dark:bg-emerald-600 text-white hover:bg-emerald-400 dark:hover:bg-emerald-500 active:bg-emerald-600 dark:active:bg-emerald-700"
    >
      Pay ${amount}
    </button>
  );
};

export default PayButton;
