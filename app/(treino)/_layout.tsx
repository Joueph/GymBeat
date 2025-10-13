import { Stack } from 'expo-router';
import React from 'react';

export default function TreinoLayout() {
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
        // A propriedade 'headerBackTitleVisible' não existe neste contexto, causando um erro de tipo.
        // A forma correta de ocultar o texto do botão de voltar é definir 'headerBackTitle' como uma string vazia.
        // Isso mantém o ícone (chevron) visível, mas remove o texto ao lado dele.
        headerBackTitle: '',
      }}
    >
      <Stack.Screen
        name="criatFicha"
        options={{
          title: 'Editar Ficha',
        }}
      />
      <Stack.Screen
        name="editarTreino"
        options={{
          // O título será dinâmico, então podemos deixar um padrão ou remover.
          // Para manter a consistência, vamos deixar o título que já estava.
          title: 'Editar Treino',
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

      {/* >>> ADICIONE A TELA QUE ESTÁ CAUSANDO O PROBLEMA AQUI <<<
        Para a tela que está mostrando "(treino)" como título, encontre
        o nome do arquivo .tsx correspondente e adicione uma entrada
        para ela aqui com a opção 'headerShown: false'.
      */}
      {/* Exemplo para um arquivo chamado 'minhaTelaDeTreino.tsx':
      <Stack.Screen
        name="minhaTelaDeTreino" 
        options={{
          headerShown: false,
        }}
      />
      */}

    </Stack>
  );
}
