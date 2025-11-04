import { Stack } from 'expo-router';
import React from 'react';

export default function ProjetosLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: '#141414',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        headerBackTitle: '',
      }}
    >
      <Stack.Screen name="[id]" options={{ title: 'Detalhes do Projeto' }} />
      
      {/* MUDANÇA AQUI: Alterado para 'transparentModal' e 'headerShown: false' */}
      <Stack.Screen 
        name="criar" 
        options={{ 
          title: 'Novo Projeto', 
          presentation: 'transparentModal', 
          headerShown: false 
        }} 
      />
    </Stack>
  );
}