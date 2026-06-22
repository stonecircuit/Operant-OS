import { initializeApp } from "firebase/app";

import { getAuth } from "firebase/auth";

import { getFirestore } from "firebase/firestore";

const firebaseConfig = {

  apiKey: "AIzaSyB_SF_i0bh1y1E1cvi4Le6J0_p23cpszsc",

  authDomain: "operant-os.firebaseapp.com",

  projectId: "operant-os",

  storageBucket: "operant-os.firebasestorage.app",

  messagingSenderId: "597396166242",

  appId: "1:597396166242:web:e2057c04d4be7443c9a33b",

};



export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);