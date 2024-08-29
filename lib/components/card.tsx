import { FC } from 'react';
import { type ElementProps } from '../utils/models';
import ElementFrame from './_common/frame';
import { CardPlaceholder } from '../utils/shared-models';

const CardElement: FC<ElementProps<typeof CardPlaceholder>> = ({ styles }) => {
  return <ElementFrame styles={styles} subPath="card" />;
};

export default CardElement;
