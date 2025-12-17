// Em seu arquivo authprovider.tsx

import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot, Unsubscribe } from 'firebase/firestore';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../firebaseconfig';
import { Usuario } from '../models/usuario'; // Import custom Usuario type
import { cacheUserSession, clearUserSessionCache, getCachedUserSession } from '../services/offlineCacheService';
import { useNetwork } from './networkprovider';

interface AuthContextType {
  user: Usuario | null;
  initialized: boolean;
  isOffline: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  initialized: false,
  isOffline: false,
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Usuario | null>(null);
  const [initialized, setInitialized] = useState(false);
  const { isOnline } = useNetwork();

  useEffect(() => {
    let firestoreUnsubscribe: Unsubscribe | null = null;

    const authUnsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (firestoreUnsubscribe) {
        firestoreUnsubscribe();
      }

      if (!currentUser) {
        // Se não há usuário logado, tenta recuperar dados em cache
        if (!isOnline) {
          const cachedUser = await getCachedUserSession();
          setUser(cachedUser);
          console.log('[Auth] Restaurado usuário do cache (offline)');
        } else {
          setUser(null);
          await clearUserSessionCache();
        }
        setInitialized(true);
        return;
      }

      const userDocRef = doc(db, 'users', currentUser.uid);

      firestoreUnsubscribe = onSnapshot(
        userDocRef,
        async (docSnap) => {
          setInitialized(true);
          
          if (docSnap.exists()) {
            const userData = docSnap.data() as Omit<Usuario, 'id'>;
            const combinedUser: Usuario = {
              id: currentUser.uid,
              email: currentUser.email || userData.email, // Prioritize auth email
              nome: userData.nome || currentUser.displayName || 'Usuário',
              photoURL: userData.photoURL || currentUser.photoURL || undefined,
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
              uid: function (uid: any): unknown {
                throw new Error('Function not implemented.');
              }
            };
            setUser(combinedUser);
            // Salva em cache para acesso offline
            await cacheUserSession(combinedUser);
          } else {
            setUser(null);
          }
        },
        (error) => {
          console.error("Erro no ouvinte do Firestore (authprovider):", error);
          // Se há erro, tenta usar dados em cache
          if (!isOnline) {
            getCachedUserSession().then(cachedUser => {
              setUser(cachedUser);
              console.log('[Auth] Usando usuário em cache devido a erro de conexão');
            });
          } else {
            setUser(null);
          }
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
  }, [isOnline]);

  const value = {
    user,
    initialized,
    isOffline: !isOnline,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}