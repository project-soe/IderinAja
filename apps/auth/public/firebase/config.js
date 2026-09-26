import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";

import {
  initializeFirestore,
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCo2mE2do07rZq4B8Qw5mux9oO7cc2lj3I",
  authDomain: "absensitamu.firebaseapp.com",
  projectId: "absensitamu",
  storageBucket: "absensitamu.firebasestorage.app",
  messagingSenderId: "187515494925",
  appId: "1:187515494925:web:e72557897fd58f5a392b44",
  measurementId: "G-XBPX4ZMJ43",
};

export const firebaseApp =
  initializeApp(firebaseConfig);

export const firestoreDb =
  initializeFirestore(
    firebaseApp,
    {},
    "default"
  );

// Public Web Push key from Firebase Console.
// Replace this placeholder after enabling Firebase Cloud Messaging Web Push.
export const FCM_VAPID_KEY = "BAjoHoxqGZNno9YPHl7HtEOyeYeDx15p4PyDY0RU4ys31Hg9nxqY1rTPZ5lOtNyAHUDopPSS-AxwqIPW4IisrJQ";

export { firebaseConfig };
