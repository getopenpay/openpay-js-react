import { FC, PropsWithChildren } from 'react';

interface FormWrapperProps extends PropsWithChildren {
  error?: Record<string, string[]>;
}

const FormWrapper: FC<FormWrapperProps> = (props) => {
  const { children, error } = props;

  return (
    <div className="p-8 rounded-lg flex flex-col items-center justify-center bg-emerald-200 dark:bg-emerald-900">
      <div className="max-w-lg w-full mb-4">{children}</div>

      {error ? (
        <pre
          data-testid="validation-error"
          className="text-red-600 dark:text-red-400 font-bold text-xs block text-wrap"
        >
          {JSON.stringify(error)}
        </pre>
      ) : (
        <p className="text-emerald-800 dark:text-emerald-400 text-xs">You won&apos;t be charged real money.</p>
      )}
    </div>
  );
};

export default FormWrapper;
