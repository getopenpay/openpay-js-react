import { CheckoutPaymentMethod, convertStylesToQueryString, ElementProps, ElementsFormProps } from '@getopenpay/utils';
import { OpenPayFormEventHandler } from './event';
export type ElementType = 'card' | 'card-number' | 'card-expiry' | 'card-cvc';

export type Config = Omit<ElementsFormProps, 'children'> & {
  formTarget?: string;
};
export class OpenPayForm {
  config: Config;
  elements: Record<
    ElementType,
    {
      type: ElementType;
      node: HTMLIFrameElement;
      mount: (selector: string) => void;
    }
  > | null;
  formId: string;
  referer: string;
  eventHandler: OpenPayFormEventHandler;
  formProperties: {
    height: string;
  };
  sessionId: null | string;
  checkoutPaymentMethods: Array<CheckoutPaymentMethod>;
  formTarget: string;

  constructor(config: Config) {
    this.config = config;
    this.config.baseUrl = config.baseUrl ?? 'https://cde.openpaystaging.com';
    this.elements = null;
    this.formId = `opjs-form-${window.crypto.randomUUID()}`;
    this.referer = window.location.origin;
    this.eventHandler = new OpenPayFormEventHandler(this);
    this.formTarget = config.formTarget ?? 'body';
    this.formProperties = new Proxy(
      {
        height: '1px',
      },
      {
        set: (target, prop, value) => {
          if (prop === 'height') {
            // console.log('Setting form height:', value);
            target[prop] = value;
            if (this.elements) {
              Object.values(this.elements).forEach((element) => {
                element.node.style.height = value;
              });
            }
            return true;
          }
          return false;
        },
      }
    );
    this.sessionId = null;
    this.checkoutPaymentMethods = [];
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
    queryString.append('referer', this.referer);
    queryString.append('formId', this.formId);
    if (options.styles) {
      const styleString = convertStylesToQueryString(options.styles);
      queryString.append('styles', styleString);
    }
    queryString.append('secureToken', this.config.checkoutSecureToken);

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
      this.elements = { [type]: element } as OpenPayForm['elements'];
    }
    return element;
  }

  submit() {
    this.eventHandler.handleFormSubmit();

    // console.log('Submitting form...');
    // if (this.config.onCheckoutStarted) {
    //   this.config.onCheckoutStarted();
    // }
    // // Simulating successful checkout
    // setTimeout(() => {
    //   if (this.config.onCheckoutSuccess) {
    //     this.config.onCheckoutSuccess();
    //   }
    // }, 1000);
  }

  // applePay = {
  //   isAvailable: () => {
  //     console.log('Checking if Apple Pay is available...');
  //     return Promise.resolve(false); // Simulated result
  //   },
  //   startFlow: () => {
  //     console.log('Starting Apple Pay flow...');
  //     // Implementation would go here
  //   },
  // };
}
