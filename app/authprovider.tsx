// Em seu arquivo authprovider.tsx

import React, { createContext, useContext, useEffect, useState } from 'react';
// Certifique-se de que os imports do Firebase estão corretos para o seu projeto
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../firebaseconfig'; // Verifique o caminho para sua config do Firebase

// Definimos o tipo do nosso contexto de autenticação
interface AuthContextType {
  user: User | null;
  initialized: boolean; // O estado que está causando o problema
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
    // A função onAuthStateChanged é um "ouvinte". Ela é chamada uma vez
    // no início e depois toda vez que o usuário faz login ou logout.
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      // Após a primeira resposta do onAuthStateChanged (seja com um usuário ou nulo),
      // consideramos o processo de autenticação inicializado.
      // Isso garante que o estado 'initialized' seja definido como 'true' de forma confiável.
      setInitialized(true);
    });

    // Esta função de limpeza é importante para evitar memory leaks
    return () => unsubscribe();
  }, []); // O array de dependências vazio [] garante que este useEffect rode apenas uma vez quando o app inicia.

  const value = {
    user,
    initialized,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}