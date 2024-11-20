import { Ping3DSStatusResponse, ThreeDSStatus } from '@getopenpay/utils';
import { pingCdeFor3dsStatus } from '../utils/connection';
export const SIMULATE_3DS_URL = 'http://localhost:3033/simulate-3ds.html';

function startPolling(
  iframe: HTMLIFrameElement,
  onSuccess: (status: Ping3DSStatusResponse['status']) => void,
  childOrigin: string
): NodeJS.Timeout {
  const handlePolling = async () => {
    try {
      console.log('🔄 Polling CDE connection...');
      const status = await pingCdeFor3dsStatus(iframe, childOrigin);
      if (status) {
        console.log('🟢 CDE connection successful! Stopping polling...');
        console.log('➡️ Got status:', status);
        clearInterval(pollingInterval);
        onSuccess(status);
      }
    } catch (error) {
      // console.error('🔴 CDE connection failed, continuing to poll...');
      // Connection failed, continue polling
    }
  };
  handlePolling();
  const pollingInterval = setInterval(handlePolling, 1000); // Poll every second
  return pollingInterval;
}

const createStyles = () => {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes fadeIn {
      from { opacity: 0; transform: scale(0.9); }
      to { opacity: 1; transform: scale(1); }
    }

    .overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 2147483648 !important;
      display: flex;
      justify-content: center;
      align-items: center;
      background-color: rgba(0, 0, 0, 0.5);
    }
    .container {
      width: clamp(28rem, 35%, 30rem);
      height: clamp(20rem, 80%, 46rem);
      background-color: white;
      position: relative;
      animation: fadeIn 0.3s ease-out;
    }
    .frame {
      width: 100%;
      height: 100%;
      border: none;
    }
    .cancel-button {
      position: absolute;
      background: transparent;
      border: none;
      font-size: 1rem;
      color: #fff;
      cursor: pointer;
      top: -1.5rem;
      padding: 0;
      right: 0;
    }
  `;
  return style;
};

interface DOMElements {
  shadowHost: HTMLDivElement;
  shadowRoot: ShadowRoot;
  overlay: HTMLDivElement;
  container: HTMLDivElement;
  frame: HTMLIFrameElement;
  cancelButton: HTMLButtonElement;
}

const constructPopup = (url: string): DOMElements => {
  const shadowHost = document.createElement('div');
  // Used shadowRoot to avoid CSS conflicts with the parent
  const shadowRoot = shadowHost.attachShadow({ mode: 'open' });
  const overlay = document.createElement('div');
  const container = document.createElement('div');
  const frame = document.createElement('iframe');
  const cancelButton = document.createElement('button');

  const style = createStyles();
  overlay.className = 'overlay';
  container.className = 'container';
  frame.className = 'frame';
  frame.src = url;
  cancelButton.textContent = 'Cancel';
  cancelButton.className = 'cancel-button';

  shadowRoot.appendChild(style);
  container.appendChild(cancelButton);
  container.appendChild(frame);
  overlay.appendChild(container);
  shadowRoot.appendChild(overlay);
  document.body.appendChild(shadowHost);

  return {
    shadowHost,
    shadowRoot,
    overlay,
    container,
    frame,
    cancelButton,
  };
};

/**
 * @returns `Promise<'success' | 'failure' | 'cancelled'>`
 */
export async function start3dsVerification({
  url,
  baseUrl,
}: {
  url: string;
  baseUrl: string;
}): Promise<Ping3DSStatusResponse['status']> {
  const { shadowHost, shadowRoot, overlay, frame, cancelButton } = constructPopup(url);

  // Cleanup function that handles all DOM removal
  function cleanup() {
    if (shadowRoot.contains(overlay)) {
      shadowRoot.removeChild(overlay);
    }
    if (document.body.contains(shadowHost)) {
      document.body.removeChild(shadowHost);
    }
  }

  return new Promise((resolve) => {
    // Setup connection polling
    const pollingInterval = startPolling(
      frame,
      (status) => {
        setTimeout(() => {
          cleanup();
        }, 1500);
        resolve(status);
        cleanupEventListeners();
      }, // onSuccessCallback
      new URL(baseUrl).origin // childOrigin
    );

    function handleCancel() {
      clearInterval(pollingInterval);
      cleanup();
      resolve(ThreeDSStatus.CANCELLED);
      cleanupEventListeners();
    }

    cancelButton.addEventListener('click', handleCancel);

    function cleanupEventListeners() {
      cancelButton.removeEventListener('click', handleCancel);
    }
  });
}
