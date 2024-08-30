import { configureStore } from '@reduxjs/toolkit';
import { threeDSSlice } from './reducers/three-ds';

export const store = configureStore({
  reducer: {
    threeDS: threeDSSlice.reducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
