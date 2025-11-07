import { Stack } from 'expo-router';
import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { MenuProvider } from 'react-native-popup-menu';

export default function TreinoLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <MenuProvider>
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
          }}>
          <Stack.Screen
            name="criatFicha"
            options={{
              title: 'Editar Ficha',
            }}
          />
          <Stack.Screen
            name="editarTreino"
            options={{
              presentation: 'modal',
              headerShown: false,
              animation: 'slide_from_bottom',
            }}
          />
          <Stack.Screen
            name="modals/OpcoesTreino"
            options={{
              presentation: 'modal',
              headerShown: false,
              animation: 'slide_from_bottom',
            }}
          />
          <Stack.Screen
            name="ongoingWorkout"
            options={{
              headerShown: false,
            }}
          />

          <Stack.Screen
            name="treinoCompleto"
            options={{
              headerShown: false,
            }}
          />

          <Stack.Screen
            name="LoggingDuringWorkout"
            options={{
              animation: 'slide_from_bottom', // Animação de entrada
              headerShown: false,
              animationDuration: 400, // Duração da animação
            }}
          />

          <Stack.Screen
            name="workouts"
            options={{
              title: 'Planos de Treino',
              headerBackTitle: 'Voltar',
            }}
          />
        </Stack>
      </MenuProvider>
    </GestureHandlerRootView>
  );
}