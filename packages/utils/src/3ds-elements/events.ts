import { assertNever, Ping3DSStatusResponse, Ping3DSStatusResponseStrict, ThreeDSStatus } from '@getopenpay/utils';
import { CDE_POLLING_INTERVAL, pingCdeFor3dsStatus } from '../cde-client';
import { createAndOpenFrame } from './frame';

export interface PopupElements {
  host: HTMLElement;
  iframe: HTMLIFrameElement;
  cancelButton: HTMLButtonElement;
}

export function startPolling(
  iframe: HTMLIFrameElement,
  onSuccess: (status: Ping3DSStatusResponse) => void,
  childOrigin: string
): NodeJS.Timeout {
  const handlePolling = async () => {
    try {
      // console.log('🔄 Polling CDE connection...');
      const status = await pingCdeFor3dsStatus(iframe, childOrigin);
      if (status) {
        // console.log('🟢 CDE connection successful! Stopping polling...');
        // console.log('➡️ Got status:', status);
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
  resolve: (value: Ping3DSStatusResponse) => void;
}) {
  const handleCancel = () => {
    clearInterval(pollingInterval);
    elements.host.remove();
    resolve({ status: ThreeDSStatus.CANCELLED });
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
export async function start3dsVerification(params: { url: string; baseUrl: string }): Promise<Ping3DSStatusResponse> {
  const { url, baseUrl } = params;
  const elements = createAndOpenFrame(url);

  return new Promise((resolve) => {
    const onSuccess = (status: Ping3DSStatusResponse) => {
      setTimeout(() => {
        elements.host.remove();
      }, 1000); // To show the success/failure message for a second
      resolve(status);
      cleanupEventListeners?.();
    };

    const pollingInterval = startPolling(elements.iframe, onSuccess, new URL(baseUrl).origin);

    const cleanupEventListeners = handleEvents({
      elements,
      pollingInterval,
      resolve,
    });
  });
}

export const start3dsVerificationStrict = async (params: {
  url: string;
  baseUrl: string;
}): Promise<Ping3DSStatusResponseStrict> => {
  const result = await start3dsVerification(params);
  if (result.status === ThreeDSStatus.CANCELLED) {
    throw new Error('3DS verification cancelled');
  } else if (result.status === ThreeDSStatus.FAILURE) {
    throw new Error('3DS verification failed');
  } else if (result.status !== ThreeDSStatus.SUCCESS) {
    assertNever(result.status);
  }
  return {
    href: result.href,
  };
};

/**
 * Currently this is an alias for start3dsVerificationStrict.
 */
export const startIframeFlowStrict = start3dsVerificationStrict;
