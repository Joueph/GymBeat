import { Log } from '@/models/log';
import { Treino } from '@/models/treino';
import { FontAwesome5 } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { DaysOfWeekSelector } from './DaysOfWeekSelector';
import { EstimatedTimeRow } from './EstimatedTimeRow';
import { MuscleGroupsRow } from './MuscleGroupsRow';
import { HistoricoCargaTreinoChart } from './charts/HistoricoCargaTreinoChart';

interface InfoCardProps {
    treino: Treino;
    allUserLogs: Log[];
    onUpdateTreino: (treino: Treino) => void;
    isEditing: boolean;
    setIsEditing: (isEditing: boolean) => void;
    onPressProgresso: () => void;
}

export const InfoCard: React.FC<InfoCardProps> = ({
    treino,
    allUserLogs,
    onUpdateTreino,
    isEditing,
    setIsEditing,
    onPressProgresso
}) => {
    return (
        <View style={styles.card}>
            {/* Rows with transparent background */}
            <EstimatedTimeRow
                treino={treino}
                allUserLogs={allUserLogs}
                transparent
            />

            <View style={styles.divider} />

            <DaysOfWeekSelector
                treino={treino}
                onUpdateTreino={onUpdateTreino}
                isEditing={isEditing}
                setIsEditing={setIsEditing}
                transparent
            />

            <View style={styles.divider} />

            <MuscleGroupsRow
                treino={treino}
                transparent
            />

            <View style={styles.divider} />

            {/* Progresso Row */}
            <TouchableOpacity style={styles.row} onPress={onPressProgresso}>
                <View style={styles.iconContainer}>
                    <FontAwesome5 name="chart-bar" size={16} color="#888" />
                </View>
                <View style={styles.contentContainer}>
                    <Text style={styles.label}>Progresso</Text>

                    {/* Minimal Chart */}
                    <View style={styles.chartContainer}>
                        <HistoricoCargaTreinoChart
                            treinoId={treino.id}
                            allUserLogs={allUserLogs}
                            variant="minimal"
                        />
                    </View>
                </View>
                <FontAwesome5 name="chevron-right" size={14} color="#555" />
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        borderRadius: 12,
        paddingVertical: 4,
        overflow: 'hidden',
    },
    divider: {
        height: 1,
        backgroundColor: '#ffffff0d', // Very subtle divider
        marginLeft: 56, // Align with text start (32 icon + 12 gap + 12 padding)
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
    },
    iconContainer: {
        width: 32,
        alignItems: 'center',
        marginRight: 12,
    },
    contentContainer: {
        flex: 1,
        flexDirection: 'row', // Align label and chart horizontally
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    label: {
        color: '#888',
        fontSize: 12,
        textTransform: 'uppercase',
        fontWeight: '600',
        marginBottom: 2,
    },
    chartContainer: {
        height: 40,
        justifyContent: 'center',
        alignItems: 'flex-end', // Align chart to right
        marginTop: 0,
        marginRight: 8,
    }
});
