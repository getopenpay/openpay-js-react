import { FC } from 'react';
import { type ElementProps } from '../utils/element';
import ElementFrame from './_common/frame';

const CardElement: FC<ElementProps> = ({ styles }) => {
  return <ElementFrame styles={styles} subPath="card" />;
};

export default CardElement;
