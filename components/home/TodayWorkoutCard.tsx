import { Ficha } from '@/models/ficha';
import { DiaSemana, Treino } from '@/models/treino';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type TodayWorkoutCardProps = {
    treinos: Treino[];
    activeFicha: Ficha | null;
};

export const TodayWorkoutCard: React.FC<TodayWorkoutCardProps> = ({ treinos, activeFicha }) => {
    const router = useRouter();
    const weekDayMap: { [key: number]: DiaSemana } = { 0: 'dom', 1: 'seg', 2: 'ter', 3: 'qua', 4: 'qui', 5: 'sex', 6: 'sab' };
    const todayIndex = new Date().getDay();
    const todayKey = weekDayMap[todayIndex];
    const todaysWorkout = treinos.find(t => t.diasSemana.includes(todayKey));

    if (!todaysWorkout) return null;

    const totalSeries = todaysWorkout.exercicios.reduce((acc, ex) => acc + (ex.series?.length || 0), 0);
    const estimatedTime = totalSeries * 2;

    return (
        <>
            <View style={styles.todayWorkoutHeader}>
                <Text style={styles.sectionTitle}>Treino De Hoje</Text>
                {activeFicha && <Text style={styles.currentFichaText}>{activeFicha.nome}</Text>}
            </View>
            <TouchableOpacity
                style={styles.todayWorkoutCard}
                onPress={() => router.push({ pathname: '/(treino)/editarTreino', params: { treinoId: todaysWorkout.id, fichaId: activeFicha?.id } })}
            >
                <View>
                    <Text style={styles.workoutName}>{todaysWorkout.nome}</Text>
                    <View style={styles.workoutDetailsContainer}>
                        <Text style={styles.workoutDetailText}>{todayKey.toUpperCase()}</Text>
                        <View style={styles.detailSeparator} />
                        <Text style={styles.workoutDetailText}>~{estimatedTime} min</Text>
                    </View>
                </View>
                <Ionicons name="chevron-forward" size={28} color="#262A32" />
            </TouchableOpacity>
        </>
    );
};

const styles = StyleSheet.create({
    sectionTitle: { fontSize: 22, fontWeight: 'bold', color: '#EAEAEA', marginTop: 16 },
    todayWorkoutHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingRight: 15 },
    currentFichaText: { color: '#888', fontSize: 14, fontWeight: '500' },
    todayWorkoutCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1A1D23', borderRadius: 12, borderWidth: 0.5, borderColor: '#2A2E37', padding: 20, marginTop: 8 },
    workoutName: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
    workoutDetailsContainer: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 8 },
    workoutDetailText: { color: '#888', fontSize: 14, alignSelf: 'flex-end' },
    detailSeparator: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#555', marginHorizontal: 8 },
});
