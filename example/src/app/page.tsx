'use client';
import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  const [amount, setAmount] = useState<string | null>(null);
  const [overlayMessage, setOverlayMessage] = useState<string | null>(null);

  const [validationErrors, setValidationErrors] = useState<Record<string, string[]>>({});
  const validationError = useMemo(() => {
    if (!validationErrors) return null;

    const errorMessages = Object.entries(validationErrors).map(([elementType, errors]) => {
      return `${elementType}: ${errors.join(', ')}`;
    });

    return errorMessages.join('; ');
  }, [validationErrors]);

  const resetErrors = useCallback(() => {
    setValidationErrors({});
    setOverlayMessage(null);
  }, []);

  const onCheckoutStarted = (): void => {
    setLoading(true);
    setOverlayMessage('Processing payment...');
  };

  const onCheckoutError = (message: string): void => {
    setLoading(false);
    setOverlayMessage(`Could not process payment. Raw error: ${message}`);
  };

  const onLoad = (totalAmountAtoms: number, currency?: string): void => {
    setLoading(false);
    resetErrors();
    setAmount(`${currency ? `${currency.toUpperCase()} ` : '$'}${totalAmountAtoms / 100}`);
  };

  const onLoadError = (message: string): void => {
    setLoading(false);
    setOverlayMessage(`Could not load form. Is the session valid and not expired? Raw error: ${message}`);
  };

  const onValidationError = (elementType: string, errors: string[]): void => {
    setValidationErrors((prevValidationErrors) => ({
      ...prevValidationErrors,
      [elementType]: errors,
    }));
  };

  useEffect(() => {
    setLoading(true);
    setOverlayMessage(null);
  }, [token]);

  return (
    <ElementsForm
      checkoutSecureToken={token}
      onLoad={onLoad}
      onLoadError={onLoadError}
      onChange={resetErrors}
      onValidationError={onValidationError}
      onCheckoutStarted={onCheckoutStarted}
      onCheckoutSuccess={onCheckoutSuccess}
      onCheckoutError={onCheckoutError}
    >
      {({ submit }) => (
        <FormWrapper error={validationError}>
          {(loading || overlayMessage) && (
            <div className="absolute top-0 left-0 z-50 w-full h-full flex flex-col gap-2 items-center justify-center bg-emerald-100/50 dark:bg-emerald-800/50 backdrop-blur rounded-lg cursor-not-allowed">
              {loading && <span className="text-4xl animate-spin">⏳︎</span>}
              <p className="text-lg text-center font-bold max-w-md w-full">{overlayMessage ?? 'Loading...'}</p>
            </div>
          )}

          <BillingDetails />

          {separateFrames ? (
            <>
              <InputField hasError={!!validationErrors.card_number}>
                <CardNumberElement />
              </InputField>
              <div className="flex gap-2 items-center justify-between">
                <InputField hasError={!!validationErrors.card_expiry}>
                  <CardExpiryElement />
                </InputField>
                <InputField hasError={!!validationErrors.card_cvc}>
                  <CardCvcElement />
                </InputField>
              </div>
            </>
          ) : (
            <InputField
              hasError={!!validationErrors.card_number || !!validationErrors.card_expiry || !!validationErrors.card_cvc}
            >
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
  const [token, setToken] = useState<string | null>(null);
  const [separateFrames, setSeparateFrames] = useState<boolean>(false);
  const [invoiceUrls, setInvoiceUrls] = useState<string[] | null>(null);

  const tokenInputRef = useRef<HTMLInputElement | null>(null);

  const onCheckoutSuccess = useCallback(
    (invoiceUrls: string[]) => {
      setInvoiceUrls(invoiceUrls);
      setToken(null);

      if (tokenInputRef.current) {
        tokenInputRef.current.value = '';
      }
    },
    [tokenInputRef]
  );

  const onTokenChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInvoiceUrls(null);
    setToken(e.target.value === '' ? null : e.target.value);
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
          ref={tokenInputRef}
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
