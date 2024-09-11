'use client';
import { FC, useCallback, useEffect, useState } from 'react';
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
import classNames from 'classnames';
import { loadStripe } from '@stripe/stripe-js';

type OnCheckoutSuccess = (invoiceUrls: string[], subscriptionIds: string[], customerId: string) => void;
type OnSetupPaymentMethodSuccess = (paymentMethodId: string) => void;
interface FormProps {
  token: string;
  separateFrames: boolean;
  onCheckoutSuccess: OnCheckoutSuccess;
  onSetupPaymentMethodSuccess: OnSetupPaymentMethodSuccess;
  baseUrl?: string;
}

const Form: FC<FormProps> = (props) => {
  const { token, separateFrames, onCheckoutSuccess, onSetupPaymentMethodSuccess: onSetupCheckoutSuccess } = props;
  const [loading, setLoading] = useState<boolean>(true);
  const [amount, setAmount] = useState<string | null>(null);
  const [overlayMessage, setOverlayMessage] = useState<{
    type: 'checkout-error' | 'load-error' | 'process-payment' | 'loading';
    message: string;
  } | null>(null);

  const [validationErrors, setValidationErrors] = useState<Record<string, string[]>>({});

  const resetErrors = useCallback(() => {
    setValidationErrors({});
    setOverlayMessage(null);
  }, []);

  const onCheckoutStarted = (): void => {
    setLoading(true);
    setOverlayMessage({
      type: 'process-payment',
      message: 'Processing payment...',
    });
  };

  const onCheckoutError = (message: string): void => {
    setLoading(false);
    setOverlayMessage({
      type: 'checkout-error',
      message,
    });
  };

  const onLoad = (totalAmountAtoms?: number, currency?: string): void => {
    setLoading(false);
    resetErrors();
    if (totalAmountAtoms) {
      setAmount(`${currency ? `${currency.toUpperCase()} ` : '$'}${totalAmountAtoms / 100}`);
    }
  };

  const onLoadError = (message: string): void => {
    setLoading(false);
    setOverlayMessage({
      type: 'load-error',
      message,
    });
  };

  const onValidationError = (elementType: string, errors: string[]): void => {
    setValidationErrors((prevValidationErrors) => ({
      ...prevValidationErrors,
      [elementType]: errors,
    }));
  };

  useEffect(() => {
    console.log(`Stripe JS can be loaded as a <script> in head (recommended), or loaded through ${loadStripe.name}`);
    if (!token) {
      return;
    }
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
      onSetupPaymentMethodSuccess={(paymentMethodID) => {
        onSetupCheckoutSuccess(paymentMethodID);
      }}
      onCheckoutError={onCheckoutError}
    >
      {({ submit, applePay, googlePay }) => (
        <FormWrapper error={validationErrors}>
          {loading && (
            <div data-testid="loading" className="flex items-center">
              <span className="text-xl animate-spin">⏳︎</span>
              Loading...
            </div>
          )}
          {overlayMessage && (
            <div className="w-full py-2 my-2 h-full flex items-center justify-center bg-emerald-100/50 dark:bg-emerald-800/50 backdrop-blur rounded-lg cursor-not-allowed">
              <pre data-testid="overlay-message" className="block font-bold max-w-md w-full text-wrap my-3">
                {JSON.stringify(overlayMessage, null, 2)}
              </pre>
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
            data-testid="submit-button"
            onClick={submit}
            className="px-4 py-2 mt-2 w-full font-bold rounded-lg bg-emerald-500 dark:bg-emerald-600 text-white hover:bg-emerald-400 dark:hover:bg-emerald-500 active:bg-emerald-600 dark:active:bg-emerald-700"
          >
            Pay {amount}
          </button>

          <button
            onClick={() => applePay.startFlow()}
            disabled={!applePay.isAvailable}
            className={classNames(
              'px-4 py-2 mt-2 w-full rounded-lg',
              applePay.isAvailable
                ? 'bg-emerald-500 dark:bg-emerald-600 text-white hover:bg-emerald-400 dark:hover:bg-emerald-500 active:bg-emerald-600 dark:active:bg-emerald-700 font-bold'
                : 'bg-gray-100 text-gray-300'
            )}
          >
            {applePay.isLoading ? 'Loading' : 'Apple Pay'}
          </button>

          <button
            onClick={() => googlePay.startFlow()}
            disabled={!googlePay.isAvailable}
            className={classNames(
              'px-4 py-2 mt-2 w-full rounded-lg',
              googlePay.isAvailable
                ? 'bg-emerald-500 dark:bg-emerald-600 text-white hover:bg-emerald-400 dark:hover:bg-emerald-500 active:bg-emerald-600 dark:active:bg-emerald-700 font-bold'
                : 'bg-gray-100 text-gray-300'
            )}
          >
            {googlePay.isLoading ? 'Loading' : 'Google Pay'}
          </button>
        </FormWrapper>
      )}
    </ElementsForm>
  );
};

const ElementsExample: FC = () => {
  const [token, setToken] = useState<string | null>(null);
  const [separateFrames, setSeparateFrames] = useState<boolean>(false);
  const [baseUrl, setBaseUrl] = useState<string>();
  const [checkoutResponse, setCheckoutResponse] = useState<{
    invoiceUrls: string[];
    subscriptionIds: string[];
    customerId: string;
  } | null>(null);
  const [setupResponse, setSetupResponse] = useState<{
    paymentMethodId: string;
  } | null>(null);

  const onCheckoutSuccess = useCallback<OnCheckoutSuccess>((invoiceUrls, subscriptionIds, customerId) => {
    setCheckoutResponse({ invoiceUrls, subscriptionIds, customerId });
    setToken(null);
  }, []);

  const onSetupCheckoutSuccess = useCallback<OnSetupPaymentMethodSuccess>((paymentMethodId) => {
    setSetupResponse({
      paymentMethodId,
    });
    setToken(null);
  }, []);

  const onTokenChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setCheckoutResponse(null);
    setToken(e.target.value === '' ? null : e.target.value);
  }, []);

  // read token from query params
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const separateFrames = urlParams.get('separateFrames');
    const baseUrl = urlParams.get('baseUrl');

    if (token) {
      setToken(token);
    }
    if (separateFrames) {
      setSeparateFrames(separateFrames === 'true');
    }
    if (baseUrl) {
      setBaseUrl(baseUrl);
    }
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
          value={token ?? ''}
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
          <Form
            token={token}
            separateFrames={separateFrames}
            onCheckoutSuccess={onCheckoutSuccess}
            onSetupPaymentMethodSuccess={onSetupCheckoutSuccess}
            baseUrl={baseUrl}
          />
        </div>
      ) : (
        <div className="mb-4">
          <p className="font-bold mb-2">No token provided</p>
          <p className="text-sm">Please provide a checkout secure token in the input above</p>
        </div>
      )}

      {checkoutResponse && (
        <>
          <h2 className="text-xl font-bold">🎉 Checkout successful!</h2>
          <p className="my-2">Invoice URLs:</p>
          <ul data-testid="invoice-list" className="text-sm list-inside list-decimal mb-4">
            {checkoutResponse.invoiceUrls.map((url, index) => (
              <li className="mb-2" key={index}>
                <a href={url} target="_blank" rel="noreferrer" className="underline">
                  {url}
                </a>
              </li>
            ))}
          </ul>
          <p className="my-2">Subscription IDs:</p>
          <ul data-testid="subscription-list" className="text-sm list-inside list-decimal">
            {checkoutResponse.subscriptionIds.map((id, index) => (
              <li className="mb-2" key={index}>
                {id}
              </li>
            ))}
          </ul>
          <p className="my-2">Customer ID:</p>
          <p data-testid="customer-id" className="text-sm">
            {checkoutResponse.customerId}
          </p>
        </>
      )}
      {setupResponse && (
        <>
          <h2 className="text-xl font-bold">🎉 Setup/Update successful!</h2>
          <p className="my-2">Payment method ID:</p>
          <p data-testid="payment-method-id" className="text-sm">
            {setupResponse.paymentMethodId}
          </p>
        </>
      )}
    </main>
  );
};

export default ElementsExample;
