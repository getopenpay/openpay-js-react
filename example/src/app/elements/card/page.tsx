"use client";
import { FormWrapper } from "@/app/elements/_components/FormWrapper";
import { InputField } from "@/app/elements/_components/InputField";
import { CardElement, ElementsForm } from "@getopenpay/openpay-js-react";
import { FC, useState } from "react";

const ElementsExample: FC = () => {
  const [errors, setErrors] = useState<Record<string, string | undefined>>();

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <div className="w-full max-w-5xl font-mono flex flex-col gap-4">
        <h2 className="box-border text-xl font-bold">
          All card elements in one frame
        </h2>
        <FormWrapper
          error={Object.values(errors ?? {})
            .filter(Boolean)
            .join(". ")}
        >
          <InputField>
            <input
              type="text"
              placeholder="Name"
              className="w-full bg-transparent outline-none text-lg rounded-lg"
            />
          </InputField>

          <InputField>
            <ElementsForm
              onValidationError={(message, elementId) => {
                if (elementId) {
                  setErrors((errors) => ({ ...errors, [elementId]: message }));
                }
              }}
              onChange={(elemId) => {
                if (elemId) {
                  setErrors((errors) => ({
                    ...errors,
                    [elemId]: "",
                  }));
                }
              }}
            >
              <CardElement />
            </ElementsForm>
          </InputField>
        </FormWrapper>
      </div>
    </main>
  );
};

export default ElementsExample;
