import { Tabs } from 'expo-router';
import React from 'react';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="workouts" options={{ title: "Workouts" }} />
      <Tabs.Screen name="treinoHoje" options={{ title: "treinoHoje" }} />
      <Tabs.Screen name="amigos" options={{ title: "Amigos" }} />
      <Tabs.Screen name="perfil" options={{ title: "Perfil" }} />
    </Tabs>
  );
}