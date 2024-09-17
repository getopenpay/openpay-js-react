import { FC } from 'react';
import { type ElementProps } from '@repo/utils';
import ElementFrame from './_common/frame';
import { CardPlaceholder } from '@repo/utils';

const CardElement: FC<ElementProps<typeof CardPlaceholder>> = ({ styles }) => {
  return <ElementFrame styles={styles} subPath="card" />;
};

export default CardElement;
