import './style.css';
import { OpenPayForm } from '@getopenpay/openpay-js';

const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get('token');
const baseUrl = urlParams.get('baseUrl') || import.meta.env.VITE_BASE_URL;
const separateFrames = urlParams.get('separateFrames')?.toLowerCase() === 'true';

const PAYPAL_DEFAULT_VALUES = {
  email: 'PAYPAL_PAYMENT@email.com',
  firstName: 'PAYPAL_PAYMENT_FIRST_NAME',
  lastName: 'PAYPAL_PAYMENT_LAST_NAME',
  zipCode: '12345',
  country: 'US',
};

let previousFormInstance: OpenPayForm | null = null;
let validationErrors: Record<string, string[]> = {};
let secureToken = token;

if (secureToken) initializeForm(secureToken);

const secureTokenInput = document.querySelector('#secure-token') as HTMLInputElement;
secureTokenInput.addEventListener('change', () => {
  secureToken = secureTokenInput.value;
  if (secureToken.length) initializeForm(secureToken);
});

function initializeForm(token: string) {
  if (previousFormInstance) {
    previousFormInstance.destroy();
  }
  const formInstance = new OpenPayForm({
    checkoutSecureToken: token,
    formTarget: '#app',
    baseUrl: baseUrl || undefined,
    onLoad: (totalAmountAtoms, currency) => {
      const submitButton = document.querySelector('#submit') as HTMLButtonElement;
      if (submitButton && totalAmountAtoms && currency) {
        const amount = (totalAmountAtoms / 100).toFixed(2);
        submitButton.innerHTML = `Pay ${amount} ${currency.toUpperCase()}`;
      }
      submitButton.disabled = false;
      hideLoading();
      hideError();
      clearValidationError();

      const availablePaymentMethods = formInstance.getAvailablePaymentMethods();
      // Conditionally render paymethods based on availability
      availablePaymentMethods?.forEach((method) => {
        if (method.name === 'airwallexApplePay' && 'isAvailable' in method && method.isAvailable) {
          document.querySelector('#submit-awx-apple-pay')?.removeAttribute('disabled');
        }
        if (method.name === 'airwallexGooglePay' && 'isAvailable' in method && method.isAvailable) {
          document.querySelector('#submit-awx-google-pay')?.removeAttribute('disabled');
        }
      });
    },
    onLoadError: (message) => {
      console.log('Load error', message);
      const errorMessage = {
        type: 'load-error',
        message: message,
      };
      showError(errorMessage);
      hideLoading();
    },
    onValidationError: (field, error, elementId) => {
      console.log('Validation error', field, error, elementId);
      // [elementType]: errors,
      validationErrors[field] = error;
      // if (elementId && error) {
      showValidationError(validationErrors);
      // }
    },
    onFocus: (elementId) => {
      console.log('onFocus', elementId);
      const container = document.querySelector('.card-element') as HTMLElement;
      if (container) {
        container.setAttribute('data-focused', 'true');
      }
    },
    onBlur: (elementId) => {
      console.log('onBlur', elementId);
      const container = document.querySelector('.card-element') as HTMLElement;
      if (container) {
        container.removeAttribute('data-focused');
      }
    },
    onChange: (elementId, field, errors) => {
      console.log({ elementId }, { field }, { errors });
      clearValidationError();
      hideError();
    },
    onCheckoutStarted: () => {
      console.log('Checkout started');
      showLoading();
    },
    onCheckoutSuccess: (invoiceUrls, subscriptionIds, customerId) => {
      console.log('Checkout success', invoiceUrls, subscriptionIds, customerId);
      hideLoading();
      showCheckoutSuccess(invoiceUrls, subscriptionIds, customerId);
    },
    onSetupPaymentMethodSuccess: (paymentMethodId) => {
      console.log('Setup payment method success', paymentMethodId);
      hideLoading();
      showSetupSuccess(paymentMethodId);
    },
    onCheckoutError: (error) => {
      console.log('Checkout error', error);
      const errorMessage = {
        type: 'checkout-error',
        message: error,
      };
      hideLoading();
      showError(errorMessage);
    },
    onPaymentRequestLoad(paymentRequests) {
      if (paymentRequests.apple_pay.isAvailable) {
        const applePayButton = document.querySelector('#apple-pay-button') as HTMLButtonElement;
        if (applePayButton) {
          applePayButton.style.display = 'flex';

          applePayButton.addEventListener('click', () => {
            paymentRequests.apple_pay.startFlow({
              overridePaymentRequest: { amount: { amountAtom: 420, currency: 'usd' }, pending: false },
            });
          });
        }
      }
      if (paymentRequests.google_pay.isAvailable) {
        const googlePayButton = document.querySelector('#google-pay-button') as HTMLButtonElement;
        if (googlePayButton) {
          googlePayButton.style.display = 'flex';

          googlePayButton.addEventListener('click', () => {
            paymentRequests.google_pay.startFlow({
              overridePaymentRequest: { amount: { amountAtom: 420, currency: 'usd' }, pending: false },
            });
          });
        }
      } else if (!paymentRequests.google_pay.isAvailable && !paymentRequests.google_pay.isLoading) {
        const googlePayButton = document.querySelector('#google-pay-button') as HTMLButtonElement;
        googlePayButton.style.display = 'flex';
        googlePayButton.disabled = true;
      }
    },
    customInitParams: {
      stripeLink: {
        overrideLinkSubmit: async () => true,
      },
    },
  });
  previousFormInstance = formInstance;
  if (separateFrames) {
    const singleFrame = document.querySelector('#single-frame') as HTMLElement;
    const multipleFrames = document.querySelector('#multiple-frames') as HTMLElement;
    singleFrame.style.display = 'none';
    multipleFrames.style.display = 'grid';
    formInstance
      .createElement('card-number', {
        styles: {
          color: 'lightblue',
          hideIcon: 'true',
        },
      })
      .mount('#card-number-element');
    formInstance
      .createElement('card-expiry', {
        styles: {
          color: 'lightblue',
        },
      })
      .mount('#card-expiry-element');
    formInstance
      .createElement('card-cvc', {
        styles: {
          color: 'lightblue',
        },
      })
      .mount('#card-cvc-element');
  } else {
    const singleFrame = document.querySelector('#single-frame') as HTMLElement;
    singleFrame.style.display = 'grid';
    const multipleFrames = document.querySelector('#multiple-frames') as HTMLElement;
    multipleFrames.style.display = 'none';
    formInstance
      .createElement('card', {
        styles: {
          color: 'lightblue',
          // hideIcon: 'true',
        },
      })
      .mount('#card-element');
  }

  document.querySelector('#submit')?.addEventListener('click', () => {
    console.log('Submitting form...');
    formInstance.submit();
  });

  document.querySelector('#submit-paypal')?.addEventListener('click', () => {
    formInstance.generalSubmit('pockyt-paypal', {
      defaultFieldValues: PAYPAL_DEFAULT_VALUES,
      useRedirectFlow: true,
    });
  });

  document.querySelector('#submit-awx-google-pay')?.addEventListener('click', () => {
    formInstance.generalSubmit('airwallex-google-pay');
  });

  document.querySelector('#submit-awx-apple-pay')?.addEventListener('click', () => {
    formInstance.generalSubmit('airwallex-apple-pay');
  });
  function showLoading() {
    const loadingElement = document.querySelector('#loading') as HTMLElement;
    if (loadingElement) {
      loadingElement.style.display = 'flex';
    }
  }

  function hideLoading() {
    const loadingElement = document.querySelector('#loading') as HTMLElement;
    if (loadingElement) {
      loadingElement.style.display = 'none';
    }
  }

  function showValidationError(errors: Record<string, string[]>) {
    const errorContainer = document.querySelector('#validation-error-container') as HTMLElement;
    if (errorContainer) {
      errorContainer.innerHTML = `<pre data-testid="validation-error">${JSON.stringify(errors, null, 2)}</pre>`;
      // errorContainer.style.display = 'block';
    }
  }

  function clearValidationError() {
    validationErrors = {};
    const errorContainer = document.querySelector('#validation-error-container') as HTMLElement;
    if (errorContainer) {
      errorContainer.innerHTML = `<pre data-testid="validation-error">${JSON.stringify(validationErrors, null, 2)}</pre>`;
      // errorContainer.style.display = 'none';
    }
  }

  function showCheckoutSuccess(invoiceUrls: string[], subscriptionIds: string[], customerId: string) {
    const successElement = document.querySelector('#checkout-success') as HTMLElement;
    if (successElement) {
      successElement.innerHTML = `
      <h2 class="text-xl font-bold">🎉 Checkout successful!</h2>
      <p class="my-2">Invoice URLs:</p>
      <ul data-testid="invoice-list" class="text-sm list-inside list-decimal mb-4">
        ${invoiceUrls.map((url) => `<li class="mb-2"><a href="${url}" target="_blank" rel="noreferrer" class="underline">${url}</a></li>`).join('')}
      </ul>
      <p class="my-2">Subscription IDs:</p>
      <ul data-testid="subscription-list" class="text-sm list-inside list-decimal">
        ${subscriptionIds.map((id) => `<li class="mb-2">${id}</li>`).join('')}
      </ul>
      <p class="my-2">Customer ID:</p>
      <p data-testid="customer-id" class="text-sm">${customerId}</p>
    `;
      successElement.style.display = 'block';
    }
  }

  function showSetupSuccess(paymentMethodId: string) {
    const successElement = document.querySelector('#setup-success') as HTMLElement;
    if (successElement) {
      successElement.innerHTML = `
      <h2 class="text-xl font-bold">🎉 Setup/Update successful!</h2>
      <p class="my-2">Payment method ID:</p>
      <p data-testid="payment-method-id" class="text-sm">${paymentMethodId}</p>
    `;
      successElement.style.display = 'block';
    }
  }

  function showError(errorMessage: { type: string; message: string }) {
    const errorContainer = document.querySelector('#error-container') as HTMLElement;
    if (errorContainer) {
      errorContainer.innerHTML = `<pre data-testid="overlay-message">${JSON.stringify(errorMessage, null, 2)}</pre>`;
      errorContainer.style.display = 'block';
    }
  }

  function hideError() {
    const errorContainer = document.querySelector('#error-container') as HTMLElement;
    errorContainer.innerHTML = '';
    // if (errorContainer) {
    //   errorContainer.style.display = 'none';
    // }
  }

  // Initialize
  showLoading();
}
