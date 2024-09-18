import './style.css';
// import typescriptLogo from './typescript.svg';
// import viteLogo from '/vite.svg';
// import { setupCounter } from './counter.ts';
import { OpenPayForm } from '@getopenpay/js';

const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get('token');

const formInstance = new OpenPayForm({
  checkoutSecureToken: token ?? '',
});

formInstance
  .createElement('card', {
    styles: {
      backgroundColor: 'white',
      color: 'black',
    },
  })
  .mount('#card-element');

document.querySelector('#submit')?.addEventListener('click', () => {
  formInstance.submit();
});
