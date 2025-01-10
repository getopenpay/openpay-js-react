import { FC } from 'react';
import { FieldName } from '@getopenpay/openpay-js-react';
import InputField from './input-field';
import classNames from 'classnames';

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

export const HorizontalRule: FC<{ className?: string }> = ({ className }) => (
  <hr className={classNames('border-emerald-400 dark:border-emerald-700', className)} />
);

const BillingDetails: FC = () => {
  const fillRandomValues = () => {
    const randomId = Math.random().toString(36).replace(/[0-9]/g, '').substring(2, 8);
    document.querySelectorAll('[data-opid]').forEach((el) => {
      const values = {
        [FieldName.FIRST_NAME]: 'John ',
        [FieldName.LAST_NAME]: `Doe${randomId}`,
        [FieldName.EMAIL]: `john.doe${randomId}@example.com`,
        [FieldName.COUNTRY]: 'US',
        [FieldName.ZIP_CODE]: Math.floor(Math.random() * (99950 - 501) + 501)
          .toString()
          .padStart(5, '0'),
      } as Record<FieldName, string>;

      const opid = el.getAttribute('data-opid') as FieldName;
      if (opid && opid in values) {
        el.setAttribute('value', values[opid]);
      }
    });
  };

  return (
    <>
      <button
        type="button"
        className="bg-emerald-600 text-white px-2 py-1 rounded-md text-xs"
        onClick={fillRandomValues}
      >
        Fill random values
      </button>
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
    </>
  );
};

export default BillingDetails;
