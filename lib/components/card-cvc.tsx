import { FC } from 'react';
import { type ElementProps } from '../utils/models';
import ElementFrame from './_common/frame';

const CardCvcElement: FC<ElementProps> = (props) => {
  return <ElementFrame subPath="card-cvc" {...props} />;
};

export default CardCvcElement;
