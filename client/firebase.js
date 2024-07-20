// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: "vidyamedic-bb1f1.firebaseapp.com",
  projectId: "vidyamedic-bb1f1",
  storageBucket: "vidyamedic-bb1f1.appspot.com",
  messagingSenderId: "744233074018",
  appId: "1:744233074018:web:33343736a9de4c2e58803b",
  measurementId: "G-Y7K7HEBH8G"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const analytics = getAnalytics(app);