import { Stack } from "expo-router";
import AuthProvider from "./authprovider";
import { Tabs } from "expo-router";

export default function RootLayout() {
  return (
    <AuthProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </AuthProvider>
  );
}
