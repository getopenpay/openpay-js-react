import { FC } from 'react';
import { FieldName } from '@getopenpay/openpay-js-react';
import InputField from './input-field';

interface InputProps {
  type?: string;
  placeholder: string;
  openPayId?: FieldName;
  testId?: string;
}

const Input: FC<InputProps> = ({ type, placeholder, openPayId, testId }) => (
  <input
    type={type ?? 'text'}
    placeholder={placeholder}
    className="w-full text-sm bg-transparent outline-none py-2"
    data-opid={openPayId}
    data-testid={testId}
  />
);

const HorizontalRule: FC = () => <hr className="border-emerald-200 dark:border-emerald-700" />;

const BillingDetails: FC = () => (
  <InputField>
    <div className="flex gap-2 items-center justify-between">
      <Input placeholder="Given name" openPayId={FieldName.FIRST_NAME} testId="first_name" />
      <Input placeholder="Family name" openPayId={FieldName.LAST_NAME} testId="last_name" />
    </div>
    <HorizontalRule />
    <Input placeholder="Email" type="email" openPayId={FieldName.EMAIL} testId="email" />
    <HorizontalRule />
    <div className="flex gap-2 items-center justify-between">
      <Input placeholder="Country" openPayId={FieldName.COUNTRY} testId="country" />
      <Input placeholder="ZIP" openPayId={FieldName.ZIP_CODE} testId="zip-code" />
    </div>
    <HorizontalRule />
    <Input placeholder="Promotion code" openPayId={FieldName.PROMOTION_CODE} testId="promo_code" />
  </InputField>
);

export default BillingDetails;
