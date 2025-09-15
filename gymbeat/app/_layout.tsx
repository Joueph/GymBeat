import { Stack, useRouter, useSegments } from "expo-router";
import AuthProvider, { useAuth } from "./authprovider";
import { useEffect } from "react";

const InitialLayout = () => {
  const { user, initialized } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!initialized) return;

    const inTabsGroup = segments[0] === "(tabs)";

    if (user && !inTabsGroup) {
      router.replace("/(tabs)");
    } else if (!user && inTabsGroup) {
      router.replace("/login");
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