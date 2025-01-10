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
        <>
          <p className="text-red-700 dark:text-red-300 text-sm font-bold mb-2">Errors</p>
          <pre
            data-testid="validation-error"
            className="text-red-700 dark:text-red-200 bg-red-200 dark:bg-red-900/80 p-3 rounded-lg max-w-lg w-full mb-4 text-xs block text-wrap"
          >
            {JSON.stringify(error, null, 4)}
          </pre>
        </>
      ) : null}
      <p className="text-emerald-800 dark:text-emerald-400 text-xs">You won&apos;t be charged real money.</p>
    </div>
  );
};

export default FormWrapper;
