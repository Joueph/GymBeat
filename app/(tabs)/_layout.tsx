import { FontAwesome, FontAwesome5 } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { HapticTab } from '../../components/haptic-tab';

function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color: string;
  size?: number;
}) {
  return (
    <FontAwesome size={props.size || 24} style={{ marginBottom: -3 }} {...props} />
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: '#1A1D23', // This solid color simulates 5% white opacity over a dark background
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(255, 255, 255, 0.1)',
          elevation: 0,
        },
        headerTintColor: '#fff',
        tabBarStyle: { backgroundColor: '#1A1D23', borderTopColor: '#1F2937',paddingVertical:15, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0},
        tabBarActiveTintColor: '#fff',
        tabBarButton: HapticTab,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Progresso",
          headerShown: false,
          tabBarIcon: ({ color }) => <FontAwesome5 name="chart-line" size={20} color={color} style={{ marginBottom: -3 }} />,
        }}
      />
      <Tabs.Screen
        name="treinoHoje"
        options={{
          title: "Treinos",
          headerShown: false,
          tabBarIcon: ({ color }) => <FontAwesome5 name="dumbbell" size={20} color={color} style={{ marginBottom: -3 }} />,
        }}
      />
      <Tabs.Screen
        name="amigos"
        options={{
          title: "Social",
          headerShown: false,
          tabBarIcon: ({ color }) => <TabBarIcon name="users" color={color} size={20}  />,
        }}
      />
    </Tabs>
  );
}