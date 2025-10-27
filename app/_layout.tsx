// Em app/_layout.tsx
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from "expo-av";
import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { AuthProvider, useAuth } from './authprovider'; // Verifique o caminho

// O componente que consome o contexto e faz a lógica de navegação
function MainNavigation() {
  const { user, initialized } = useAuth();
  const segments = useSegments();
  const router = useRouter();

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
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#141414' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: 'bold' },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="perfil" options={{ title: 'Meu Perfil', presentation: 'modal' }} />
        <Stack.Screen name="(treino)" options={{ headerShown: false }} />
        <Stack.Screen name="(projetos)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack>
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
  return (
    <AuthProvider>
      <MainNavigation />
    </AuthProvider>
  );
}

