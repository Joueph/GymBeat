import { Ficha } from '@/models/ficha';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type QuickActionsWidgetProps = {
    activeFicha: Ficha | null;
    onStartEmptyWorkout: () => void;
};

export const QuickActionsWidget: React.FC<QuickActionsWidgetProps> = ({ activeFicha, onStartEmptyWorkout }) => {
    if (activeFicha) return null;

    return (
        <View style={styles.containerWrapper}>
            <Text style={styles.sectionTitle}>Ações</Text>

            <View style={styles.container_inner}>
                <TouchableOpacity style={styles.actionButton} onPress={onStartEmptyWorkout}>
                    <Text style={styles.actionText}>Iniciar Treino Livre</Text>
                    <View style={styles.iconContainer}>
                        <Ionicons name="add" size={24} color="#FFFFFF" />
                    </View>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionButton} onPress={() => router.push('/(treino)/modals/OpcoesTreino')}>
                    <Text style={styles.actionText}>Ver mais opções</Text>
                    <View style={styles.iconContainer}>
                        <Ionicons name="caret-forward-circle-outline" size={24} color="#FFFFFF"></Ionicons>
                    </View>
                </TouchableOpacity>
            </View>
        </View>




    );
};

const styles = StyleSheet.create({
    containerWrapper: {
        marginTop: 8,
        flexDirection: 'column',
    },
    container_inner: {
        flexDirection: 'column',
        gap: 8,
    },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#EAEAEA', opacity: 0.7, marginTop: 8, marginBottom: 8 },
    actionButton: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        backgroundColor: '#1A1D23', // Blue accent
        borderRadius: 12,
        padding: 16,
        gap: 8,
        flexGrow: 1,
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
