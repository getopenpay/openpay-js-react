'use client';
import { FormWrapper } from '@/app/elements/_components/FormWrapper';
import { InputField } from '@/app/elements/_components/InputField';
import { CardNumberElement, ElementsForm } from '@getopenpay/openpay-js-react';
import { FC, useState } from 'react';

const ElementsExample: FC = () => {
  const [error, setError] = useState<string>('');

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <div className="w-full max-w-5xl font-mono flex flex-col gap-4">
        <h2 className="text-xl font-bold">Card number element only</h2>
        <FormWrapper error={error}>
          <InputField>
            <ElementsForm onValidationError={(message) => setError(message)} onChange={() => setError('')}>
              <CardNumberElement />
            </ElementsForm>
          </InputField>
        </FormWrapper>
      </div>
    </main>
  );
};

export default ElementsExample;
