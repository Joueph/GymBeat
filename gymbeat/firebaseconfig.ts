// firebaseconfig.ts
import { initializeApp } from "firebase/app";
import {
  initializeAuth,
  getAuth,
  Auth
} from "firebase/auth";
import { getReactNativePersistence } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Coloque as configs do seu projeto Firebase aqui
const firebaseConfig = {
  apiKey: "AIzaSyAZMqdWFOzqAznmHuGY94utC-uoa1ZgiVM",
  authDomain: "gymbeat-4c3ff.firebaseapp.com",
  projectId: "gymbeat-4c3ff",
  storageBucket: "gymbeat-4c3ff.firebasestorage.app",
  messagingSenderId: "418244836174",
  appId: "1:418244836174:web:9d9c3c58ec223301e5fc1f",
  measurementId: "G-QMKDM1HHCX"
};

// Inicializa o app
const app = initializeApp(firebaseConfig);

// Inicializa o auth com persistência no AsyncStorage
let auth: Auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch (e) {
  // Se já foi inicializado em algum reload, apenas pega a instância
  auth = getAuth(app);
}

export { app, auth };