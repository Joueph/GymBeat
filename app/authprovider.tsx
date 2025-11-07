// Em seu arquivo authprovider.tsx

import { onAuthStateChanged, User } from 'firebase/auth';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { doc, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { auth, db } from '../firebaseconfig';
import { Usuario } from '../models/usuario'; // Import custom Usuario type

interface AuthContextType {
  user: Usuario | null;
  initialized: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  initialized: false,
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Usuario | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    let firestoreUnsubscribe: Unsubscribe | null = null;

    const authUnsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (firestoreUnsubscribe) {
        firestoreUnsubscribe();
      }

      if (!currentUser) {
        setUser(null);
        setInitialized(true);
        return;
      }

      const userDocRef = doc(db, 'users', currentUser.uid);

      firestoreUnsubscribe = onSnapshot(
        userDocRef,
        (docSnap) => {
          setInitialized(true);
          
          if (docSnap.exists()) {
            const userData = docSnap.data() as Omit<Usuario, 'id'>;
            const combinedUser: Usuario = {
              id: currentUser.uid,
              email: currentUser.email || userData.email, // Prioritize auth email
              nome: userData.nome || currentUser.displayName || 'Usuário',
              photoURL: userData.photoURL || currentUser.photoURL,
              // Map other properties from userData to combinedUser
              settings: userData.settings,
              nome_lowercase: userData.nome_lowercase,
              dataNascimento: userData.dataNascimento,
              altura: userData.altura,
              peso: userData.peso,
              genero: userData.genero,
              nivel: userData.nivel,
              fichas: userData.fichas,
              objetivoPrincipal: userData.objetivoPrincipal,
              localTreino: userData.localTreino,
              possuiEquipamentosCasa: userData.possuiEquipamentosCasa,
              problemasParaTreinar: userData.problemasParaTreinar,
              amizades: userData.amizades,
              solicitacoesRecebidas: userData.solicitacoesRecebidas,
              projetos: userData.projetos,
              lastTrained: userData.lastTrained,
              isPro: userData.isPro,
              hasTrainedToday: userData.hasTrainedToday,
              streakGoal: userData.streakGoal,
              weeksStreakGoal: userData.weeksStreakGoal,
              workoutScreenType: userData.workoutScreenType,
            };
            setUser(combinedUser);
          } else {
            setUser(null);
          }
        },
        (error) => {
          console.error("Erro no ouvinte do Firestore (authprovider):", error);
          setUser(null);
          setInitialized(true);
        }
      );
    });

    return () => {
      authUnsubscribe();
      if (firestoreUnsubscribe) {
        firestoreUnsubscribe();
      }
    };
  }, []);

  const value = {
    user,
    initialized,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}