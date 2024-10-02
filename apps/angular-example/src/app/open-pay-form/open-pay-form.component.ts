import { Component, OnInit, ElementRef, ViewChild } from '@angular/core';
import { OpenPayForm } from '@getopenpay/js';

@Component({
  selector: 'app-open-pay-form',
  templateUrl: './open-pay-form.component.html',
  styleUrls: ['./open-pay-form.component.scss'],
})
export class OpenPayFormComponent implements OnInit {
  @ViewChild('formContainer', { static: true }) formContainer!: ElementRef;
  @ViewChild('submitButton', { static: true }) submitButton!: ElementRef;
  @ViewChild('applePayButton', { static: true }) applePayButton!: ElementRef;
  @ViewChild('googlePayButton', { static: true }) googlePayButton!: ElementRef;

  formInstance: OpenPayForm | null = null;
  loading = true;
  error: { type: string; message: string } | null = null;
  validationErrors: Record<string, string[]> = {};
  checkoutSuccess: { invoiceUrls: string[]; subscriptionIds: string[]; customerId: string } | null = null;
  setupSuccess: { paymentMethodId: string } | null = null;

  separateFrames = false;

  ngOnInit() {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    this.separateFrames = urlParams.get('separateFrames')?.toLowerCase() === 'true';

    this.initializeForm(token ?? '');
  }

  initializeForm(token: string) {
    this.formInstance = new OpenPayForm({
      checkoutSecureToken: token,
      formTarget: '#form-container',
      onLoad: this.onLoad.bind(this),
      onLoadError: this.onLoadError.bind(this),
      onValidationError: this.onValidationError.bind(this),
      onFocus: this.onFocus.bind(this),
      onBlur: this.onBlur.bind(this),
      onChange: this.onChange.bind(this),
      onCheckoutStarted: this.onCheckoutStarted.bind(this),
      onCheckoutSuccess: this.onCheckoutSuccess.bind(this),
      onSetupPaymentMethodSuccess: this.onSetupPaymentMethodSuccess.bind(this),
      onCheckoutError: this.onCheckoutError.bind(this),
      onPaymentRequestLoad: this.onPaymentRequestLoad.bind(this),
    });

    if (this.separateFrames) {
      this.createSeparateFrames();
    } else {
      this.createSingleFrame();
    }
  }

  createSeparateFrames() {
    this.formInstance?.createElement('card-number', { styles: { color: '#fff' } }).mount('#card-number-element');
    this.formInstance?.createElement('card-expiry', { styles: { color: '#fff' } }).mount('#card-expiry-element');
    this.formInstance?.createElement('card-cvc', { styles: { color: '#fff' } }).mount('#card-cvc-element');
  }

  createSingleFrame() {
    this.formInstance?.createElement('card', { styles: { color: '#fff' } }).mount('#card-element');
  }

  onLoad(totalAmountAtoms: number, currency: string) {
    console.log('onLoad', totalAmountAtoms, currency);
    if (this.submitButton && totalAmountAtoms && currency) {
      const amount = (totalAmountAtoms / 100).toFixed(2);
      this.submitButton.nativeElement.innerHTML = `Pay ${amount} ${currency}`;
      this.submitButton.nativeElement.disabled = false;
    }
    this.loading = false;
    this.error = null;
    this.validationErrors = {};
  }

  onLoadError(message: string) {
    console.log('Load error', message);
    this.error = { type: 'load-error', message };
    this.loading = false;
  }

  onValidationError(field: string, error: string[], elementId: string) {
    console.log('Validation error', field, error, elementId);
    this.validationErrors[field] = error;
  }

  onFocus(elementId: string) {
    console.log('onFocus', elementId);
    const container = document.querySelector('.card-element') as HTMLElement;
    if (container) {
      container.setAttribute('data-focused', 'true');
    }
  }

  onBlur() {
    const container = document.querySelector('.card-element') as HTMLElement;
    if (container) {
      container.removeAttribute('data-focused');
    }
  }

  onChange() {
    console.log('Change');
    this.validationErrors = {};
    this.error = null;
  }

  onCheckoutStarted() {
    console.log('Checkout started');
    this.loading = true;
  }

  onCheckoutSuccess(invoiceUrls: string[], subscriptionIds: string[], customerId: string) {
    console.log('Checkout success', invoiceUrls, subscriptionIds, customerId);
    this.loading = false;
    this.checkoutSuccess = { invoiceUrls, subscriptionIds, customerId };
  }

  onSetupPaymentMethodSuccess(paymentMethodId: string) {
    console.log('Setup payment method success', paymentMethodId);
    this.loading = false;
    this.setupSuccess = { paymentMethodId };
  }

  onCheckoutError(error: string) {
    console.log('Checkout error', error);
    this.loading = false;
    this.error = { type: 'checkout-error', message: error };
  }

  onPaymentRequestLoad(paymentRequests: any) {
    console.log('onPaymentRequestLoad', paymentRequests);
    if (paymentRequests.apple_pay.isAvailable) {
      console.log('Apple Pay is available');
      this.applePayButton.nativeElement.style.display = 'flex';
      this.applePayButton.nativeElement.addEventListener('click', () => {
        console.log('Apple Pay button clicked');
        paymentRequests.apple_pay.startFlow({ amountToDisplayForSetupMode: { amountAtom: 420, currency: 'usd' } });
      });
    }
    if (paymentRequests.google_pay.isAvailable) {
      console.log('Google Pay is available');
      this.googlePayButton.nativeElement.style.display = 'flex';
      this.googlePayButton.nativeElement.addEventListener('click', () => {
        console.log('Google Pay button clicked');
        paymentRequests.google_pay.startFlow({ amountToDisplayForSetupMode: { amountAtom: 420, currency: 'usd' } });
      });
    }
  }

  onSubmit() {
    console.log('Submitting form...');
    this.formInstance?.submit();
  }
}
