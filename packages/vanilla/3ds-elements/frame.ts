import { createConnection } from '../utils/connection';

function startPolling(iframe: HTMLIFrameElement, onSuccess: () => void, childOrigin?: string): NodeJS.Timeout {
  const handlePolling = async () => {
    try {
      console.log('🔄 Polling CDE connection...');
      const connection = await createConnection(iframe, childOrigin);
      if (connection) {
        console.log('🟢 CDE connection successful! Stopping polling...');
        clearInterval(pollingInterval);
        onSuccess();
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

export const SIMULATE_3DS_URL = 'http://localhost:3033/simulate-3ds.html';

export function show3DSPopup({ url, baseUrl }: { url: string; baseUrl: string }) {
  // Create a style element
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

  // Create a shadow host
  const shadowHost = document.createElement('div');
  document.body.appendChild(shadowHost);

  // Attach a shadow root to the host
  const shadowRoot = shadowHost.attachShadow({ mode: 'open' });

  // Append the style to the shadow root
  shadowRoot.appendChild(style);

  const overlay = document.createElement('div');
  overlay.className = 'overlay';

  const container = document.createElement('div');
  container.className = 'container';

  const frame = document.createElement('iframe');
  // We do not directly load the url here
  // because iframe origin is different from the child origin
  // (iframe = user domain origin, child = our CDE domain origin).
  // This workaround to look like we are sending events between 2 CDE pages.
  frame.src = url;
  frame.className = 'frame';

  // Cancel button
  const cancelButton = document.createElement('button');
  cancelButton.textContent = 'Cancel';
  cancelButton.className = 'cancel-button';

  container.appendChild(cancelButton);
  container.appendChild(frame);
  overlay.appendChild(container);
  shadowRoot.appendChild(overlay);

  // Setup connection polling
  const pollingInterval = startPolling(
    frame,
    () => {
      // On successful CDE connection, remove the popup
      if (shadowRoot.contains(overlay)) {
        shadowRoot.removeChild(overlay);
      }
    },
    new URL(baseUrl).origin
  );

  // Clean up function
  const cleanup = () => {
    clearInterval(pollingInterval);
    if (shadowRoot.contains(overlay)) {
      shadowRoot.removeChild(overlay);
    }
  };

  cancelButton.addEventListener('click', cleanup);

  return { cleanup };
}

export function handle3DSStatus() {}
