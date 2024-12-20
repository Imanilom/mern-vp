// THIS MAIN FILE for using REDUX

import { combineReducers, configureStore } from '@reduxjs/toolkit';
import { persistReducer, persistStore } from 'redux-persist';
import storage from 'redux-persist/lib/storage';
import webSlice from './user/webSlice.js';
import userReducer from './user/userSlice.js';

const rootReducer = combineReducers({
  user: userReducer, // masih dipake banget
  data : webSlice // udh jarang di pake
});

const persistConfig = {
  key: 'root',
  storage,
  version: 1,
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

export const persistor = persistStore(store);
