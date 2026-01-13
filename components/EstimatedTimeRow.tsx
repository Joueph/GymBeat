import { Log } from '@/models/log';
import { Treino } from '@/models/treino';
import { FontAwesome5 } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface EstimatedTimeRowProps {
    treino: Treino;
    allUserLogs: Log[];
    transparent?: boolean;
}

export const EstimatedTimeRow: React.FC<EstimatedTimeRowProps> = ({ treino, allUserLogs, transparent }) => {
    const estimation = useMemo(() => {
        // 1. Check for historical data (last 2 months, completed workouts)
        const twoMonthsAgo = new Date();
        twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

        const relevantLogs = allUserLogs.filter(log => {
            if (log.treino?.id !== treino.id) return false;
            // Assume completed if status is 'finished' or similar. 
            // Adjust based on actual Log status values found in codebase, usually 'completed' or check boolean flags if exists.
            // Based on typical models, we might check if 'horarioFim' exists.
            if (!log.horarioFim || !log.horarioInicio) return false;

            const logDate = new Date(log.horarioInicio);
            return logDate >= twoMonthsAgo;
        });

        if (relevantLogs.length > 0) {
            const durations = relevantLogs.map(log => {
                const start = new Date(log.horarioInicio).getTime();
                const end = new Date(log.horarioFim).getTime();
                return (end - start) / 60000; // minutes
            });

            const minTime = Math.round(Math.min(...durations));
            const maxTime = Math.round(Math.max(...durations));

            return {
                text: `${minTime} - ${maxTime} min`,
                isHistorical: true
            };
        }

        // 2. Fallback to theoretical calculation
        let totalSeconds = 0;
        treino.exercicios.forEach(ex => {
            const restTime = ex.restTime || 90;
            ex.series.forEach(serie => {
                // Parse reps
                let reps = 10;
                const repsString = String(serie.repeticoes);
                const match = repsString.match(/\d+/);
                if (match) {
                    reps = parseInt(match[0], 10);
                }

                // 5s per rep + rest time (rest time usually occurs AFTER the set)
                // We typically assume rest time happens between sets.
                totalSeconds += (reps * 5) + restTime;
            });
        });

        const totalMinutes = Math.round(totalSeconds / 60);
        return {
            text: `~${totalMinutes} min (Estimado)`,
            isHistorical: false
        };

    }, [treino, allUserLogs]);

    return (
        <View style={[styles.container, transparent && styles.transparent]}>
            <View style={styles.iconContainer}>
                <FontAwesome5 name="clock" size={16} color="#888" />
            </View>
            <View style={styles.contentContainer}>
                <Text style={styles.label}>Tempo Estimado</Text>
                <Text style={styles.value}>{estimation.text}</Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#ffffff1a',
    },
    transparent: {
        backgroundColor: 'transparent',
        borderWidth: 0,
        marginBottom: 0,
    },
    iconContainer: {
        width: 32,
        alignItems: 'center',
        marginRight: 12,
    },
    contentContainer: {
        flex: 1,
    },
    label: {
        color: '#888',
        fontSize: 12,
        textTransform: 'uppercase',
        fontWeight: '600',
        marginBottom: 2,
    },
    value: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
