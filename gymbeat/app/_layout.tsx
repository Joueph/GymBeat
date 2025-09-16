import { Stack, useRouter, useSegments } from "expo-router";
import AuthProvider, { useAuth } from "./authprovider";
import { useEffect } from "react";

const InitialLayout = () => {
  const { user, initialized } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!initialized) return;

    const inAuthGroup = segments[0] === 'login' || segments[0] === 'cadastro';
    
    // Se o usuário está logado, mas está tentando acessar uma tela de autenticação,
    // redirecione-o para a tela principal do aplicativo.
    if (user && inAuthGroup) {
      router.replace('/(tabs)');
    // Se o usuário NÃO está logado e NÃO está em uma tela de autenticação,
    // redirecione-o para a tela de login.
    } else if (!user && !inAuthGroup) {
      router.replace('/login');
    }
  }, [user, initialized, segments, router]);

  return <Stack screenOptions={{ headerShown: false }} />;
};

export default function RootLayout() {
  return (
    <AuthProvider>
      <InitialLayout />
    </AuthProvider>
  );
}