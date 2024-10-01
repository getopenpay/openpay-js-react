import './style.css';
import { OpenPayForm, FieldName } from '@getopenpay/js';
import { loadStripe } from '@stripe/stripe-js';

const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get('token');
const baseUrl = urlParams.get('baseUrl');
const separateFrames = urlParams.get('separateFrames')?.toLowerCase() === 'true';

console.log('loadStripe', loadStripe.name);

let validationErrors: Record<string, string[]> = {};

const formInstance = new OpenPayForm({
  baseUrl: baseUrl || 'http://localhost:3030',
  checkoutSecureToken: token ?? '',
  formTarget: '#app',
  onLoad: (totalAmountAtoms, currency) => {
    console.log('onLoad', totalAmountAtoms, currency);
    const submitButton = document.querySelector('#submit') as HTMLButtonElement;
    if (submitButton && totalAmountAtoms && currency) {
      const amount = (totalAmountAtoms / 100).toFixed(2);
      submitButton.innerHTML = `Pay ${amount} ${currency}`;
      submitButton.disabled = false;
    }
    hideLoading();
    hideError();
    clearValidationError();
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
    const container = document.querySelector('.card-element') as HTMLElement;
    if (container) {
      container.removeAttribute('data-focused');
    }
  },
  onChange: (elementId) => {
    console.log('Change');
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
    console.log('onPaymentRequestLoad', paymentRequests);
    if (paymentRequests.apple_pay.isAvailable) {
      console.log('Apple Pay is available');
      const applePayButton = document.querySelector('#apple-pay-button') as HTMLButtonElement;
      if (applePayButton) {
        applePayButton.style.display = 'flex';
      }
      applePayButton.addEventListener('click', () => {
        console.log('Apple Pay button clicked');
        paymentRequests.apple_pay.startFlow({ amountToDisplayForSetupMode: { amountAtom: 420, currency: 'usd' } });
      });
    }
    if (paymentRequests.google_pay.isAvailable) {
      console.log('Google Pay is available');
      const googlePayButton = document.querySelector('#google-pay-button') as HTMLButtonElement;
      if (googlePayButton) {
        googlePayButton.style.display = 'flex';
      }
      googlePayButton.addEventListener('click', () => {
        console.log('Google Pay button clicked');
        paymentRequests.google_pay.startFlow({ amountToDisplayForSetupMode: { amountAtom: 420, currency: 'usd' } });
      });
    }
  },
});

if (separateFrames) {
  const singleFrame = document.querySelector('#single-frame') as HTMLElement;
  const multipleFrames = document.querySelector('#multiple-frames') as HTMLElement;
  singleFrame.style.display = 'none';
  multipleFrames.style.display = 'grid';
  formInstance
    .createElement('card-number', {
      styles: {
        color: '#fff',
      },
    })
    .mount('#card-number-element');
  formInstance
    .createElement('card-expiry', {
      styles: {
        color: '#fff',
      },
    })
    .mount('#card-expiry-element');
  formInstance
    .createElement('card-cvc', {
      styles: {
        color: '#fff',
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
        color: '#fff',
      },
    })
    .mount('#card-element');
}

document.querySelector('#submit')?.addEventListener('click', () => {
  console.log('Submitting form...');
  formInstance.submit();
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
