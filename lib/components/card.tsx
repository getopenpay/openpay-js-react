import { FC } from 'react';
import { type InlineElementProps } from '../utils/models';
import ElementFrame from './_common/frame';

const CardElement: FC<InlineElementProps> = ({ styles }) => {
  return <ElementFrame styles={styles} subPath="card" />;
};

export default CardElement;
