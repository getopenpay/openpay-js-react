import { FC, PropsWithChildren } from 'react';

const InputField: FC<PropsWithChildren> = (props) => {
  const { children } = props;

  return <div className="bg-emerald-50 dark:bg-emerald-800 shadow-md px-4 py-2 rounded-md mb-2">{children}</div>;
};

export default InputField;