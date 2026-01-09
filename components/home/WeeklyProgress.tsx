import { Ficha } from '@/models/ficha';
import { Log } from '@/models/log';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ProgressCircle } from '../ProgressCircle';

type WeeklyProgressProps = {
    logs: Log[];
    activeFicha: Ficha | null;
};

export const WeeklyProgress: React.FC<WeeklyProgressProps> = ({ logs, activeFicha }) => {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const completedWorkoutsThisWeek = new Set(
        logs.filter(log => {
            if (!log.horarioFim || !log.treino?.id) return false;
            const time = log.horarioFim.seconds ? log.horarioFim.seconds * 1000 : new Date(log.horarioFim).getTime();
            return new Date(time) >= startOfWeek;
        }).map(log => log.treino!.id)
    );

    const treinosRealizados = completedWorkoutsThisWeek.size;
    const treinosNaSemana = activeFicha?.treinos.length || 0;
    const progress = treinosNaSemana > 0 ? treinosRealizados / treinosNaSemana : 0;
    if (treinosNaSemana === 0) return null;

    return (
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
    );
};

const styles = StyleSheet.create({
    weeklyProgressContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1A1D23', borderRadius: 12, borderWidth: 0.5, borderColor: '#2A2E37', padding: 20, marginTop: 8 },
    progressCountText: { color: '#FFFFFF', fontSize: 40, fontWeight: 'bold' },
    progressLabelText: { color: '#888', fontSize: 14, marginTop: 4 },
    progressCircleContainer: { justifyContent: 'center', alignItems: 'center' },
    progressPercentageText: { position: 'absolute', color: '#FFFFFF', fontSize: 20, fontWeight: '600' },
});
