/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
// Copy-pasted from streamich/react-use: https://github.com/streamich/react-use/blob/master/src/useMap.ts

import { useCallback, useMemo, useState } from 'react';

export interface StableActions<T extends object> {
  set: <K extends keyof T>(key: K, value: T[K]) => void;
  setAll: (newMap: T) => void;
  remove: <K extends keyof T>(key: K) => void;
  reset: () => void;
}

export interface Actions<T extends object> extends StableActions<T> {
  get: <K extends keyof T>(key: K) => T[K];
}

const useMap = <T extends object = any>(initialMap: T = {} as T): [T, Actions<T>] => {
  const [map, set] = useState<T>(initialMap);

  const stableActions = useMemo<StableActions<T>>(
    () => ({
      set: (key, entry) => {
        set((prevMap) => ({
          ...prevMap,
          [key]: entry,
        }));
      },
      setAll: (newMap: T) => {
        set(newMap);
      },
      remove: (key) => {
        set((prevMap) => {
          const { [key]: omit, ...rest } = prevMap;
          return rest as T;
        });
      },
      reset: () => set(initialMap),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [set]
  );

  const utils = {
    get: useCallback((key) => map[key], [map]),
    ...stableActions,
  } as Actions<T>;

  return [map, utils];
};

export default useMap;
