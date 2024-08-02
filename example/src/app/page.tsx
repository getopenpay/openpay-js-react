'use client';
import { FC, useState } from 'react';
import { ElementsForm, CardElement, CardNumberElement, CardExpiryElement } from '@getopenpay/openpay-js-react';

const ElementsExample: FC = () => {
  const [error1, setError1] = useState<string | number>('');
  const [error2, setError2] = useState<string | number>('');
  const [error3, setError3] = useState<string | number>('');

  return (
    <main className='flex min-h-screen flex-col items-center justify-between p-24'>
      <div className='w-full max-w-5xl font-mono flex flex-col gap-4'>
        <h1 className='text-2xl font-bold'>OpenPay Elements</h1>
        <p className='text-lg'>Accept payments through OpenPay, right on your site</p>
        <hr />

        <h2 className='text-xl font-bold'>Combined card number and expiry element</h2>
        <ElementsForm className='border dark:border-gray-50' onValidationError={(message) => setError1(message)} onChange={() => setError1('')}>
          <CardElement />
        </ElementsForm>
        <p className='text-red-500'>{error1 as string}</p>
        
        <h2 className='text-xl font-bold'>Card number element only</h2>
        <ElementsForm onValidationError={(message) => setError2(message)} onChange={() => setError2('')}>
          <CardNumberElement />
        </ElementsForm>
        <p className='text-red-500'>{error2 as string}</p>

        <h2 className='text-xl font-bold'>Card expiry element only</h2>
        <ElementsForm onValidationError={(message) => setError3(message)} onChange={() => setError3('')}>
          <CardExpiryElement />
        </ElementsForm>
        <p className='text-red-500'>{error3 as string}</p>
      </div>
    </main>
  );
}

export default ElementsExample;
