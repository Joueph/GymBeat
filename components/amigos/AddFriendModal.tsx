import { FontAwesome } from '@expo/vector-icons';
import { getFunctions, httpsCallable } from 'firebase/functions';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { Usuario } from '../../models/usuario';

interface AddFriendModalProps {
    visible: boolean;
    onClose: () => void;
    user: Usuario | null;
}

export function AddFriendModal({ visible, onClose, user }: AddFriendModalProps) {
    const [friendCode, setFriendCode] = useState('');
    const [loading, setLoading] = useState(false);

    const handleFriendCodeChange = (text: string) => {
        const match = text.match(/\{([^}]+)\}/);
        setFriendCode(match ? match[1] : text);
    };

    const handleAddFriend = async () => {
        if (!user || !friendCode.trim()) {
            Alert.alert("Código Inválido", "Por favor, insira um código de amigo.");
            return;
        }

        if (friendCode.trim().toLowerCase() === user.email?.toLowerCase()) {
            Alert.alert("Ops!", "Você não pode adicionar a si mesmo como amigo.");
            return;
        }

        setLoading(true);
        try {
            const functions = getFunctions();
            const sendFriendRequestCallable = httpsCallable(functions, 'sendFriendRequest');

            await sendFriendRequestCallable({
                fromUserId: user.id,
                friendCode: friendCode.trim(),
            });

            Alert.alert("Sucesso", "Pedido de amizade enviado!");
            setFriendCode('');
            onClose();
        } catch (error: any) {
            console.error("Erro ao enviar pedido de amizade:", error);
            Alert.alert("Erro", error.message || "Não foi possível enviar o pedido de amizade.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            animationType="slide"
            visible={visible}
            onRequestClose={onClose}
            presentationStyle="pageSheet"
        >
            <SafeAreaView style={styles.modalSafeArea}>
                <View style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Adicionar Amigo</Text>
                        <TouchableOpacity onPress={onClose}>
                            <FontAwesome name="close" size={24} color="#fff" />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.addSection}>
                        <Text style={styles.sectionTitle}>Adicionar por código</Text>
                        <View style={styles.inputContainer}>
                            <TextInput
                                style={styles.input}
                                placeholder="Digite o código do amigo"
                                placeholderTextColor="#888"
                                value={friendCode}
                                onChangeText={handleFriendCodeChange}
                                autoCapitalize="none"
                            />
                            <TouchableOpacity
                                style={[styles.addButton, { width: 'auto', marginLeft: 10, paddingHorizontal: 15 }]}
                                onPress={handleAddFriend}
                                disabled={loading}
                            >
                                {loading ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Text style={styles.addButtonText}>Adicionar</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.shareSection}>
                        <Text style={styles.sectionTitle}>Meu código de amigo</Text>
                        <Text style={styles.friendCodeText}>{user?.email}</Text>
                        {/* Share button removed as it is now in the main header */}
                    </View>
                </View>
            </SafeAreaView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalSafeArea: {
        flex: 1,
        backgroundColor: "#141414",
    },
    modalContainer: {
        flex: 1,
        padding: 20,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: "bold",
        color: "#fff",
    },
    addSection: {
        marginBottom: 30,
    },
    sectionTitle: {
        color: '#ccc',
        fontSize: 16,
        marginBottom: 10,
    },
    inputContainer: {
        flexDirection: 'row',
    },
    input: {
        flex: 1,
        backgroundColor: '#2A2E37',
        color: '#fff',
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
    },
    addButton: {
        backgroundColor: '#1cb0f6',
        padding: 12,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    addButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 14,
    },
    divider: {
        height: 1,
        backgroundColor: '#ffffff1a',
        marginVertical: 20,
    },
    shareSection: {
        alignItems: 'center',
    },
    friendCodeText: {
        backgroundColor: '#2A2E37',
        color: '#fff',
        fontSize: 14,
        padding: 15,
        borderRadius: 8,
        textAlign: 'center',
        fontFamily: 'monospace',
        marginBottom: 20,
        width: '100%',
    },
});
