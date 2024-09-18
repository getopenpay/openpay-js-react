import './style.css';
// import typescriptLogo from './typescript.svg';
// import viteLogo from '/vite.svg';
// import { setupCounter } from './counter.ts';
import { OpenPayForm } from '@getopenpay/js';

const formInstance = new OpenPayForm({
  checkoutSecureToken: '4262a7a5-97c2-415a-98b8-4fb2a1161cd0',
});

formInstance
  .createElement('card', {
    styles: {
      backgroundColor: 'white',
      color: 'black',
    },
  })
  .mount('#card-element');
