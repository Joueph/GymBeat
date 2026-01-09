import { Log } from '@/models/log';
import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

type StreakWidgetProps = {
    logs: Log[];
    streakGoal?: number;
};

export const StreakWidget: React.FC<StreakWidgetProps> = ({ logs, streakGoal = 3 }) => {
    const streak = useMemo(() => {
        if (!logs || logs.length === 0) return 0;

        // Helper to get week key (YYYY-Www)
        const getWeekKey = (date: Date) => {
            const d = new Date(date);
            d.setHours(0, 0, 0, 0);
            d.setDate(d.getDate() + 4 - (d.getDay() || 7)); // Thursday of the week
            const yearStart = new Date(d.getFullYear(), 0, 1);
            const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
            return `${d.getFullYear()}-W${weekNo}`;
        };

        // Group logs by week and count unique days per week
        const weeksData = new Map<string, Set<string>>(); // WeekKey -> Set of DayStrings

        logs.forEach(log => {
            const timestamp = log.horarioFim?.seconds ? log.horarioFim.seconds * 1000 : (log.horarioFim ? new Date(log.horarioFim).getTime() : 0);
            if (timestamp) {
                const date = new Date(timestamp);
                const weekKey = getWeekKey(date);
                const dayKey = date.toISOString().split('T')[0];

                if (!weeksData.has(weekKey)) {
                    weeksData.set(weekKey, new Set());
                }
                weeksData.get(weekKey)?.add(dayKey);
            }
        });

        let currentStreak = 0;
        const today = new Date();

        // Check current week
        const currentWeekKey = getWeekKey(today);
        const currentWeekCount = weeksData.get(currentWeekKey)?.size || 0;

        // If goal met this week, include it. If not, streak might be broken or just started this week?
        // Usually streak implies "completed units". 
        // If "current week" is met, then streak includes current week.
        // If not, we check last week. 
        // BUT, if current week is NOT met, but last week WAS, streak is still alive until week ends?
        // User asked: "WeekStreakGoal in a row".

        // Let's iterate backwards week by week.
        let checkDate = new Date(today);

        // Check current week first
        if (currentWeekCount >= streakGoal) {
            currentStreak++;
            // Move to previous week
            checkDate.setDate(checkDate.getDate() - 7);
        } else {
            // Current week not met yet.
            // Check if last week met. If yes, streak is alive but doesn't include current week yet.
            // If last week not met, streak is 0.
            checkDate.setDate(checkDate.getDate() - 7);
            const lastWeekKey = getWeekKey(checkDate);
            if ((weeksData.get(lastWeekKey)?.size || 0) < streakGoal) {
                return 0;
            }
        }

        while (true) {
            const weekKey = getWeekKey(checkDate);
            const count = weeksData.get(weekKey)?.size || 0;

            if (count >= streakGoal) {
                currentStreak++;
                checkDate.setDate(checkDate.getDate() - 7);
            } else {
                break;
            }
        }

        return currentStreak;
    }, [logs, streakGoal]);

    return (
        <View style={styles.container}>
            <View style={styles.iconContainer}>
                <Ionicons name="flame" size={24} color="#FFD700" />
            </View>
            <View>
                <Text style={styles.streakCount}>{streak} Semanas</Text>
                <Text style={styles.streakLabel}>Sequência atual</Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1A1D23',
        borderRadius: 12,
        borderWidth: 0.5,
        borderColor: '#2A2E37',
        padding: 15,
        marginTop: 8,
        flex: 1,
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 215, 0, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    streakCount: {
        color: '#EAEAEA',
        fontSize: 18,
        fontWeight: 'bold',
    },
    streakLabel: {
        color: '#888',
        fontSize: 12,
    },
});
