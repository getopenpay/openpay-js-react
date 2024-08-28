import { FC } from 'react';
import { type StandaloneElementProps } from '../utils/models';
import ElementFrame from './_common/frame';

const CardNumberElement: FC<StandaloneElementProps> = ({ styles }) => {
  return <ElementFrame styles={styles} subPath="card-number" />;
};

export default CardNumberElement;
