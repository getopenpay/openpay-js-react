import { Ping3DSStatusResponse, ThreeDSStatus } from '@getopenpay/utils';
import { CDE_POLLING_INTERVAL, pingCdeFor3dsStatus } from '../cde-client';
import { createAndOpenFrame } from './frame';

export interface PopupElements {
  host: HTMLElement;
  iframe: HTMLIFrameElement;
  cancelButton: HTMLButtonElement;
}

export function startPolling(
  iframe: HTMLIFrameElement,
  onSuccess: (status: Ping3DSStatusResponse['status']) => void
): NodeJS.Timeout {
  const handlePolling = async () => {
    try {
      console.log('🔄 Polling CDE connection...');
      const status = await pingCdeFor3dsStatus(iframe);
      if (status) {
        console.log('🟢 CDE connection successful! Stopping polling...');
        console.log('➡️ Got status:', status);
        clearInterval(pollingInterval);
        onSuccess(status);
      }
    } catch (error) {
      // Connection failed, continue polling
    }
  };
  handlePolling();
  const pollingInterval = setInterval(handlePolling, CDE_POLLING_INTERVAL);
  return pollingInterval;
}

export function handleEvents({
  elements,
  pollingInterval,
  resolve,
}: {
  elements: PopupElements;
  pollingInterval: NodeJS.Timeout;
  resolve: (value: Ping3DSStatusResponse['status']) => void;
}) {
  const handleCancel = () => {
    clearInterval(pollingInterval);
    elements.host.remove();
    resolve(ThreeDSStatus.CANCELLED);
  };

  elements.cancelButton.addEventListener('click', handleCancel);

  const cleanupEventListeners = () => {
    elements.cancelButton.removeEventListener('click', handleCancel);
  };

  return cleanupEventListeners;
}

/**
 * @returns `Promise<'success' | 'failure' | 'cancelled'>`
 */
export async function start3dsVerification({ url }: { url: string }): Promise<Ping3DSStatusResponse['status']> {
  const elements = createAndOpenFrame(url);

  return new Promise((resolve) => {
    const onSuccess = (status: Ping3DSStatusResponse['status']) => {
      setTimeout(() => {
        elements.host.remove();
      }, 1000); // To show the success/failure message for a second
      resolve(status);
      cleanupEventListeners?.();
    };

    const pollingInterval = startPolling(elements.iframe, onSuccess);

    const cleanupEventListeners = handleEvents({
      elements,
      pollingInterval,
      resolve,
    });
  });
}