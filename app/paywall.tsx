import { useRouter } from 'expo-router';
import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { CustomerInfo } from 'react-native-purchases';
import RevenueCatUI from 'react-native-purchases-ui';
import { useRevenueCat } from '../components/providers/RevenueCatProvider';

export default function PaywallScreen() {
    const { isLoaded, isPro } = useRevenueCat();
    const router = useRouter();

    if (!isLoaded) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#0000ff" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <RevenueCatUI.Paywall
                onPurchaseCompleted={({ customerInfo }: { customerInfo: CustomerInfo }) => {
                    if (customerInfo.entitlements.active['GymBeat Pro']) {
                        router.back();
                    }
                }}
                onRestoreCompleted={({ customerInfo }: { customerInfo: CustomerInfo }) => {
                    if (customerInfo.entitlements.active['GymBeat Pro']) {
                        router.back();
                    } else {
                        // Optional: alert user nothing to restore
                    }
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
