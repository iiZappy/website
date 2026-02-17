// Firebase init for Klonkie's Social (ES modules via CDN)

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  getFirestore,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  getStorage,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// Your web app's Firebase configuration
export const firebaseConfig = {
  apiKey: "AIzaSyCOPQkt-kupnIS-7jANA8fT6M8KUs0zMpE",
  authDomain: "site-8a63f.firebaseapp.com",
  projectId: "site-8a63f",
  storageBucket: "site-8a63f.firebasestorage.app",
  messagingSenderId: "1036707064915",
  appId: "1:1036707064915:web:eb8feef43b1e9cb8a6eaa6",
  measurementId: "G-YJ59ZDGTVQ",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
