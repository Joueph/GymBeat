import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import React, { createContext, useContext, useEffect, useState } from 'react';

interface NetworkContextType {
  isOnline: boolean;
  netInfo: NetInfoState | null;
}

const NetworkContext = createContext<NetworkContextType>({
  isOnline: true,
  netInfo: null,
});

export function useNetwork() {
  return useContext(NetworkContext);
}

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [netInfo, setNetInfo] = useState<NetInfoState | null>(null);
  const [initialized, setInitialized] = useState(false); // Add initialized state

  useEffect(() => {
    // Inicialmente, verifica o estado da internet
    const checkInitialConnection = async () => {
      const state = await NetInfo.fetch();
      setNetInfo(state);
      setIsOnline(state.isConnected ?? true);
      setInitialized(true); // Mark as initialized after fetch
    };

    checkInitialConnection();

    // Monitora mudanças no estado da internet
    const unsubscribe = NetInfo.addEventListener((state) => {
      setNetInfo(state);
      const connected = state.isConnected ?? true;
      setIsOnline(connected);

      console.log(`[Network] Conexão: ${connected ? 'Online' : 'Offline'}`);
      if (state.type) {
        console.log(`[Network] Tipo: ${state.type}`);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  if (!initialized) {
    return null; // Or a splash screen/loading indicator if preferred, but null is safe for root layout
  }

  return (
    <NetworkContext.Provider value={{ isOnline, netInfo }}>
      {children}
    </NetworkContext.Provider>
  );
}
