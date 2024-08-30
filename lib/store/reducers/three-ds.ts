import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';

export interface ThreeDSState {
  frameUrl?: string;
}

const initialState: ThreeDSState = {
  frameUrl: 'https://react.dev/reference/react-dom/createPortal',
};

export const threeDSSlice = createSlice({
  name: '3Ds',
  initialState,
  reducers: {
    showFrame: (state, action: PayloadAction<string>) => {
      state.frameUrl = action.payload;
    },
    hideFrame: (state) => {
      state.frameUrl = undefined;
    },
  },
});

export const { showFrame, hideFrame } = threeDSSlice.actions;

export default threeDSSlice.reducer;
