/**
 * This injects an iframe into a shadow DOM and returns the overlay element.
 */
export function show3DSPopup({ url }: { url: string }) {
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
      width: clamp(300px, 40%, 600px);
      height: clamp(300px, 80%, 600px);
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
  frame.src = url;
  frame.className = 'frame';

  // Cancel button
  const cancelButton = document.createElement('button');
  cancelButton.textContent = 'Cancel';
  cancelButton.className = 'cancel-button';
  cancelButton.addEventListener('click', () => {
    shadowRoot.removeChild(overlay);
  });

  container.appendChild(cancelButton);
  container.appendChild(frame);
  overlay.appendChild(container);
  shadowRoot.appendChild(overlay);
}

export function handle3DSStatus() {}
