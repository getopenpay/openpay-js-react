'use client';
import { FormWrapper } from '@/app/elements/_components/FormWrapper';
import { InputField } from '@/app/elements/_components/InputField';
import { CardCvcElement, ElementsForm } from '@getopenpay/openpay-js-react';
import { FC, useState } from 'react';

const ElementsExample: FC = () => {
  const [error, setError] = useState<string>('');

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <div className="w-full max-w-5xl font-mono flex flex-col gap-4">
        <h2 className="text-xl font-bold">Card CVC element only</h2>
        <FormWrapper error={error}>
          <InputField>
            <ElementsForm onValidationError={(message) => setError(message)} onChange={() => setError('')}>
              <CardCvcElement />
            </ElementsForm>
          </InputField>
        </FormWrapper>
      </div>
    </main>
  );
};

export default ElementsExample;
