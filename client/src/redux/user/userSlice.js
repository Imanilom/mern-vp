import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  isLightMode_ : true, // untuk mengatur thema
  currentUser: null, // untuk menyimpan data pasien / dokter yang login
  error: null, // untuk menampilkan error di halaman web
  loading: false, // gatau masi kepake atau ga
  DocterPatient : null, // untuk menyimpan data pasien yang sedang di monitroing dokter
};

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    signInStart: (state) => { // state bukan data yng dikirim melalui dispatch melainkan mengambil state saat ini untuk di update
      state.loading = true;
    },
    signInSuccess: (state, action) => {
      state.currentUser = action.payload;
      state.loading = false;
      state.error = null;
    },
    signInFailure: (state, action) => {
      state.error = action.payload;
      state.loading = false;
    },
    updateUserStart: (state) => {
      state.loading = true;
    },
    updateUserSuccess: (state, action) => {
      state.currentUser = action.payload;
      state.loading = false;
      state.error = null;
    },
    updateUserFailure: (state, action) => {
      state.error = action.payload;
      state.loading = false;
    },
    deleteUserStart: (state) => {
      state.loading = true;
    },
    deleteUserSuccess: (state) => {
      state.currentUser = null;
      state.loading = false;
      state.error = null;
    },
    deleteUserFailure: (state, action) => {
      state.error = action.payload;
      state.loading = false;
    },
    signOutUserStart: (state) => {
      state.loading = true;
    },
    signOutUserSuccess: (state) => {
      state.currentUser = null;
      state.loading = false;
      state.error = null;
    },
    signOutUserFailure: (state, action) => {
      state.error = action.payload;
      state.loading = false;
    },
    docterGetUser: (state, property) => {
      state.DocterPatient = property.payload;
    },
    docterUnsetUser: (state) => {
      state.DocterPatient = null;
    },
    setThemeWeb : (state, property) => {
      // true / false
      state.isLightMode_ = property.payload;
    }
  },
});

export const {
  signInStart,
  signInSuccess,
  signInFailure,
  updateUserFailure,
  updateUserSuccess,
  updateUserStart,
  deleteUserFailure,
  deleteUserSuccess,
  deleteUserStart,
  signOutUserFailure,
  signOutUserSuccess,
  signOutUserStart,
  docterGetUser,
  docterUnsetUser,
  setThemeWeb
} = userSlice.actions;

export default userSlice.reducer;
