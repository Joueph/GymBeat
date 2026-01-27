import { FontAwesome } from '@expo/vector-icons';
import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface AddOptionsModalProps {
    visible: boolean;
    onClose: () => void;
    onCreateProject: () => void;
    onJoinProject: () => void;
}

export function AddOptionsModal({ visible, onClose, onCreateProject, onJoinProject }: AddOptionsModalProps) {
    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            onRequestClose={onClose}
        >
            <TouchableOpacity style={styles.modalBackdrop} onPress={onClose}>
                <View style={styles.drawerContainer}>
                    <TouchableOpacity style={styles.drawerOption} onPress={onCreateProject}>
                        <FontAwesome name="plus-circle" size={20} color="#fff" />
                        <Text style={styles.drawerOptionText}>Criar um novo projeto</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.drawerOption} onPress={onJoinProject}>
                        <FontAwesome name="sign-in" size={20} color="#fff" />
                        <Text style={styles.drawerOptionText}>Entrar em um projeto</Text>
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'flex-end',
    },
    drawerContainer: {
        backgroundColor: '#1A1D23',
        padding: 20,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingBottom: 40,
    },
    drawerOption: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 15,
    },
    drawerOptionText: {
        color: '#fff',
        fontSize: 18,
        marginLeft: 15,
    },
});
