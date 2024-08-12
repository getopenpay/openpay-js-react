'use client';
import { FC, useCallback, useState } from 'react';
import {
  ElementsForm,
  CardCvcElement,
  CardElement,
  CardNumberElement,
  CardExpiryElement,
} from '@getopenpay/openpay-js-react';
import FormWrapper from '@/components/form-wrapper';
import InputField from '@/components/input-field';
import BillingDetails from '@/components/billing-details';

interface FormProps {
  token: string;
  separateFrames: boolean;
  onCheckoutSuccess: (invoiceUrls: string[]) => void;
}

const Form: FC<FormProps> = (props) => {
  const { token, separateFrames, onCheckoutSuccess } = props;
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | undefined>(undefined);
  const [amount, setAmount] = useState<string | undefined>(undefined);
  const [overlayMessage, setOverlayMessage] = useState<string | undefined>(undefined);

  const onCheckoutStarted = (): void => {
    setLoading(true);
    setOverlayMessage('In progress...');
  };

  const onCheckoutError = (message: string): void => {
    setLoading(false);
    setError(message);
  };

  const onLoad = (totalAmountAtoms: number): void => {
    setLoading(false);
    setAmount(`$${totalAmountAtoms / 100}`);
  };

  const onLoadError = (message: string): void => {
    setLoading(false);
    setOverlayMessage(`Could not load form: ${message}`);
  };

  return (
    <ElementsForm
      checkoutSecureToken={token}
      onLoad={onLoad}
      onLoadError={onLoadError}
      onChange={() => setError(undefined)}
      onValidationError={(message) => setError(message)}
      onCheckoutStarted={onCheckoutStarted}
      onCheckoutSuccess={onCheckoutSuccess}
      onCheckoutError={onCheckoutError}
    >
      {({ submit }) => (
        <FormWrapper error={error}>
          {(loading || overlayMessage) && (
            <div className="absolute top-0 left-0 z-50 w-full h-full flex items-center justify-center bg-emerald-500/50 dark:bg-emerald-600/50 backdrop-blur">
              <p>{overlayMessage ?? 'Loading...'}</p>
            </div>
          )}

          <BillingDetails />

          {separateFrames ? (
            <>
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
            </>
          ) : (
            <InputField>
              <CardElement />
            </InputField>
          )}

          <button
            onClick={submit}
            className="px-4 py-2 mt-2 w-full font-bold rounded-lg bg-emerald-500 dark:bg-emerald-600 text-white hover:bg-emerald-400 dark:hover:bg-emerald-500 active:bg-emerald-600 dark:active:bg-emerald-700"
          >
            Pay {amount}
          </button>
        </FormWrapper>
      )}
    </ElementsForm>
  );
};

const ElementsExample: FC = () => {
  const [token, setToken] = useState<string>('');
  const [separateFrames, setSeparateFrames] = useState<boolean>(false);
  const [invoiceUrls, setInvoiceUrls] = useState<string[] | null>(null);

  const onCheckoutSuccess = useCallback((invoiceUrls: string[]) => {
    setToken('');
    setInvoiceUrls(invoiceUrls);
  }, []);

  const onTokenChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInvoiceUrls(null);
    setToken(e.target.value);
  }, []);

  return (
    <main className="w-full max-w-5xl p-24 mx-auto">
      <div>
        <h1 className="text-2xl font-bold">OpenPay Elements</h1>
        <p className="my-4">Accept payments through OpenPay, right on your site</p>
      </div>

      <div className="mt-8">
        <label htmlFor="checkout-secure-token" className="text-sm select-none">
          Checkout secure token
        </label>
        <input
          type="text"
          id="checkout-secure-token"
          placeholder="aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
          className="w-full p-2 border-2 rounded-lg mt-2 text-black"
          onChange={onTokenChange}
        />
      </div>

      <div className="flex items-center gap-2 mt-4 mb-12">
        <input
          type="checkbox"
          id="use-separate-frames"
          className="mr-2 size-4"
          onChange={(e) => setSeparateFrames(e.target.checked)}
        />
        <label htmlFor="use-separate-frames" className="text-sm select-none cursor-pointer">
          Use separate frames for each card element
        </label>
      </div>

      {token ? (
        <div className="relative">
          <Form token={token} separateFrames={separateFrames} onCheckoutSuccess={onCheckoutSuccess} />
        </div>
      ) : (
        <div>
          {invoiceUrls ? (
            <>
              <h2 className="text-xl font-bold">🎉 Checkout successful!</h2>
              <p className="my-2">Invoice URLs:</p>
              <ul className="text-sm list-inside list-decimal">
                {invoiceUrls.map((url, index) => (
                  <li className="mb-2" key={index}>
                    <a href={url} target="_blank" rel="noreferrer" className="underline">
                      {url}
                    </a>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <p className="font-bold mb-2">No token provided</p>
              <p className="text-sm">Please provide a checkout secure token in the input above</p>
            </>
          )}
        </div>
      )}
    </main>
  );
};

export default ElementsExample;
