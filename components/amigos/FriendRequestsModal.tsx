import { FontAwesome } from '@expo/vector-icons';
import React from 'react';
import {
    FlatList,
    Image,
    Modal,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { Usuario } from '../../models/usuario';

interface FriendRequestsModalProps {
    visible: boolean;
    onClose: () => void;
    requests: Usuario[];
    onAccept: (requesterId: string) => Promise<void>;
    onReject: (requesterId: string) => Promise<void>;
}

export function FriendRequestsModal({
    visible,
    onClose,
    requests,
    onAccept,
    onReject
}: FriendRequestsModalProps) {

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
                        <Text style={styles.modalTitle}>Notificações</Text>
                        <TouchableOpacity onPress={onClose}>
                            <FontAwesome name="close" size={24} color="#fff" />
                        </TouchableOpacity>
                    </View>

                    <FlatList
                        data={requests}
                        keyExtractor={(item) => item.id}
                        renderItem={({ item }) => (
                            <View style={styles.notificationItem}>
                                <View style={styles.notificationUserInfo}>
                                    {item.photoURL ? (
                                        <Image source={{ uri: item.photoURL }} style={styles.notificationPfp} />
                                    ) : (
                                        <View style={styles.notificationPfpPlaceholder}>
                                            <FontAwesome name="user" size={20} color="#555" />
                                        </View>
                                    )}
                                    <View>
                                        <Text style={styles.notificationName}>{item.nome}</Text>
                                        <Text style={styles.notificationText}>enviou um pedido de amizade.</Text>
                                    </View>
                                </View>
                                <View style={styles.notificationActions}>
                                    <TouchableOpacity style={[styles.notificationButton, styles.acceptButton]} onPress={() => onAccept(item.id)}>
                                        <Text style={styles.notificationButtonText}>Aceitar</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={[styles.notificationButton, styles.rejectButton]} onPress={() => onReject(item.id)}>
                                        <Text style={styles.notificationButtonText}>Recusar</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}
                        ListEmptyComponent={
                            <View style={styles.centered}>
                                <Text style={styles.emptyText}>Nenhuma notificação nova.</Text>
                            </View>
                        }
                    />
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
    notificationItem: {
        backgroundColor: '#1A1D23',
        borderRadius: 12,
        padding: 15,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#ffffff1a',
    },
    notificationUserInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 15,
    },
    notificationPfp: {
        width: 40,
        height: 40,
        borderRadius: 20,
        marginRight: 12,
    },
    notificationPfpPlaceholder: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#2c2c2e',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    notificationName: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
    notificationText: {
        color: '#ccc',
        fontSize: 14,
    },
    notificationActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 10,
    },
    notificationButton: {
        paddingVertical: 8,
        paddingHorizontal: 20,
        borderRadius: 8,
    },
    acceptButton: {
        backgroundColor: '#1cb0f6',
    },
    rejectButton: {
        backgroundColor: '#333',
    },
    notificationButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 14,
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        marginTop: 50,
    },
    emptyText: {
        color: '#aaa',
        fontSize: 16,
        textAlign: 'center',
    },
});
