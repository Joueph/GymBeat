
import { FontAwesome } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getFunctions, httpsCallable } from 'firebase/functions';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from './authprovider';

/**
 * Handles invite links and friend-code acceptance from deep-link parameters.
 * @returns Invite status screen for loading, success, and error states.
 */
export default function InviteScreen() {
    const { friendCode } = useLocalSearchParams<{ friendCode: string }>();
    const { user } = useAuth();
    const router = useRouter();
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        const processInvite = async () => {
            if (!user) {
                // Auth provider redirects to login if not authenticated, 
                // but just in case, we wait or redirect.
                // Actually, internal layout logic might redirect to /registro logic if !user.
                // We act assuming user is present or will be diverted.
                return;
            }

            if (!friendCode) {
                setStatus('error');
                setErrorMessage('Código de convite inválido ou ausente.');
                return;
            }

            if (friendCode.trim().toLowerCase() === user.email?.toLowerCase()) {
                setStatus('error');
                setErrorMessage("Você não pode aceitar seu próprio convite.");
                return;
            }

            try {
                const functions = getFunctions();
                const sendFriendRequestFn = httpsCallable(functions, 'sendFriendRequest');

                // Inverse logic: The link creator (friendCode) is the one we want to ADD.
                // So we are sending a request TO them? 
                // The `sendFriendRequest` function takes: { fromUserId, friendCode }
                // It finds the user by `friendCode` (email) and sends a request FROM `fromUserId`.
                // So: Current User (fromUserId) sends request TO Invite Creator (friendCode).

                await sendFriendRequestFn({
                    fromUserId: user.id,
                    friendCode: friendCode.trim(),
                });

                setStatus('success');
            } catch (error: any) {
                console.error("Erro ao processar convite:", error);
                // Handle "already friends" or other specific errors if needed
                setStatus('error');
                setErrorMessage(error.message || 'Falha ao enviar solicitação de amizade.');
            }
        };

        if (user && friendCode) {
            processInvite();
        } else if (!friendCode) {
            setStatus('error');
            setErrorMessage('Link de convite inválido.');
        }

    }, [user, friendCode]);

    const handleFinish = () => {
        // Redirect to Amigos tab
        router.replace('/(tabs)/amigos');
    };

    return (
        <View style={styles.container}>
            {status === 'loading' && (
                <>
                    <ActivityIndicator size="large" color="#1cb0f6" style={{ marginBottom: 20 }} />
                    <Text style={styles.text}>Processando convite...</Text>
                </>
            )}

            {status === 'success' && (
                <>
                    <FontAwesome name="check-circle" size={60} color="#4CAF50" style={{ marginBottom: 20 }} />
                    <Text style={styles.title}>Sucesso!</Text>
                    <Text style={styles.text}>Solicitação de amizade enviada.</Text>
                    <TouchableOpacity style={styles.button} onPress={handleFinish}>
                        <Text style={styles.buttonText}>Ir para Amigos</Text>
                    </TouchableOpacity>
                </>
            )}

            {status === 'error' && (
                <>
                    <FontAwesome name="exclamation-circle" size={60} color="#F44336" style={{ marginBottom: 20 }} />
                    <Text style={styles.title}>Ops!</Text>
                    <Text style={styles.text}>{errorMessage}</Text>
                    <TouchableOpacity style={styles.button} onPress={handleFinish}>
                        <Text style={styles.buttonText}>Voltar</Text>
                    </TouchableOpacity>
                </>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0B0D10',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 10,
    },
    text: {
        fontSize: 16,
        color: '#ccc',
        textAlign: 'center',
        marginBottom: 30,
    },
    button: {
        backgroundColor: '#1cb0f6',
        paddingVertical: 12,
        paddingHorizontal: 30,
        borderRadius: 8,
    },
    buttonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
});
