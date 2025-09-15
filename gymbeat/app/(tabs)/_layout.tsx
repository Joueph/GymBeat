import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

import { Stack } from "expo-router";
import { useEffect, useState } from "react";
// Update the import path if your firebaseconfig file is located elsewhere, for example:
import { auth } from "../../firebaseconfig";
// Or create the file at ../firebaseconfig.ts and export 'auth' from it.
import { onAuthStateChanged } from "firebase/auth";

import { View, TouchableOpacity, ActivityIndicator } from "react-native";

function RootLayout() {
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsLoggedIn(!!user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{ headerShown: false }}
      initialRouteName={isLoggedIn ? "(tabs)/index" : "login"}
    />
  );
}

function CustomTabBarButton({ children, onPress }: any) {
  return (
    <TouchableOpacity
      style={{
        top: -20,
        justifyContent: "center",
        alignItems: "center",
      }}
      onPress={onPress}
    >
      <View
        style={{
          width: 70,
          height: 70,
          borderRadius: 35,
          backgroundColor: "#4CAF50",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        {children}
      </View>
    </TouchableOpacity>
  );
}

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="workouts" options={{ title: "Workouts" }} />
      <Tabs.Screen name="treinoHoje" options={{ title: "treinoHoje",}} />
      <Tabs.Screen name="amigos" options={{ title: "Amigos" }} />
      <Tabs.Screen name="perfil" options={{ title: "Perfil" }} />
    </Tabs>
  );
}