import { FC } from 'react';
import { type ElementProps } from '../utils/models';
import ElementFrame from './_common/frame';

const CardElement: FC<ElementProps> = (props) => {
  return <ElementFrame subPath="card" {...props} />;
};

export default CardElement;
