import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { persistor, store } from './redux/store.js';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { Input, Timepicker, initTE } from 'tw-elements';

initTE({ Input, Timepicker });

ReactDOM.createRoot(document.getElementById('root')).render(
  // panggil store redux disini.
  <Provider store={store}>
    {/* Panggil juga persistor, supaya state management nya ga reset ketika pindah halaman */}
    <PersistGate persistor={persistor} loading={null}>
      <App />
    </PersistGate>
  </Provider>
)
