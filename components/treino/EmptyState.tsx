import { FontAwesome } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface EmptyStateProps {
    onCreateTreino: () => void;
}

export function EmptyState({ onCreateTreino }: EmptyStateProps) {
    return (
        <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Nenhum treino encontrado.</Text>
            <Text style={styles.emptySubText}>Crie seu primeiro treino para começar!</Text>
            <TouchableOpacity style={styles.addWorkoutButton} onPress={onCreateTreino}>
                <FontAwesome name="plus" size={18} color="#fff" />
                <Text style={styles.addWorkoutButtonText}>Criar Treino</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    emptyContainer: {
        paddingVertical: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#141414',
        borderRadius: 12,
    },
    emptyText: {
        color: '#aaa',
        textAlign: 'center',
        fontSize: 16,
    },
    emptySubText: {
        color: '#888',
        textAlign: 'center',
        marginTop: 8,
        paddingHorizontal: 20,
    },
    addWorkoutButton: {
        backgroundColor: 'transparent',
        borderRadius: 12,
        padding: 15,
        marginTop: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        borderWidth: 1,
        borderColor: '#ffffff1a',
    },
    addWorkoutButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
