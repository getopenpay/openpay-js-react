import { FC } from 'react';
import { type ElementProps } from '../utils/models';
import ElementFrame from './_common/frame';

const CardCvcElement: FC<ElementProps> = ({ styles }) => {
  return <ElementFrame styles={styles} subPath="card-cvc" />;
};

export default CardCvcElement;
