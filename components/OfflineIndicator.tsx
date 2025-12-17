import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNetwork } from '../app/networkprovider';

/**
 * Componente para exibir indicador de status offline
 */
export function OfflineIndicator() {
  const { isOnline } = useNetwork();

  if (isOnline) {
    return null; // Não mostra quando online
  }

  return (
    <View style={styles.container}>
      <View style={styles.indicator}>
        <Text style={styles.text}>🔴 Modo Offline</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#FFA500',
    alignItems: 'center',
    justifyContent: 'center',
  },
  indicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
