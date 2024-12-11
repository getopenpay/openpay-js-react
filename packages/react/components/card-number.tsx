import { FC } from 'react';
import { ElementTypeEnum, type ElementProps } from '@getopenpay/utils';
import ElementFrame from './_common/frame';

const CardNumberElement: FC<ElementProps> = ({ styles }) => {
  return <ElementFrame styles={styles} elementType={ElementTypeEnum.CARD_NUMBER} />;
};

export default CardNumberElement;
