import { FC } from 'react';
import { type ElementProps } from '@getopenpay/utils';
import ElementFrame from './_common/frame';
import { CardPlaceholder } from '@getopenpay/utils';

const CardElement: FC<ElementProps<typeof CardPlaceholder>> = ({ styles }) => {
  return <ElementFrame styles={styles} subPath="card" />;
};

export default CardElement;