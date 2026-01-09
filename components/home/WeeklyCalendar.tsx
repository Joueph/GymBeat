import { Log } from '@/models/log';
import { DiaSemana, Treino } from '@/models/treino';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ProgressCircle } from '../ProgressCircle';

type WeeklyCalendarProps = {
    logs: Log[];
    treinos: Treino[];
};

export const WeeklyCalendar: React.FC<WeeklyCalendarProps> = ({ logs, treinos }) => {
    const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const weekDayMap: { [key: number]: DiaSemana } = { 0: 'dom', 1: 'seg', 2: 'ter', 3: 'qua', 4: 'qui', 5: 'sex', 6: 'sab' };
    const today = new Date();
    const currentDayIndex = today.getDay();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - currentDayIndex);
    startOfWeek.setHours(0, 0, 0, 0);

    const completedWorkoutIdsThisWeek = new Set(
        logs.filter(log => {
            if (!log.horarioFim || !log.treino?.id) return false;
            const time = log.horarioFim.seconds ? log.horarioFim.seconds * 1000 : new Date(log.horarioFim).getTime();
            return new Date(time) >= startOfWeek;
        }).map(log => log.treino!.id)
    );

    return (
        <View style={styles.calendarContainer}>
            {weekDays.map((day, index) => {
                const isToday = index === currentDayIndex;
                const date = new Date();
                date.setDate(today.getDate() - (currentDayIndex - index));
                const dateString = date.toDateString();
                const dayKey = weekDayMap[index];
                const scheduledTreinoForDay = treinos.find(treino => treino.diasSemana.includes(dayKey));
                const isScheduledButNotDone = scheduledTreinoForDay && !completedWorkoutIdsThisWeek.has(scheduledTreinoForDay.id!);

                const logDoDia = logs.find(log => {
                    if (log.horarioFim) {
                        const time = log.horarioFim.seconds ? log.horarioFim.seconds * 1000 : new Date(log.horarioFim).getTime();
                        return new Date(time).toDateString() === dateString;
                    }
                    return !log.horarioFim && isToday;
                });

                let progress = 0;
                if (logDoDia) {
                    const totalSeries = logDoDia.exercicios.reduce((acc, ex) => acc + (ex.series?.length || 0), 0);
                    const seriesFeitas = logDoDia.exercicios.reduce((acc, ex) => acc + (ex.series?.filter(s => (s as any).concluido).length || 0), 0);
                    if (totalSeries > 0) progress = seriesFeitas / totalSeries;
                }

                return (
                    <View key={day} style={[styles.dayContainer, isToday && styles.todayContainer]}>
                        <Text style={styles.dayText}>{day}</Text>
                        <View style={styles.dateContainer}>
                            {logDoDia ? (
                                <ProgressCircle progress={progress} />
                            ) : (
                                isScheduledButNotDone && <View style={styles.scheduledDayCircle} />
                            )}
                            <View style={[StyleSheet.absoluteFillObject, styles.dateTextContainer]}>
                                <Text style={styles.dateText}>{date.getDate()}</Text>
                            </View>
                        </View>
                    </View>
                );
            })}
        </View>
    );
};

const styles = StyleSheet.create({
    calendarContainer: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 15 },
    dayContainer: { alignItems: 'center', justifyContent: 'center', gap: 8, width: 45, height: 65 },
    dateContainer: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center', position: 'relative' },
    dateTextContainer: { position: 'absolute', justifyContent: 'center', alignItems: 'center' },
    dayText: { color: '#888', fontSize: 12, fontWeight: '300' },
    dateText: { color: '#EAEAEA', fontSize: 16, fontWeight: '600' },
    todayContainer: { backgroundColor: '#1A1D23', borderRadius: 12, borderWidth: 0.5, borderColor: '#2A2E37' },
    scheduledDayCircle: { width: 32, height: 32, borderColor: '#888', borderWidth: 1.5, borderRadius: 16 },
});
