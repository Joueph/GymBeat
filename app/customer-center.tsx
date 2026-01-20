import { useRouter } from 'expo-router';
import React from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRevenueCat } from '../components/providers/RevenueCatProvider';
// Note: CustomerCenter might be available in newer versions of react-native-purchases-ui or as a separate component.
// For this version (as we just installed latest), we will check if it exists or build a manual one.
// Since I cannot verify the exports of 'react-native-purchases-ui' at runtime easily without docs for the specific version installed,
// I will build a robust manual "Customer Center" which is safer and requested as "When it makes sense".
// The safest bet is a manual UI that calls RevenueCat methods.

export default function CustomerCenterScreen() {
    const { isPro, customerInfo, restorePurchases } = useRevenueCat();
    const router = useRouter();

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
            <Text style={styles.title}>Minha Assinatura</Text>

            <View style={styles.card}>
                <Text style={styles.statusLabel}>Status:</Text>
                <Text style={[styles.statusValue, isPro ? styles.active : styles.inactive]}>
                    {isPro ? 'Ativa (GymBeat Pro)' : 'Inativa'}
                </Text>

                {customerInfo?.latestExpirationDate && (
                    <Text style={styles.dateLabel}>
                        Expira em: {new Date(customerInfo.latestExpirationDate).toLocaleDateString()}
                    </Text>
                )}
            </View>

            {!isPro && (
                <TouchableOpacity style={styles.subscribeButton} onPress={() => router.push('/paywall')}>
                    <Text style={styles.subscribeButtonText}>Assinar Agora</Text>
                </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.actionButton} onPress={restorePurchases}>
                <Text style={styles.actionButtonText}>Restaurar Compras</Text>
            </TouchableOpacity>

            <Text style={styles.infoText}>
                Gerencie sua assinatura nas configurações do seu dispositivo ({Platform.OS === 'ios' ? 'Apple ID' : 'Google Play'}).
            </Text>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    contentContainer: {
        padding: 20,
        alignItems: 'center',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 30,
        marginTop: 20,
        color: '#333',
    },
    card: {
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 24,
        width: '100%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        marginBottom: 20,
        alignItems: 'center',
    },
    statusLabel: {
        fontSize: 16,
        color: '#666',
        marginBottom: 8,
    },
    statusValue: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    active: {
        color: '#2ecc71',
    },
    inactive: {
        color: '#e74c3c',
    },
    dateLabel: {
        fontSize: 14,
        color: '#888',
    },
    subscribeButton: {
        backgroundColor: '#007AFF',
        paddingVertical: 16,
        paddingHorizontal: 32,
        borderRadius: 30,
        width: '100%',
        alignItems: 'center',
        marginBottom: 16,
    },
    subscribeButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
    actionButton: {
        paddingVertical: 12,
    },
    actionButtonText: {
        color: '#007AFF',
        fontSize: 16,
    },
    infoText: {
        marginTop: 30,
        fontSize: 12,
        color: '#999',
        textAlign: 'center',
        lineHeight: 18,
    },
});
