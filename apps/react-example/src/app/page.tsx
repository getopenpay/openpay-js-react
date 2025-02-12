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
import BillingDetails, { HorizontalRule } from '@/components/billing-details';
import classNames from 'classnames';
import { CurrencySymbolMap } from '@/utils/currency';
import { atomToCurrency } from '@/utils/math';
import { LoopWidgetProps } from '@getopenpay/utils/src/flows/loop/types';
import { initLoopConnect, LoopConnectConfig, LoopConnectPayIn } from "@loop-crypto/connect";

type OnCheckoutSuccess = (invoiceUrls: string[], subscriptionIds: string[], customerId: string) => void;
type OnSetupPaymentMethodSuccess = (paymentMethodId: string) => void;
interface FormProps {
  token: string;
  separateFrames: boolean;
  onCheckoutSuccess: OnCheckoutSuccess;
  onSetupPaymentMethodSuccess: OnSetupPaymentMethodSuccess;
  baseUrl?: string;
}

// Add this new interface for payment method buttons
interface PaymentMethodButton {
  id: string;
  label: string;
  isAvailable?: boolean;
  isLoading?: boolean;
  isShown: boolean;
  toggleShow: () => Promise<void>;
  startFlow?: () => void;
  render?: () => React.ReactNode;
}

const PAYPAL_DEFAULT_VALUES = {
  email: 'PAYPAL_PAYMENT@email.com',
  firstName: 'PAYPAL_PAYMENT_FIRST_NAME',
  lastName: 'PAYPAL_PAYMENT_LAST_NAME',
  zipCode: '12345',
  country: 'US',
};

