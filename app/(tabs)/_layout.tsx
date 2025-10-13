import { FontAwesome } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { HapticTab } from '../../components/haptic-tab';

function TabBarIcon(props: { name: React.ComponentProps<typeof FontAwesome>['name']; color: string }) {
  return <FontAwesome size={24} style={{ marginBottom: -3 }} {...props} />;
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: '#141414', // This solid color simulates 5% white opacity over a dark background
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(255, 255, 255, 0.1)',
          elevation: 0,
        },
        headerTintColor: '#fff',
        tabBarStyle: { backgroundColor: '#141414', borderTopColor: 'rgba(255, 255, 255, 0.1)' },
        tabBarActiveTintColor: '#fff',
        tabBarButton: HapticTab,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          headerShown: false,
          tabBarIcon: ({ color }) => <TabBarIcon name="home" color={color} />,
        }}
      />
      <Tabs.Screen
        name="workouts"
        options={{
          title: "Treinos",
          tabBarIcon: ({ color }) => <TabBarIcon name="book" color={color} />,
        }}
      />
      <Tabs.Screen
        name="treinoHoje"
        options={{
          title: "Meus treinos",
          tabBarIcon: ({ color }) => <TabBarIcon name="fire" color={color} />,
        }}
      />
      <Tabs.Screen
        name="amigos"
        options={{
          title: "Social",
          tabBarIcon: ({ color }) => <TabBarIcon name="users" color={color} />,
        }}
      />
    </Tabs>
  );
}