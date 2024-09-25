import './style.css';
// import typescriptLogo from './typescript.svg';
// import viteLogo from '/vite.svg';
// import { setupCounter } from './counter.ts';
import { OpenPayForm } from '@getopenpay/js';

const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get('token');

const formInstance = new OpenPayForm({
  baseUrl: 'http://localhost:3030',
  checkoutSecureToken: token ?? '',
});

formInstance
  .createElement('card', {
    styles: {
      color: 'red',
    },
  })
  .mount('#card-element');

document.querySelector('#submit')?.addEventListener('click', () => {
  console.log('Submitting form...');
  formInstance.submit();
});
