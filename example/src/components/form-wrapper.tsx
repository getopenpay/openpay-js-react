import { FC, PropsWithChildren } from 'react';

interface FormWrapperProps extends PropsWithChildren {
  error?: string;
  styled?: boolean;
}

const FormWrapper: FC<FormWrapperProps> = (props) => {
  const { children, error, styled } = props;

  return (
    <div
      className={`p-8 rounded-lg flex flex-col items-center justify-center ${styled ? 'bg-neutral-300 dark:bg-neutral-900 ' : 'bg-emerald-200 dark:bg-emerald-900'}`}
    >
      <div className="max-w-lg w-full">{children}</div>
      <p className="text-emerald-800 dark:text-emerald-400 text-xs mt-4">You won&apos;t be charged real money.</p>
      {error && <p className="text-red-600 dark:text-red-400 font-bold text-xs mt-2">{error}</p>}
    </div>
  );
};

export default FormWrapper;
