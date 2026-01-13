import { Ficha } from '@/models/ficha';
import { FontAwesome, Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, FlatList, Modal, StyleSheet, Text, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';

type FichaSelectionDrawerProps = {
    visible: boolean;
    onClose: () => void;
    onSelect: (fichaId: string) => void;
    fichas: Ficha[];
    loading?: boolean;
};

export const FichaSelectionDrawer: React.FC<FichaSelectionDrawerProps> = ({ visible, onClose, onSelect, fichas, loading }) => {
    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <TouchableWithoutFeedback onPress={onClose}>
                <View style={styles.modalOverlay} />
            </TouchableWithoutFeedback>

            <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                    <View style={styles.modalHandle} />
                    <Text style={styles.modalTitle}>Onde deseja salvar?</Text>
                </View>

                {loading ? <ActivityIndicator color="#fff" style={{ marginTop: 20 }} /> : (
                    <FlatList
                        data={[
                            { id: 'unassigned', nome: 'Meus Treinos (Avulsos)' } as Ficha,
                            ...fichas
                        ]}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={{ paddingBottom: 40 }}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={styles.fichaOption}
                                onPress={() => onSelect(item.id === 'unassigned' ? 'unassigned' : item.id)}
                            >
                                <View style={styles.iconContainer}>
                                    <FontAwesome name={item.id === 'unassigned' ? "list-ul" : "folder"} size={20} color="#fff" />
                                </View>
                                <Text style={styles.fichaOptionText}>{item.nome}</Text>
                                <Ionicons name="chevron-forward" size={20} color="#666" />
                            </TouchableOpacity>
                        )}
                        style={{ width: '100%' }}
                    />
                )}

                <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                    <Text style={styles.cancelButtonText}>Cancelar</Text>
                </TouchableOpacity>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
    },
    modalContent: {
        backgroundColor: '#1A1D23',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
        paddingBottom: 40,
        height: '50%', // Half screen
        position: 'absolute',
        bottom: 0,
        width: '100%',
        borderTopWidth: 1,
        borderTopColor: '#333',
    },
    modalHeader: {
        alignItems: 'center',
        marginBottom: 20,
    },
    modalHandle: {
        width: 40,
        height: 4,
        backgroundColor: '#444',
        borderRadius: 2,
        marginBottom: 15,
    },
    modalTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    fichaOption: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#262A32',
        padding: 16,
        borderRadius: 12,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#333',
    },
    iconContainer: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#3B82F6',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    fichaOptionText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        flex: 1,
    },
    cancelButton: {
        marginTop: 15,
        padding: 15,
        alignItems: 'center',
        width: '100%',
    },
    cancelButtonText: {
        color: '#FF453A',
        fontSize: 16,
        fontWeight: '600',
    },
});
