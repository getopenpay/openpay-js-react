'use client';
import { FC, useCallback, useEffect, useState } from 'react';
import {
  ElementsForm,
  CardCvcElement,
  CardElement,
  CardNumberElement,
  CardExpiryElement,
  AppearanceTheme,
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

  const onBeforeUnload = useCallback(() => {
    if (loading) {
      window.alert('Checkout in progress. Are you sure you want to leave?');
    }
  }, [loading]);

  useEffect(() => {
    window.addEventListener('beforeunload', onBeforeUnload);

    // Ensure cleanup
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [onBeforeUnload]);

  const onCheckoutStarted = () => {
    setLoading(true);
    setOverlayMessage('In progress...');
  };

  const onCheckoutError = (message: string) => {
    setLoading(false);
    setError(message);
  };

  const onLoad = (totalAmountAtoms: number) => {
    setLoading(false);
    setAmount(`$${totalAmountAtoms / 100}`);
  };

  return (
    <ElementsForm
      checkoutSecureToken={token}
      onLoad={onLoad}
      onLoadError={(message) => setOverlayMessage(`Could not load form: ${message}`)}
      onChange={() => setError(undefined)}
      onValidationError={(message) => setError(message)}
      onCheckoutStarted={onCheckoutStarted}
      onCheckoutSuccess={onCheckoutSuccess}
      onCheckoutError={onCheckoutError}
    >
      {({ submit }) => (
        <FormWrapper error={error}>
          {loading && (
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

const StyledForm: FC<FormProps> = (props) => {
  const { token, separateFrames, onCheckoutSuccess } = props;
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | undefined>(undefined);
  const [amount, setAmount] = useState<string | undefined>(undefined);
  const [overlayMessage, setOverlayMessage] = useState<string | undefined>(undefined);

  const onBeforeUnload = useCallback(() => {
    if (loading) {
      window.alert('Checkout in progress. Are you sure you want to leave?');
    }
  }, [loading]);

  useEffect(() => {
    window.addEventListener('beforeunload', onBeforeUnload);

    // Ensure cleanup
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [onBeforeUnload]);

  const onCheckoutStarted = () => {
    setLoading(true);
    setOverlayMessage('In progress...');
  };

  const onCheckoutError = (message: string) => {
    setLoading(false);
    setError(message);
  };

  const onLoad = (totalAmountAtoms: number) => {
    setLoading(false);
    setAmount(`$${totalAmountAtoms / 100}`);
  };

  return (
    <ElementsForm
      checkoutSecureToken={token}
      onLoad={onLoad}
      onLoadError={(message) => setOverlayMessage(`Could not load form: ${message}`)}
      onChange={() => setError(undefined)}
      onValidationError={(message) => setError(message)}
      onCheckoutStarted={onCheckoutStarted}
      onCheckoutSuccess={onCheckoutSuccess}
      onCheckoutError={onCheckoutError}
      appearance={{
        theme: AppearanceTheme.DARK,
        variables: {
          borderRadius: '1rem',
          padding: '0.7rem 1rem',
          fontSize: '1.2rem',
        },
      }}
    >
      {({ submit }) => (
        <FormWrapper styled error={error}>
          {loading && (
            <div className="absolute top-0 left-0 z-50 w-full h-full flex items-center justify-center bg-emerald-500/50 dark:bg-emerald-600/50 backdrop-blur">
              <p>{overlayMessage ?? 'Loading...'}</p>
            </div>
          )}

          <BillingDetails />

          {separateFrames ? (
            <div className="text-sm flex flex-col gap-2">
              <label>
                <p className="mb-1">Card number</p>
                <CardNumberElement />
              </label>
              <div className="flex gap-3 items-center justify-between flex-grow-0">
                <label>
                  <p className="mb-1">Card expiry</p>
                  <CardExpiryElement />
                </label>
                <label>
                  <p className="mb-1">CVC</p>
                  <CardCvcElement />
                </label>
              </div>
            </div>
          ) : (
            <CardElement />
          )}

          <button
            onClick={submit}
            className="px-4 py-2 mt-4 w-full font-bold rounded-2xl bg-emerald-500 dark:bg-emerald-600 text-white hover:bg-emerald-400 dark:hover:bg-emerald-500 active:bg-emerald-600 dark:active:bg-emerald-700"
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
  const [isStyled, setIsStyled] = useState<boolean>(false);
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

      <div
        onChange={(e) => {
          // @ts-expect-error value will be a string of 'true' or 'false'
          setIsStyled(e.target.value === 'true');
        }}
        className="inline-flex p-1 rounded-lg mb-2 bg-emerald-200 dark:bg-emerald-800"
      >
        <label className="px-3 py-1 rounded-lg has-[input:checked]:bg-white dark:has-[input:checked]:bg-emerald-600">
          Styled
          <input type="radio" name="use-styled" value="true" className="sr-only" defaultChecked={isStyled} />
        </label>
        <label className="px-3 py-1 rounded-lg has-[input:checked]:bg-white dark:has-[input:checked]:bg-emerald-600">
          Unstyled
          <input type="radio" name="use-styled" value="false" className="sr-only" defaultChecked={!isStyled} />
        </label>
      </div>

      {token ? (
        <div className="relative">
          {isStyled ? (
            <StyledForm token={token} separateFrames={separateFrames} onCheckoutSuccess={onCheckoutSuccess} />
          ) : (
            <Form token={token} separateFrames={separateFrames} onCheckoutSuccess={onCheckoutSuccess} />
          )}
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
