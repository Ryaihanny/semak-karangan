// lib/firebaseClient.js
import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Your Firebase web config (get it from Firebase Console)
const firebaseConfig = {
  apiKey: "AIzaSyCEAApdmmVYte4KoTEsuW4NtwYJjzFHGUc",
  authDomain: "semakkarangan.firebaseapp.com",
  projectId: "semakkarangan",
  storageBucket: "semakkarangan.firebasestorage.app",
  messagingSenderId: "132910646373",
  appId: "1:132910646373:web:bbd866439d8d7a1fc8328c",
};

let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
