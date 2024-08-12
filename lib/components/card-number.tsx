import { FC } from 'react';
import { type ElementProps } from '../utils/models';
import ElementFrame from './_common/frame';

const CardNumberElement: FC<ElementProps> = (props) => {
  return <ElementFrame subPath="card-number" {...props} />;
};

export default CardNumberElement;
