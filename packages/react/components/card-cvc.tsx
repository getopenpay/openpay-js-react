import { FC } from 'react';
import { ElementTypeEnum, type ElementProps } from '@getopenpay/utils';
import ElementFrame from './_common/frame';

const CardCvcElement: FC<ElementProps> = ({ styles }) => {
  return <ElementFrame styles={styles} elementType={ElementTypeEnum.CARD_CVC} />;
};

export default CardCvcElement;
