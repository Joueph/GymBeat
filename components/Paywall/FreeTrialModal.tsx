import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface FreeTrialModalProps {
    visible: boolean;
    onRedeem: () => Promise<void>;
    isLoading?: boolean;
}

export function FreeTrialModal({ visible, onRedeem, isLoading = false }: FreeTrialModalProps) {
    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="slide"
            statusBarTranslucent={true}
        >
            <View style={styles.overlay}>
                <View style={styles.container}>
                    <View style={styles.content}>
                        <View style={styles.iconContainer}>
                            <Ionicons name="gift-outline" size={64} color="#00ffcc" />
                        </View>

                        <Text style={styles.title}>Presente de Boas-vindas!</Text>

                        <Text style={styles.description}>
                            Comece sua jornada com o pé direito com <Text style={styles.highlight}>14 dias totalmente grátis</Text> de acesso Premium.
                        </Text>

                        <View style={styles.featuresContainer}>
                            <FeatureItem text="Acesso ilimitado a todos os treinos" />
                            <FeatureItem text="Análises detalhadas de progresso" />
                            <FeatureItem text="Sem necessidade de cartão de crédito" />
                        </View>
                    </View>

                    <TouchableOpacity
                        style={[styles.button, isLoading && styles.buttonDisabled]}
                        onPress={onRedeem}
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <ActivityIndicator color="#000" />
                        ) : (
                            <Text style={styles.buttonText}>Resgatar 14 dias grátis</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

const FeatureItem = ({ text }: { text: string }) => (
    <View style={styles.featureItem}>
        <Ionicons name="checkmark-circle" size={20} color="#00ffcc" />
        <Text style={styles.featureText}>{text}</Text>
    </View>
);

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    container: {
        width: '100%',
        backgroundColor: '#1E1E1E',
        borderRadius: 24,
        padding: 24,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#333',
        maxWidth: 400,
    },
    content: {
        alignItems: 'center',
        marginBottom: 32,
    },
    iconContainer: {
        marginBottom: 24,
        backgroundColor: 'rgba(0, 255, 204, 0.1)',
        padding: 20,
        borderRadius: 50,
    },
    title: {
        color: '#fff',
        fontSize: 24,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 12,
    },
    description: {
        color: '#ccc',
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 32,
        lineHeight: 24,
    },
    highlight: {
        color: '#00ffcc',
        fontWeight: 'bold',
    },
    featuresContainer: {
        alignSelf: 'stretch',
        gap: 12,
    },
    featureItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    featureText: {
        color: '#eee',
        fontSize: 14,
    },
    button: {
        backgroundColor: '#00ffcc',
        width: '100%',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    buttonDisabled: {
        opacity: 0.7,
    },
    buttonText: {
        color: '#000',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
