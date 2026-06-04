import { Ficha } from '@/models/ficha';
import { Log } from '@/models/log';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type QuickActionsWidgetProps = {
    activeFicha: Ficha | null;
    activeWorkoutLog?: Log | null;
    onStartEmptyWorkout: () => void;
};

export const QuickActionsWidget: React.FC<QuickActionsWidgetProps> = ({ activeFicha, activeWorkoutLog, onStartEmptyWorkout }) => {
    if (activeFicha && !activeWorkoutLog) return null;

    return (
        <View style={styles.containerWrapper}>
            <Text style={styles.sectionTitle}>Ações</Text>

            <View style={styles.container_inner}>
                {activeWorkoutLog && (
                    <TouchableOpacity
                        style={[styles.actionButton, styles.resumeButton]}
                        onPress={() => router.push({ pathname: '/(treino)/LoggingDuringWorkout', params: { logId: activeWorkoutLog.id } })}
                    >
                        <View>
                            <Text style={styles.actionText}>Continuar treino</Text>
                            <Text style={styles.actionSubText}>{String(activeWorkoutLog.nomeTreino || activeWorkoutLog.treino?.nome || 'Treino em andamento')}</Text>
                        </View>
                        <View style={styles.iconContainer}>
                            <Ionicons name="play" size={24} color="#FFFFFF" />
                        </View>
                    </TouchableOpacity>
                )}

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
    actionSubText: {
        color: '#9CA3AF',
        fontSize: 12,
        marginTop: 4,
    },
    resumeButton: {
        borderColor: '#3B82F6',
        borderWidth: 1,
    },
});
