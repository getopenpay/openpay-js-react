'use client';
import { OpenPayElementsProvider, CardElement } from '@getopenpay/openpay-js-react';

export default function Home() {
  return (
    <OpenPayElementsProvider>
      <main className='flex min-h-screen flex-col items-center justify-between p-24'>
        <div className='w-full max-w-5xl font-mono flex flex-col gap-4'>
          <h1 className='text-2xl font-bold'>OpenPay Elements</h1>
          <p className='text-lg'>Accept payments through OpenPay, right on your site</p>
          <hr />

          <h2 className='text-xl font-bold'>Card element</h2>
          <CardElement styles={{
            color: 'white',
          }} />
        </div>
      </main>
    </OpenPayElementsProvider>
  );
}
