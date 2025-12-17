// Em app/_layout.tsx
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from "expo-av";
import * as Notifications from 'expo-notifications';
import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { MenuProvider } from 'react-native-popup-menu';
import { processQueue } from '../services/synchronizationService';
import { AuthProvider, useAuth } from './authprovider'; // Verifique o caminho
import { useNetwork } from './networkprovider';

// Configuração inicial para o comportamento das notificações
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true, // Plays a sound when the notification is received
    shouldSetBadge: true, // Sets the badge number on the app icon
    shouldShowBanner: true, // (iOS) Show the notification as a banner
    shouldShowList: true, // (iOS) Show the notification in the notification list
  }),
});

// O componente que consome o contexto e faz a lógica de navegação
function MainNavigation() {
  const { user, initialized } = useAuth();
  const { isOnline } = useNetwork();
  const segments = useSegments();
  const router = useRouter();

  // Sincroniza operações offline quando volta online
  useEffect(() => {
    if (isOnline && user) {
      const attemptSync = async () => {
        try {
          // Usa o novo serviço de sincronização
          await processQueue();
        } catch (error) {
          console.error('[Sync] Erro ao sincronizar:', error);
        }
      };

      attemptSync();
    }
  }, [isOnline, user]);

  useEffect(() => {
    if (!initialized) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (user && inAuthGroup) {
      // CORREÇÃO: Redireciona para o layout de tabs
      router.replace('/(tabs)');
    } else if (!user && !inAuthGroup) {
      router.replace('/(auth)/registro'); // Verifique sua rota de login
    }
  }, [user, initialized, segments, router]);

  // Enquanto não estiver inicializado, não mostre nada.
  // Isso evita "piscar" a tela.
  if (!initialized) {
    return null;
  }

  // Retorna a estrutura de navegação principal
  return (
    <MenuProvider>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#141414' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: 'bold' },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="FeatureUpvoteModal" options={{ title: 'FeatureUpvoteModal', presentation: 'modal' }} />
        <Stack.Screen name="SuggestFeatureModal" options={{ title: 'SuggestFeatureModal', presentation: 'modal' }} />
        <Stack.Screen name="perfil" options={{ title: 'Meu Perfil', presentation: 'modal' }} />
        <Stack.Screen name="settings" options={{ title: 'Configurações', presentation: 'modal' }} />
        <Stack.Screen name="(treino)" options={{ headerShown: false }} />
        <Stack.Screen name="(projetos)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack>
    </MenuProvider>
  );
}


// O layout raiz que apenas fornece o contexto
export default function RootLayout() {
  useEffect(() => {
    // Configura o modo de áudio do app para não interromper a música de outros apps.
    const setAudioMode = async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          allowsRecordingIOS: false,
          interruptionModeIOS: InterruptionModeIOS.MixWithOthers,
          interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
          shouldDuckAndroid: true,
          staysActiveInBackground: false,
        });
      } catch (e) {
        console.error('Falha ao configurar o modo de áudio', e);
      }
    };
    setAudioMode();
  }, []);

  // Listener para notificações recebidas enquanto o app está em primeiro plano
  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener(notification => {
      console.log('[Notifications] Notificação recebida:', {
        id: notification.request.identifier,
        title: notification.request.content.title,
        body: notification.request.content.body,
      });
    });

    // Listener para quando o usuário interage com a notificação
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('[Notifications] Usuário interagiu com notificação:', {
        id: response.notification.request.identifier,
      });
    });

    return () => {
      subscription.remove();
      responseSubscription.remove();
    };
  }, []);

  return (
    <AuthProvider>
      <MainNavigation />
    </AuthProvider>
  );
}

