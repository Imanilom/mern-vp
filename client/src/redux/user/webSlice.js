// THIS STATE MEANAGEMENT IS CANCELED. NOT IN USE

import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  Actionriwayatmedis: null, 
  logsR : null,
  dailymetricR : null,
  metricsR : null,
  medianPropertyR : null,
  borderColorR : null,

}

const webSlice = createSlice({
  name: 'data',
  initialState,
  reducers: {
    setActionRiwayat: (state, property) => {
      state.Actionriwayatmedis = property.payload;
    },
    unsetActionRiwayat: (state) => {
      state.Actionriwayatmedis = null
    },
    clearLogsWithDailytMetric : (state) => {
      state.dailymetricR =null;
      state.logsR = null;
      state.medianPropertyR = null;
      state.metricsR = null;
      state.borderColorR = null;
      // state.isDefaultFetchData = false;
    },
    setLogsWithDailyMetric : (state, property) => {
      state.dailymetricR = property.payload.dailymetricR;
      state.logsR = property.payload.logs;
      state.medianPropertyR = property.payload.medianPropertyR;
      state.metricsR = property.payload.metricsR;
      state.borderColorR = property.payload.borderColorR;
      // state.isDefaultFetchData = true;
    },
    setDefautlFetchFalse : (state) => {
      state.isDefaultFetchData = false;
    },
    setDefautlFetchTrue : (state) => {
      state.isDefaultFetchData = true;
    }
  },
});

export const {
  setActionRiwayat,
  unsetActionRiwayat, 
  clearLogsWithDailytMetric, 
  setLogsWithDailyMetric,
  setDefautlFetchFalse,
  setDefautlFetchTrue
} = webSlice.actions;

export default webSlice.reducer;