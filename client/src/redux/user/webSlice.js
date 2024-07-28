import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  Actionriwayatmedis: null
}

const webSlice = createSlice({
  name: 'web',
  initialState,
  reducers: {
    setActionRiwayat: (state, property) => {
      state.Actionriwayatmedis = property.payload;
    },
    unsetActionRiwayat: (state) => {
      state.Actionriwayatmedis = null
    },
  },
});

export const {
  setActionRiwayat,
  unsetActionRiwayat
} = webSlice.actions;

export default webSlice.reducer;