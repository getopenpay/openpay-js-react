import { FC, PropsWithChildren } from 'react';

interface FormWrapperProps extends PropsWithChildren {
  error?: string;
}

export const FormWrapper: FC<FormWrapperProps> = (props) => {
  const { children, error } = props;

  return (
    <div className="p-8 rounded-lg flex flex-col items-center justify-center bg-emerald-200 dark:bg-emerald-900">
      <div className="max-w-lg w-full">{children}</div>
      <p data-testid="error-message" className="text-red-500">
        {error}
      </p>
    </div>
  );
};