const Form: FC<FormProps> = (props) => {
  const { token, separateFrames, onCheckoutSuccess, onSetupPaymentMethodSuccess } = props;
  const [loading, setLoading] = useState<boolean>(true);
  const [amount, setAmount] = useState<string | null>(null);
  const [overlayMessage, setOverlayMessage] = useState<{
    type: 'checkout-error' | 'load-error' | 'process-payment' | 'loading';
    message: string;
  } | null>(null);

  const [validationErrors, setValidationErrors] = useState<Record<string, string[]>>({});
  const [stripeLinkShown, setStripeLinkShown] = useState<boolean>(true);
  const [loopShown, setLoopShown] = useState<boolean>(true);

  const prParams = {
    overridePaymentRequest: {
      amount: { amountAtom: 420, currency: 'usd' },
      pending: true,
    },
  };

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

  const onLoad = (totalAmountAtoms?: number, loadedCurrency?: string): void => {
    console.log('+++++++++++++++ onLoad called +++++++++++++++++++');
    setLoading(false);
    resetErrors();
    if (totalAmountAtoms) {
      const currency = loadedCurrency ?? 'usd';
      const amount = CurrencySymbolMap[currency] + atomToCurrency(totalAmountAtoms, currency);
      setAmount(amount);
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
    console.log(`Stripe JS can be loaded as a <script> in head (recommended), or loaded through loadStripe`);
    if (!token) {
      return;
    }
    setLoading(true);
    setOverlayMessage(null);
  }, [token]);

  const [isMounted, setIsMounted] = useState(true);

  const renderPaymentMethods = (paymentMethods: PaymentMethodButton[]) => {
    return (
      <div className="space-y-4 mt-6">
        {paymentMethods.map((method) => (
          <div
            key={method.id}
            className="rounded-lg bg-emerald-100 dark:bg-emerald-800 shadow-sm border border-emerald-300 dark:border-emerald-700"
          >
            <div className="p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium">{method.label}</h3>
                {method.isAvailable && !method.render && (
                  <button
                    onClick={method.toggleShow}
                    className="text-sm px-3 py-1 rounded-md bg-emerald-100 hover:bg-emerald-200
                           dark:bg-emerald-700 dark:hover:bg-emerald-600 transition-colors"
                  >
                    {method.isShown ? 'Hide' : 'Show'}
                  </button>
                )}
              </div>

              {method.isShown && (
                <div className="mt-2">
                  {method.isLoading ? (
                    <div className="h-12 flex items-center justify-center bg-emerald-50 dark:bg-emerald-900 rounded-md">
                      <span className="text-sm">Loading...</span>
                    </div>
                  ) : !method.isAvailable ? (
                    <div className="h-12 flex items-center justify-center bg-emerald-300 dark:bg-emerald-900 rounded-md">
                      <span className="text-sm text-emerald-500">Not available</span>
                    </div>
                  ) : method.render ? (
                    method.render()
                  ) : (
                    <div
                      id={`ojs-${method.id}-btn`}
                      className={`${method.id}-button [&_#gpay-button-online-api-id]:w-full`}
                    ></div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderLoopWidget = (loop: {widget: LoopWidgetProps | null, config: LoopConnectConfig | null}) => {
    /**
     * TODO:
     * - create lifecycle hook where we load checkout data via the loop.initFlow function
     * - after we have the results, call the `initLoopConnect` component
     * - setup the callbacks
     * -
     */
    if (!loop.widget || !loop.config) {
      return null;
    }
    initLoopConnect({
      apiKey: loop.config.apiKey,
      entityId: loop.config.entityId,
      merchantId: loop.config.merchantId,
      environment: loop.config.environment,
    })
    return (
      <>
        <LoopConnectPayIn
          paymentUsdAmount={loop.widget.paymentUsdAmount}
          suggestedAuthorizationUsdAmount={loop.widget.suggestedAuthorizationUsdAmount}
          subscriptionRefId={loop.widget.subscriptionRefId}
          customerRefId={loop.widget.customerRefId}
          invoiceRefId={loop.widget.invoiceRefId}
          onPayInCustomerCreated={(customer) => {
            // TODO: set state with created customer
            console.log('customer created')
            console.log(customer)
          }}
          onPayInComplete={(payin) => {
            // TODO: submit saved customer and payin to loop.runFlow
            console.log('payin complete')
            console.log(payin)
          }}
          onPayInFailed={(details) => {
            // TODO: call loop.runFlow with failure state
            console.log('payin failed')
            console.log(details)
          }}
        />
      </>
    );
  };

  return (
    <>
      <button
        className="text-white mb-2 w-fit text-sm px-2 py-1 rounded-md bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600"
        onClick={() => setIsMounted(!isMounted)}
      >
        {isMounted ? 'Unmount' : 'Mount'}
      </button>
      {isMounted && (
        <ElementsForm
          checkoutSecureToken={token}
          onLoad={onLoad}
          onLoadError={onLoadError}
          onChange={resetErrors}
          onValidationError={onValidationError}
          onCheckoutStarted={onCheckoutStarted}
          onCheckoutSuccess={onCheckoutSuccess}
          onSetupPaymentMethodSuccess={onSetupPaymentMethodSuccess}
          onCheckoutError={onCheckoutError}
          baseUrl={props.baseUrl ?? process.env.NEXT_PUBLIC_BASE_URL}
          customInitParams={{
            stripeLink: {
              overrideLinkSubmit: async () => true,
              doNotMountOnInit: false,
            },
          }}
        >
          {({ submit, submitWith, applePay, googlePay, loaded, stripeLink, airwallex, loop}) => (
            <FormWrapper error={validationErrors}>
              {loading && (
                <div data-testid="loading" className="flex items-center">
                  <span className="text-xl animate-spin">⏳︎</span>
                  Loading...
                </div>
              )}
              {overlayMessage && (
                <div className="w-full px-4 py-2 my-2 h-full flex items-center justify-center bg-emerald-100/50 dark:bg-emerald-800/50 backdrop-blur rounded-lg cursor-not-allowed">
                  <pre data-testid="overlay-message" className="block text-xs max-w-md w-full text-wrap my-3">
                    {JSON.stringify(overlayMessage, null, 2)}
                  </pre>
                </div>
              )}
              <BillingDetails />
              {separateFrames ? (
                <>
                  <InputField hasError={!!validationErrors.card_number}>
                    <CardNumberElement styles={{ hideIcon: 'true' }} />
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
                  hasError={
                    !!validationErrors.card_number || !!validationErrors.card_expiry || !!validationErrors.card_cvc
                  }
                >
                  <CardElement />
                </InputField>
              )}
              <button
                data-testid="submit-button"
                disabled={!loaded || loading}
                onClick={submit}
                className={`shadow-lg shadow-emerald-500/50 dark:shadow-emerald-900/50 border border-emerald-600 dark:border-emerald-500 px-4 py-2.5 mt-2 w-full font-bold rounded-lg bg-emerald-500
                       dark:bg-emerald-600 text-white hover:bg-emerald-400 dark:hover:bg-emerald-500
                       active:bg-emerald-600 dark:active:bg-emerald-700 disabled:opacity-50 disabled:pointer-events-none`}
              >
                Pay with Card | {amount}
              </button>
              <div className="my-5 flex flex-row items-center gap-3">
                <HorizontalRule className="flex-1" />
                <p className="text-emerald-800 dark:text-emerald-400 text-xs">Other payment methods</p>
                <HorizontalRule className="flex-1" />
              </div>
              {renderPaymentMethods([
                {
                  id: 'stripe-link',
                  label: 'Pay with Link',
                  isAvailable: true,
                  isShown: stripeLinkShown,
                  toggleShow: async () => {
                    if (stripeLinkShown) {
                      setStripeLinkShown(false);
                      stripeLink?.dismountButton();
                    } else {
                      setStripeLinkShown(true);
                      await stripeLink?.waitForButtonToMount();
                      stripeLink?.mountButton();
                    }
                  },
                },

                {
                  id: 'airwallex-gpay',
                  label: 'Google Pay (Airwallex)',
                  isAvailable: true,
                  isShown: true,
                  toggleShow: async () => {},
                  render: () => (
                    <button
                      // We can start via submitWith or `airwallex.googlePay.startFlow`
                      // the availablity check is only available via `airwallex.googlePay`
                      onClick={() => {
                        airwallex.googlePay?.startFlow();
                      }}
                      disabled={!airwallex.googlePay?.isAvailable || loading}
                      className={classNames(
                        'px-4 py-2 mt-2 w-full rounded-lg',
                        'bg-emerald-500 dark:bg-emerald-600 text-white hover:bg-emerald-400 dark:hover:bg-emerald-500 active:bg-emerald-600 dark:active:bg-emerald-700 font-bold',
                        'disabled:bg-gray-100 disabled:text-gray-300 disabled:hover:bg-gray-100 disabled:cursor-not-allowed'
                      )}
                    >
                      Pay with Google Pay
                    </button>
                  ),
                },
                {
                  id: 'airwallex-applepay',
                  label: 'Apple Pay (Airwallex)',
                  isAvailable: true,
                  isShown: true,
                  toggleShow: async () => {},
                  render: () => (
                    <button
                      // We can start via submitWith or `airwallex.googlePay.startFlow`
                      // the availablity check is only available via `airwallex.googlePay`
                      onClick={() => submitWith('airwallex-apple-pay')}
                      disabled={!airwallex.applePay?.isAvailable || loading}
                      className={classNames(
                        'px-4 py-2 mt-2 w-full rounded-lg',
                        'bg-emerald-500 dark:bg-emerald-600 text-white hover:bg-emerald-400 dark:hover:bg-emerald-500 active:bg-emerald-600 dark:active:bg-emerald-700 font-bold',
                        'disabled:bg-gray-100 disabled:text-gray-300 disabled:hover:bg-gray-100 disabled:cursor-not-allowed'
                      )}
                    >
                      Pay with Apple Pay
                    </button>
                  ),
                },
                {
                  id: 'stripe-applepay',
                  label: 'Apple Pay (Stripe)',
                  isAvailable: applePay.isAvailable,
                  isLoading: applePay.isLoading,
                  isShown: true,
                  toggleShow: async () => {},
                  render: () => (
                    <button
                      onClick={() => applePay.startFlow(prParams)}
                      disabled={!applePay.isAvailable || loading}
                      className={classNames(
                        'px-4 py-2 mt-2 w-full rounded-lg',
                        applePay.isAvailable
                          ? 'bg-emerald-500 dark:bg-emerald-600 text-white hover:bg-emerald-400 dark:hover:bg-emerald-500 active:bg-emerald-600 dark:active:bg-emerald-700 font-bold'
                          : 'bg-gray-100 text-gray-300'
                      )}
                    >
                      {applePay.isLoading ? 'Loading' : 'Apple Pay'}
                    </button>
                  ),
                },
                {
                  id: 'stripe-googlepay',
                  label: 'Google Pay (Stripe)',
                  isAvailable: googlePay.isAvailable,
                  isLoading: googlePay.isLoading,
                  isShown: true,
                  toggleShow: async () => {},
                  render: () => (
                    <button
                      onClick={() => googlePay.startFlow(prParams)}
                      disabled={!googlePay.isAvailable || loading}
                      className={classNames(
                        'px-4 py-2 mt-2 w-full rounded-lg',
                        googlePay.isAvailable
                          ? 'bg-emerald-500 dark:bg-emerald-600 text-white hover:bg-emerald-400 dark:hover:bg-emerald-500 active:bg-emerald-600 dark:active:bg-emerald-700 font-bold'
                          : 'bg-gray-100 text-gray-300'
                      )}
                    >
                      {googlePay.isLoading ? 'Loading' : 'Google Pay'}
                    </button>
                  ),
                },
                {
                  id: 'submit-paypal',
                  label: 'Pay with PayPal (Popup Mode)',
                  isAvailable: true,
                  isLoading: false,
                  isShown: true,
                  toggleShow: async () => {},
                  render: () => (
                    <>
                    <button
                      id="submit-paypal"
                      onClick={() =>
                        submitWith('pockyt-paypal', {
                          defaultFieldValues: PAYPAL_DEFAULT_VALUES,
                        })
                      }
                      disabled={!loaded || loading}
                      className={classNames(
                        'px-4 py-2 mt-2 w-full rounded-lg',
                        'bg-emerald-500 dark:bg-emerald-600 text-white hover:bg-emerald-400 dark:hover:bg-emerald-500 active:bg-emerald-600 dark:active:bg-emerald-700 font-bold',
                        'disabled:bg-gray-100 disabled:text-gray-300 disabled:hover:bg-gray-100 disabled:cursor-not-allowed'
                      )}
                    >
                      {loading ? 'Loading' : 'Pay with PayPal (Popup Mode)'}
                    </button>
                    <button
                      id="submit-paypal-redirect"
                      onClick={() =>
                        submitWith('pockyt-paypal', {
                          defaultFieldValues: PAYPAL_DEFAULT_VALUES,
                          useRedirectFlow: true,
                        })
                      }
                      disabled={!loaded || loading}
                      className={classNames(
                        'px-4 py-2 mt-2 w-full rounded-lg',
                        'bg-emerald-500 dark:bg-emerald-600 text-white hover:bg-emerald-400 dark:hover:bg-emerald-500 active:bg-emerald-600 dark:active:bg-emerald-700 font-bold',
                        'disabled:bg-gray-100 disabled:text-gray-300 disabled:hover:bg-gray-100 disabled:cursor-not-allowed'
                      )}
                    >
                      {loading ? 'Loading' : 'Pay with PayPal (Redirect Mode)'}
                    </button>
                    </>
                  ),
                },
                {
                  id: 'loop',
                  label: 'Pay with Loop',
                  isAvailable: true,
                  isShown: loopShown,
                  toggleShow: async () => {
                    if (loopShown) {
                      setLoopShown(false);
                      renderLoopWidget(loop);
                    } else {
                      setLoopShown(true);
                      renderLoopWidget(loop);
                    }
                  },
                },
              ])}
            </FormWrapper>
          )}
        </ElementsForm>
      )}
    </>
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
    const searchParams = new URLSearchParams(window.location.search);
    searchParams.set('token', e.target.value);
    window.history.pushState({}, '', window.location.pathname + '?' + searchParams.toString());
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
    <main className="w-full max-w-3xl p-4 pt-12 mx-auto">
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
