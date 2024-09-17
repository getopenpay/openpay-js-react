import { convertStylesToQueryString, ElementProps, ElementsFormProps } from '@getopenpay/utils';

type ElementType = 'card' | 'card-number' | 'card-expiry' | 'card-cvc';

class OpenPayForm {
  config: ElementsFormProps;
  elements: Record<ElementType, any> | null;
  formId: string;
  referer: string;
  eventHandler: OpenPayFormEventHandler;

  constructor(config: ElementsFormProps) {
    this.config = config;
    this.elements = null;
    this.formId = `opjs-form-${window.crypto.randomUUID()}`;
    this.referer = window.location.origin;
    this.eventHandler = new OpenPayFormEventHandler(this, config);
    window.addEventListener('message', this.eventHandler.handleMessage.bind(this.eventHandler));
  }
  // Add to OpenPayForm destroy method
  destroy() {
    // ... existing code ...
    window.removeEventListener('message', this.eventHandler.handleMessage.bind(this.eventHandler));
  }

  createElement(type: ElementType, options: ElementProps = {}) {
    const frame = document.createElement('iframe');

    if (!this.config) {
      throw new Error('OpenPay form not initialized');
    }

    const queryString = new URLSearchParams();
    queryString.append('secureToken', this.config.checkoutSecureToken);
    if (options.styles) {
      const styleString = convertStylesToQueryString(options.styles);
      queryString.append('styles', styleString);
    }

    frame.name = `${type}-element`;
    frame.src = `${this.config.baseUrl}/app/v1/${type}-element/?${queryString.toString()}`;
    frame.style.border = 'none';
    frame.style.width = '100%';
    // frame.style.height = this.config.formHeight;

    const element = {
      type,
      node: frame,
      mount: (selector: string) => {
        document.querySelector(selector)?.appendChild(frame);
      },
    };
    if (this.elements) {
      this.elements[type] = element;
    } else {
      this.elements = { [type]: element } as Record<ElementType, any>;
    }
    return element;
  }

  submit() {
    console.log('Submitting form...');
    if (this.config.onCheckoutStarted) {
      this.config.onCheckoutStarted();
    }
    // Simulating successful checkout
    setTimeout(() => {
      if (this.config.onCheckoutSuccess) {
        this.config.onCheckoutSuccess();
      }
    }, 1000);
  }

  applePay = {
    isAvailable: () => {
      console.log('Checking if Apple Pay is available...');
      return Promise.resolve(false); // Simulated result
    },
    startFlow: () => {
      console.log('Starting Apple Pay flow...');
      // Implementation would go here
    },
  };
}

// Usage example
const formInstance = new OpenPayForm({
  checkoutSecureToken: 'your-token-here',
  onFocus: () => console.log('Element focused'),
  onBlur: () => console.log('Element blurred'),
  onChange: () => console.log('Element value changed'),
  onLoad: () => console.log('Form loaded'),
  onLoadError: (error) => console.error('Load error:', error),
  onValidationError: (error) => console.error('Validation error:', error),
  onCheckoutStarted: () => console.log('Checkout started'),
  onCheckoutSuccess: () => console.log('Checkout successful'),
  onCheckoutError: (error) => console.error('Checkout error:', error),
  onSetupCheckoutSuccess: () => console.log('Setup checkout successful'),
  baseUrl: 'https://api.example.com',
  target: 'dom_selector',
});

const cardElement = formInstance.createElement('CARD');
cardElement.mount('dom_selector');

const numberElement = formInstance.createElement('CARD_NUMBER', {
  styles: {
    color: '#111111',
    backgroundColor: '#eeeeee',
  },
});
numberElement.mount('dom_selector');

formInstance.submit();

formInstance.applePay.isAvailable().then((available) => {
  if (available) {
    formInstance.applePay.startFlow();
  }
});

// Cleanup
formInstance.destroy();
