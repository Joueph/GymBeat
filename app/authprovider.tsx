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
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  initialized: false,
  isOffline: false,
  logout: async () => { },
});

/**
 * Reads the current authenticated user session from AuthContext.
 * @returns Auth state, initialization state, offline state, and logout action.
 */
export function useAuth() {
  return useContext(AuthContext);
}

/**
 * Provides Firebase Auth, Firestore profile, and offline user-session cache state to the app.
 * @param children React subtree that needs authenticated user context.
 * @returns AuthContext provider wrapping the given children.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Usuario | null>(null);
  const [initialized, setInitialized] = useState(false);
  const { isOnline } = useNetwork();

  const logout = async () => {
    try {
      await clearUserSessionCache();
      await auth.signOut();
      setUser(null);
    } catch (e) {
      console.error('[Auth] Logout error:', e);
    }
  };

  useEffect(() => {
    let firestoreUnsubscribe: Unsubscribe | null = null;

    const authUnsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (firestoreUnsubscribe) {
        firestoreUnsubscribe();
      }

      if (!currentUser) {
        // Se não há usuário logado (firebase auth vazio),
        // NÃO limpamos o cache automaticamente para proteger sessões offline robustas.
        // Apenas verificamos se o usuário explicitamente pediu logout (já tratado em 'logout')
        // OU se estamos num estado onde o cache deve ser restaurado.

        // Tentamos recuperar dados em cache caso existam, pois pode ser um inicio offline
        try {
          const cachedUser = await getCachedUserSession();
          if (cachedUser) {
            console.log('[Auth] Restaurado usuário do cache (offline ou auth não inicializado)');
            setUser(cachedUser);
          } else {
            // Se não tem cache, realmente não tem usuário.
            setUser(null);
          }
        } catch (e) {
          console.error('[Auth] Erro ao tentar recuperar cache na inicialização:', e);
          setUser(null);
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
            };
            setUser(combinedUser);
            // Salva em cache para acesso offline
            await cacheUserSession(combinedUser);
          } else {
            const cachedUser = await getCachedUserSession();
            if (cachedUser && cachedUser.id === currentUser.uid) {
              console.log('[Auth] Documento remoto ausente; mantendo sessão em cache.');
              setUser(cachedUser);
            } else {
              setUser(null);
            }
          }
        },
        async (error) => {
          console.error("Erro no ouvinte do Firestore (authprovider):", error);
          // Se há erro (offline ou permissão), tenta usar dados em cache
          // NÃO checamos isOnline aqui, pois o erro no Firestore já indica problema de acesso
          try {
            const cachedUser = await getCachedUserSession();
            if (cachedUser && cachedUser.id === currentUser.uid) {
              setUser(cachedUser);
              console.log('[Auth] Usando usuário em cache devido a erro de conexão/firestore');
            } else {
              console.warn('[Auth] Erro no Firestore e cache vazio ou incompatível.');
              setUser(null);
            }
          } catch (e) {
            console.error('[Auth] Erro ao recuperar cache:', e);
            setUser(null);
          } finally {
            setInitialized(true);
          }
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

  // NOVO: Persistência redundante. Sempre que o usuário muda (e existe), atualizamos o cache.
  // Isso garante que se o login ocorrer e o snapshot não disparar o salvamento por algum motivo,
  // ou se houver qualquer atualização de estado, o cache esteja sincronizado.
  useEffect(() => {
    if (user) {
      cacheUserSession(user).catch(err => console.error('[Auth] Erro ao salvar sessão redundante:', err));
    }
  }, [user]);

  const value = {
    user,
    initialized,
    isOffline: !isOnline,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
