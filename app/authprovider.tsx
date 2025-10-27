// Em seu arquivo authprovider.tsx

import { onAuthStateChanged, User } from 'firebase/auth';
import React, { createContext, useContext, useEffect, useState } from 'react';
// ADICIONAR IMPORTS DO FIRESTORE
import { doc, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { auth, db } from '../firebaseconfig'; // Verifique o caminho

// Definimos o tipo do nosso contexto de autenticação
interface AuthContextType {
  user: User | null;
  initialized: boolean;
}

// Criamos o contexto com valores iniciais
const AuthContext = createContext<AuthContextType>({
  user: null,
  initialized: false,
});

// Hook customizado para facilitar o uso do contexto
export function useAuth() {
  return useContext(AuthContext);
}

// O componente Provider que vai envolver seu app
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    let firestoreUnsubscribe: Unsubscribe | null = null;

    // O ouvinte do Auth é o primeiro a disparar
    const authUnsubscribe = onAuthStateChanged(auth, (currentUser) => {
      
      // Se um ouvinte do Firestore da sessão anterior existir, cancele-o
      if (firestoreUnsubscribe) {
        firestoreUnsubscribe();
      }

      // Se o usuário fez logout (currentUser é nulo)
      if (!currentUser) {
        setUser(null);
        setInitialized(true);
        return;
      }

      // Se o usuário está logado (anônimo OU permanente)
      // Agora verificamos se o documento DELE existe no Firestore
      const userDocRef = doc(db, 'users', currentUser.uid);

      // Crie um novo ouvinte em tempo real para o documento do usuário
      firestoreUnsubscribe = onSnapshot(
        userDocRef,
        (docSnap) => {
          // Agora que ouvimos do Auth E do Firestore, o app está inicializado
          setInitialized(true);
          
          if (docSnap.exists()) {
            // O DOCUMENTO EXISTE: O usuário está totalmente registrado.
            // Definimos o usuário no contexto, o que acionará
            // o _layout.tsx para redirecionar para (tabs).
            setUser(currentUser);
          } else {
            // O DOCUMENTO NÃO EXISTE: O usuário está no meio do onboarding (anônimo)
            // ou algo deu errado.
            // Tratamos ele como 'null' para mantê-lo nas telas de (auth).
            setUser(null);
          }
        },
        (error) => {
          // Em caso de erro lendo o Firestore
          console.error("Erro no ouvinte do Firestore (authprovider):", error);
          setUser(null);
          setInitialized(true);
        }
      );
    });

    // Função de limpeza principal
    return () => {
      authUnsubscribe(); // Limpa o ouvinte do Auth
      if (firestoreUnsubscribe) {
        firestoreUnsubscribe(); // Limpa o ouvinte do Firestore
      }
    };
  }, []); // O array de dependências vazio [] garante que este useEffect rode apenas uma vez

  const value = {
    user,
    initialized,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}