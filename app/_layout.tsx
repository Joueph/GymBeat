// Em app/_layout.tsx
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
      router.replace('/');
    } else if (!user && !inAuthGroup) {
      router.replace('/(auth)/login'); // Verifique sua rota de login
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
  return (
    <AuthProvider>
      <MainNavigation />
    </AuthProvider>
  );
}