'use client';
import { FC, useState } from 'react';
import { ElementsForm, CardCvcElement, CardElement, CardNumberElement, CardExpiryElement } from '@getopenpay/openpay-js-react';
import FormWrapper from '../components/form-wrapper';
import InputField from '../components/input-field';
import PayButton from '../components/pay-button';
import BillingDetails from '@/components/billing-details';


const ElementsExample: FC = () => {
  const [error1, setError1] = useState<string>('');
  const [error2, setError2] = useState<string>('');

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <div className="w-full max-w-5xl font-mono flex flex-col gap-4">
        <h1 className="text-2xl font-bold">OpenPay Elements</h1>
        <p className="text-lg">Accept payments through OpenPay, right on your site</p>
        <hr />

        <h2 className="box-border text-xl font-bold">All card elements in one frame</h2>
        <ElementsForm
          onValidationError={(message) => setError1(message)}
          onChange={() => setError1('')}
        >
          {({ submit }) => (
            <FormWrapper error={error1}>
              <BillingDetails />
              <InputField>
                <CardElement />
              </InputField>
              <PayButton amount={49} onClick={submit} />
            </FormWrapper>
          )}
        </ElementsForm>

        <h2 className="box-border text-xl font-bold mt-4">Card elements in separate frames</h2>
        <ElementsForm
          onValidationError={(message) => setError2(message)}
          onChange={() => setError2('')}
        >
          {({ submit }) => (
            <FormWrapper error={error2}>
              <BillingDetails />
              <InputField>
                <CardNumberElement />
              </InputField>
              <div className="flex gap-2 items-center justify-between">
                <InputField>
                  <CardExpiryElement />
                </InputField>
                <InputField>
                  <CardCvcElement />
                </InputField>
              </div>
              <PayButton amount={99} onClick={submit} />
            </FormWrapper>
          )}
        </ElementsForm>
      </div>
    </main>
  );
}

export default ElementsExample;
