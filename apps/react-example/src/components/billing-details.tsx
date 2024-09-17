import { FC } from 'react';
import { FieldName } from '@getopenpay/react';
import InputField from './input-field';

interface InputProps {
  type?: string;
  placeholder: string;
  openPayId?: FieldName;
}

const Input: FC<InputProps> = ({ type, placeholder, openPayId }) => (
  <input
    type={type ?? 'text'}
    placeholder={placeholder}
    className="w-full text-sm bg-transparent outline-none py-2"
    data-opid={openPayId}
  />
);

const HorizontalRule: FC = () => <hr className="border-emerald-200 dark:border-emerald-700" />;

const BillingDetails: FC = () => (
  <InputField>
    <div className="flex gap-2 items-center justify-between">
      <Input placeholder="Given name" openPayId={FieldName.FIRST_NAME} />
      <Input placeholder="Family name" openPayId={FieldName.LAST_NAME} />
    </div>
    <HorizontalRule />
    <Input placeholder="Email" type="email" openPayId={FieldName.EMAIL} />
    <HorizontalRule />
    <div className="flex gap-2 items-center justify-between">
      <Input placeholder="Country" openPayId={FieldName.COUNTRY} />
      <Input placeholder="ZIP" openPayId={FieldName.ZIP_CODE} />
    </div>
    <HorizontalRule />
    <Input placeholder="Promotion code" openPayId={FieldName.PROMOTION_CODE} />
  </InputField>
);

export default BillingDetails;
