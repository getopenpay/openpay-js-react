import { FC } from 'react';
import { type StandaloneElementProps } from '../utils/models';
import ElementFrame from './_common/frame';

const CardCvcElement: FC<StandaloneElementProps> = ({ styles }) => {
  return <ElementFrame styles={styles} subPath="card-cvc" />;
};

export default CardCvcElement;
