import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';

export interface ThreeDSState {
  frameUrl?: string;
}

const initialState: ThreeDSState = {
  frameUrl: 'https://youtu.be/FDywkYREjCk?list=RDULdVqlmWDPE',
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
