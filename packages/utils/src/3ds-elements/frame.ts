import styles from './style.css?inline';

export const SIMULATE_3DS_URL = 'http://localhost:3033/simulate-3ds.html';

export const createAndOpenFrame = (url: string) => {
  const template = document.createElement('template');
  template.innerHTML = `
    <style>
      ${styles}
    </style>
    <div class="overlay">
      <div class="container">
        <button class="cancel-button">Cancel</button>
        <iframe src="${url}" width="600" height="400" class="frame" id="three-ds-iframe" title="3D Secure verification" allow="payment"></iframe>
      </div>
    </div>
  `;
  const host = document.createElement('div');
  const shadowRoot = host.attachShadow({ mode: 'open' });
  shadowRoot.appendChild(template.content.cloneNode(true));
  const iframe = shadowRoot.querySelector('#three-ds-iframe') as HTMLIFrameElement;
  const cancelButton = shadowRoot.querySelector('.cancel-button') as HTMLButtonElement;
  document.body.appendChild(host);

  return { host, iframe, cancelButton };
};
