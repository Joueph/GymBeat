// firebase-test.js (versão CommonJS)
const { initializeApp } = require("firebase/app");
const { getAuth, createUserWithEmailAndPassword } = require("firebase/auth");

// mesmo config do firebaseconfig.js
const firebaseConfig = {
apiKey: "AIzaSyAZMqdWFOzqAznmHuGY94utC-uoa1ZgiVM",
  authDomain: "gymbeat-4c3ff.firebaseapp.com",
  projectId: "gymbeat-4c3ff",
  storageBucket: "gymbeat-4c3ff.firebasestorage.app",
  messagingSenderId: "418244836174",
  appId: "1:418244836174:web:9d9c3c58ec223301e5fc1f",
  measurementId: "G-QMKDM1HHCX"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

async function test() {
  try {
    const userCred = await createUserWithEmailAndPassword(
      auth,
      "testeuser@example.com",
      "123456"
    );
    console.log("✅ Usuário criado com sucesso:", userCred.user.email);
  } catch (error) {
    console.error("❌ Erro no Firebase:", error.code, error.message);
  }
}

test();
