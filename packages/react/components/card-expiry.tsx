import { FC } from 'react';
import { type ElementProps } from '@repo/utils';
import ElementFrame from './_common/frame';

const CardExpiryElement: FC<ElementProps> = ({ styles }) => {
  return <ElementFrame styles={styles} subPath="card-expiry" />;
};

export default CardExpiryElement;
