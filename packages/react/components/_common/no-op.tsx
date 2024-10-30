import { FC } from 'react';

type Props = {
  className?: string;
};

export const NoOpElement: FC<Props> = (props) => {
  const { className } = props;
  return <div className={className}></div>;
};
