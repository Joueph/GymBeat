import { Ficha } from '@/models/ficha';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type QuickActionsWidgetProps = {
    activeFicha: Ficha | null;
    onStartEmptyWorkout: () => void;
};

export const QuickActionsWidget: React.FC<QuickActionsWidgetProps> = ({ activeFicha, onStartEmptyWorkout }) => {
    if (activeFicha) return null;

    return (
        <View style={styles.container}>
            <TouchableOpacity style={styles.actionButton} onPress={onStartEmptyWorkout}>
                <View style={styles.iconContainer}>
                    <Ionicons name="add" size={24} color="#FFFFFF" />
                </View>
                <Text style={styles.actionText}>Iniciar Treino Livre</Text>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginTop: 8,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#3B82F6', // Blue accent
        borderRadius: 12,
        padding: 15,
    },
    iconContainer: {
        marginRight: 10,
    },
    actionText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
