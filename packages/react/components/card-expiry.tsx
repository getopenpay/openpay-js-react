import { FC } from 'react';
import { ElementTypeEnum, type ElementProps } from '@getopenpay/utils';
import ElementFrame from './_common/frame';

const CardExpiryElement: FC<ElementProps> = ({ styles }) => {
  return <ElementFrame styles={styles} elementType={ElementTypeEnum.CARD_EXPIRY} />;
};

export default CardExpiryElement;
