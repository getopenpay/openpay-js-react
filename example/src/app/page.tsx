'use client';
import { FC, PropsWithChildren, useState } from 'react';
import { ElementsForm, CardCvcElement, CardElement, CardNumberElement, CardExpiryElement } from '@getopenpay/openpay-js-react';

interface FormWrapperProps extends PropsWithChildren {
  error?: string;
}

const FormWrapper: FC<FormWrapperProps> = (props) => {
  const { children, error } = props;

  return (
    <div className="p-8 rounded-lg flex flex-col items-center justify-center bg-emerald-200 dark:bg-emerald-900">
      <div className="max-w-lg w-full">
        {children}
      </div>
      <p className='text-red-500'>{error}</p>
    </div>
  );
}

const InputField: FC<PropsWithChildren> = (props) => {
  const { children } = props;

  return (
    <div className="bg-emerald-50 dark:bg-emerald-800 shadow-md px-4 py-2 rounded-md my-2">{children}</div>
  );
}

const ElementsExample: FC = () => {
  const [error1, setError1] = useState<string>('');
  const [error2, setError2] = useState<string>('');
  const [error3, setError3] = useState<string>('');
  const [error4, setError4] = useState<string>('');
  const [error5, setError5] = useState<string>('');

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <div className="w-full max-w-5xl font-mono flex flex-col gap-4">
        <h1 className="text-2xl font-bold">OpenPay Elements</h1>
        <p className="text-lg">Accept payments through OpenPay, right on your site</p>
        <hr />

        <h2 className="box-border text-xl font-bold">All card elements in one frame</h2>
        <FormWrapper error={error1}>
          <InputField>
            <input type="text" placeholder="Name" className="w-full bg-transparent outline-none text-lg rounded-lg" />
          </InputField>

          <InputField>
            <ElementsForm
              onValidationError={(message) => setError1(message)}
              onChange={() => setError1('')}
            > 
              <CardElement />
            </ElementsForm>
          </InputField>
        </FormWrapper>

        <h2 className="box-border text-xl font-bold">All card elements in separate frames</h2>
        <FormWrapper error={error2}>
          <InputField>
            <input type="text" placeholder="Name" className="w-full bg-transparent outline-none text-lg rounded-lg" />
          </InputField>

          <InputField>
            <ElementsForm
              className="flex gap-2 items-center justify-between"
              onValidationError={(message) => setError2(message)}
              onChange={() => setError2('')}
            > 
              <CardNumberElement />
              <CardExpiryElement />
              <CardCvcElement />
            </ElementsForm>
          </InputField>
        </FormWrapper>
        
        <h2 className="text-xl font-bold">Card number element only</h2>
        <FormWrapper error={error3}>
          <InputField>
            <ElementsForm
              onValidationError={(message) => setError3(message)}
              onChange={() => setError3('')}
            > 
              <CardNumberElement />
            </ElementsForm>
          </InputField>
        </FormWrapper>

        <h2 className="text-xl font-bold">Card expiry element only</h2>
        <FormWrapper error={error4}>
          <InputField>
            <ElementsForm
              onValidationError={(message) => setError4(message)}
              onChange={() => setError4('')}
            > 
              <CardExpiryElement />
            </ElementsForm>
          </InputField>
        </FormWrapper>

        <h2 className="text-xl font-bold">Card CVC element only</h2>
        <FormWrapper error={error5}>
          <InputField>
            <ElementsForm
              onValidationError={(message) => setError5(message)}
              onChange={() => setError5('')}
            > 
              <CardCvcElement />
            </ElementsForm>
          </InputField>
        </FormWrapper>
      </div>
    </main>
  );
}

export default ElementsExample;
