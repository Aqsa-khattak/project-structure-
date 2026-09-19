import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

export const firebaseConfig = {
  apiKey: "AIzaSyAYiMn7gEQuzUQs4UMG79bZj4reVp6L0Ik",
  authDomain: "team-project-eb57c.firebaseapp.com",
  projectId: "team-project-eb57c",
  storageBucket: "team-project-eb57c.firebasestorage.app",
  messagingSenderId: "1043198581798",
  appId: "1:1043198581798:web:9b1daaf5199926d5a41ae7",
};

export const isFirebaseConfigured = !firebaseConfig.apiKey.startsWith("YOUR_");

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
