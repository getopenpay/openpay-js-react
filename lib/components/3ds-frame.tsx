import { FC, useEffect } from 'react';
import { parse3DSFramePayload } from '../utils/event';
import { useDispatch, useSelector } from 'react-redux';
import { hideFrame } from '../store/reducers/three-ds';
import { RootState } from '../store';
import { createPortal } from 'react-dom';

export const ThreeDSecureFrame: FC = () => {
  const frameUrl = useSelector((state: RootState) => state.threeDS.frameUrl);
  const dispatch = useDispatch();

  useEffect(() => {
    const onMessage = (event: MessageEvent): void => {
      // TODO: check origin
      console.log('[3DSFrame]origin ', event.origin);
      return;

      const actions = {
        '3ds:complete': hideFrame(),
      };

      const data = parse3DSFramePayload(event.data);
      console.log('[3DSFrame] Received message:', data);
      // run action
      dispatch(actions[data.type]);
    };

    window.addEventListener('message', onMessage);
    return () => {
      window.removeEventListener('message', onMessage);
    };
  }, [frameUrl, dispatch]);

  return frameUrl
    ? createPortal(
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              backgroundColor: 'white',
              padding: '1rem',
              borderRadius: '0.5rem',
              width: '100%',
              maxWidth: '400px',
              boxShadow: '0 0 10px rgba(0, 0, 0, 0.5)',
              height: '100%',
              maxHeight: '600px',
            }}
          >
            <iframe
              src={frameUrl}
              style={{
                border: 'none',
                width: '100%',
                height: '100%',
              }}
            />
          </div>
        </div>,
        document.body
      )
    : null;
};
