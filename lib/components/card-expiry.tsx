import { FC } from 'react';
import { type StandaloneElementProps } from '../utils/models';
import ElementFrame from './_common/frame';

const CardExpiryElement: FC<StandaloneElementProps> = ({ styles }) => {
  return <ElementFrame styles={styles} subPath="card-expiry" />;
};

export default CardExpiryElement;
