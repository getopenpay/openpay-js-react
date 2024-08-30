import { FC, useEffect } from 'react';
import { parse3DSFramePayload } from '../utils/event';
import { useDispatch, useSelector } from 'react-redux';
import { hideFrame } from '../store/reducers/three-ds';
import { RootState } from '../store';

export const ThreeDSecureFrame: FC = () => {
  const frameUrl = useSelector((state: RootState) => state.threeDS.frameUrl);
  const dispatch = useDispatch();

  useEffect(() => {
    const onMessage = (event: MessageEvent): void => {
      if (event.origin !== frameUrl) return;
      const actions = {
        '3ds:complete': () => {
          dispatch(hideFrame());
        },
      };

      const data = parse3DSFramePayload(event.data);
      // run action
      actions[data.type]();
    };

    window.addEventListener('message', onMessage);
    return () => {
      window.removeEventListener('message', onMessage);
    };
  }, [frameUrl, dispatch]);

  return frameUrl ? (
    <div className="fixed z-50 inset-0 bg-black bg-opacity-90 flex items-center justify-center">
      <div role="dialog" className="relative w-full h-full max-w-3xl max-h-3xl bg-white rounded-lg shadow-lg">
        <iframe src={frameUrl} title="3DSecureFrame" width="100%" height="100%" />
      </div>
    </div>
  ) : null;
};
