import { FontAwesome, FontAwesome5 } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React, { useMemo } from 'react';
import { View } from 'react-native';
import { useAuth } from '../../app/authprovider';
import { HapticTab } from '../../components/haptic-tab';
import { OfflineIndicator } from '../../components/OfflineIndicator';

/**
 * Renders a FontAwesome tab icon with the app's bottom-tab sizing defaults.
 * @param props Icon name, color, and optional size passed by Expo Router tabs.
 * @returns FontAwesome icon element.
 */
function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color: string;
  size?: number;
}) {
  return (
    <FontAwesome size={props.size || 24} style={{ marginBottom: -3 }} {...props} />
  );
}

/**
 * Defines the main tab navigator and the social request badge.
 * @returns Tab layout containing progress, workouts, and social screens.
 */
export default function TabLayout() {
  const { user } = useAuth();

  const pendingRequestsCount = useMemo(() => {
    if (!user?.amizades) return 0;
    return Object.values(user.amizades).filter(status => status === false).length;
  }, [user?.amizades]);

  return (
    <View style={{ flex: 1 }}>
      <OfflineIndicator />
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
          tabBarStyle: { backgroundColor: '#1A1D23', borderTopColor: '#1F2937', paddingVertical: 15, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0 },
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
            tabBarIcon: ({ color }) => (
              <View>
                <TabBarIcon name="users" color={color} size={20} />
                {pendingRequestsCount > 0 && (
                  <View style={{
                    position: 'absolute',
                    right: -6,
                    top: -4,
                    backgroundColor: '#EF4444',
                    borderRadius: 6,
                    width: 10,
                    height: 10,
                    borderWidth: 1,
                    borderColor: '#1A1D23',
                  }} />
                )}
              </View>
            ),
          }}
        />
      </Tabs>
    </View>
  );
}
