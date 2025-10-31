// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDoFxOJKSOb-b1dDV0ERtCaNRvBDAcsQfU",
  authDomain: "aquabill-e7b76.firebaseapp.com",
  projectId: "aquabill-e7b76",
  storageBucket: "aquabill-e7b76.firebasestorage.app",
  messagingSenderId: "999846775887",
  appId: "1:999846775887:web:0fdfa9564af935c6612e3a",
  measurementId: "G-J01ZF7WYSL"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, analytics, auth, db };