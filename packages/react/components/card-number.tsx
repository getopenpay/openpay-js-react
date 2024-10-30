import { FC } from 'react';
import { type ElementProps } from '@getopenpay/utils';
import ElementFrame from './_common/frame';

const CardNumberElement: FC<ElementProps> = ({ styles }) => {
  return <ElementFrame styles={styles} subPath="card-number" />;
};

export default CardNumberElement;
