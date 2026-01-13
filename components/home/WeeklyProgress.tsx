import { Ficha } from '@/models/ficha';
import { Log } from '@/models/log';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ProgressCircle } from '../ProgressCircle';

type WeeklyProgressProps = {
    logs: Log[];
    activeFicha: Ficha | null;
    streakGoal?: number;
};

export const WeeklyProgress: React.FC<WeeklyProgressProps> = ({ logs, activeFicha, streakGoal = 3 }) => {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const completedSessionsThisWeek = logs.filter(log => {
        if (!log.horarioFim || !log.treino?.id) return false;
        const time = log.horarioFim.seconds ? log.horarioFim.seconds * 1000 : new Date(log.horarioFim).getTime();
        return new Date(time) >= startOfWeek;
    }).length;

    const treinosRealizados = completedSessionsThisWeek;
    const treinosNaSemana = streakGoal;
    const progress = treinosNaSemana > 0 ? treinosRealizados / treinosNaSemana : 0;
    // Removed the "if (treinosNaSemana === 0) return null;" check because streakGoal defaults to 3, so it's rarely 0 unless explicitly set.
    // Even if 0, we might want to show "Overachiever" status or handle it gracefully, but usually it won't optionally hide the whole widget arbitrarily if the goal is missing.
    // However, if the user explicitly has NO goal, maybe they don't want to see it? But default is 3. 
    // The previous logic hid if activeFicha had 0 workouts. Here we rely on goal.


    return (
        <View>
            <Text style={styles.sectionTitle}>Progresso Semanal</Text>
            <View style={styles.weeklyProgressContainer}>
                <View>
                    <Text style={styles.progressCountText}>{treinosRealizados} / {treinosNaSemana}</Text>
                    <Text style={styles.progressLabelText}>Treinos concluídos</Text>
                </View>
                <View style={styles.progressCircleContainer}>
                    <ProgressCircle progress={progress} size={80} strokeWidth={6} />
                    <Text style={styles.progressPercentageText}>{Math.round(progress * 100)}%</Text>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#EAEAEA', opacity: 0.7, marginTop: 16, marginBottom: 8 },
    weeklyProgressContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1A1D23', borderRadius: 12, borderWidth: 0.5, borderColor: '#2A2E37', padding: 20 },
    progressCountText: { color: '#FFFFFF', fontSize: 40, fontWeight: 'bold' },
    progressLabelText: { color: '#888', fontSize: 14, marginTop: 4 },
    progressCircleContainer: { justifyContent: 'center', alignItems: 'center' },
    progressPercentageText: { position: 'absolute', color: '#FFFFFF', fontSize: 20, fontWeight: '600' },
});
