import { FC, PropsWithChildren } from 'react';
import classNames from 'classnames';

interface InputFieldProps extends PropsWithChildren {
  hasError?: boolean;
}

const InputField: FC<InputFieldProps> = (props) => {
  const { children, hasError } = props;

  return (
    <div
      className={classNames(
        'shadow-md px-4 py-2 rounded-md mb-2 box-border transition-all duration-200 ring-inset',
        hasError
          ? 'ring-2 ring-pink-500 bg-pink-50 dark:bg-pink-900'
          : 'ring-0 ring-transparent bg-emerald-50 dark:bg-emerald-800'
      )}
    >
      {children}
    </div>
  );
};

export default InputField;
