import { FontAwesome } from '@expo/vector-icons';
import React from 'react';
import { Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

interface JoinProjectModalProps {
    visible: boolean;
    onClose: () => void;
    projectCode: string;
    setProjectCode: (code: string) => void;
    onJoin: () => void;
}

export function JoinProjectModal({ visible, onClose, projectCode, setProjectCode, onJoin }: JoinProjectModalProps) {
    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.modalCenteredView}>
                <View style={styles.modalView}>
                    <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                        <FontAwesome name="close" size={22} color="#ccc" />
                    </TouchableOpacity>
                    <Text style={styles.modalTitle}>Entrar em um Projeto</Text>
                    <TextInput
                        style={styles.joinProjectInput}
                        placeholder="Cole a mensagem de convite aqui"
                        placeholderTextColor="#888"
                        value={projectCode}
                        onChangeText={setProjectCode}
                        multiline
                    />
                    <TouchableOpacity style={styles.addButton} onPress={onJoin}>
                        <Text style={styles.addButtonText}>Acessar Projeto</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalCenteredView: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.7)',
    },
    modalView: {
        margin: 20,
        backgroundColor: '#1A1D23',
        borderRadius: 20,
        padding: 35,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
        width: '90%',
    },
    joinProjectInput: {
        height: 60,
        width: '100%',
        backgroundColor: '#2A2E37',
        color: '#fff',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#ffffff1a',
        fontSize: 16,
        paddingHorizontal: 15,
        paddingVertical: 10,
        textAlignVertical: 'top',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: "bold",
        color: "#fff",
    },
    closeButton: {
        position: 'absolute',
        top: 20,
        right: 20,
    },
    addButton: {
        backgroundColor: '#1cb0f6',
        padding: 12,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
    },
    addButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 14,
    },
});
