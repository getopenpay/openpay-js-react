import { FC } from 'react';
import { FieldName } from '@getopenpay/openpay-js-react';
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
  <>
    <button
      type="button"
      className="bg-emerald-600 text-white px-2 py-1 rounded-md text-xs"
      onClick={() => {
        document.querySelectorAll('[data-opid]').forEach((el) => {
          switch (el.getAttribute('data-opid')) {
            case FieldName.FIRST_NAME:
              el.setAttribute('value', 'John');
              break;
            case FieldName.LAST_NAME:
              el.setAttribute('value', 'Doe');
              break;
            case FieldName.EMAIL:
              el.setAttribute('value', `john.doe+${Math.random().toString(36).substring(2, 10)}@example.com`);
              break;
            case FieldName.COUNTRY:
              el.setAttribute('value', 'US');
              break;
            case FieldName.ZIP_CODE:
              el.setAttribute('value', '12345');
              break;
          }
        });
      }}
    >
      Fill random values
    </button>
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
  </>
);

export default BillingDetails;
