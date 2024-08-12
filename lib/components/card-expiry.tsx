import { FC } from 'react';
import { type ElementProps } from '../utils/models';
import ElementFrame from './_common/frame';

const CardExpiryElement: FC<ElementProps> = (props) => {
  return <ElementFrame subPath="card-expiry" {...props} />;
};

export default CardExpiryElement;
