import * as NotificationsLiveActivity from '@/modules/notifications-live-activity';
import { LoggedExercise } from '@/types/logging';
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';

export const useLiveActivity = (
    workoutName: string,
    loggedExercises: LoggedExercise[],
    elapsedTime: number,
    isTimerRunning: boolean
) => {
    const [currentActivityId, setCurrentActivityId] = useState<string | null>(null);

    useEffect(() => {
        if (Platform.OS === 'ios') {
            NotificationsLiveActivity.listActivities().then(async (activities) => {
                if (activities && activities.length > 0) {
                    console.log('[LiveActivity] Found existing activities:', activities);
                    // Use the first one
                    const activeId = activities[0];
                    setCurrentActivityId(activeId);

                    // Kill others if any
                    if (activities.length > 1) {
                        console.log('[LiveActivity] Killing duplicates...');
                        for (let i = 1; i < activities.length; i++) {
                            await NotificationsLiveActivity.endActivity(activities[i]);
                        }
                    }
                }
            }).catch((e) => console.log('Error checking activities:', e));
        }
    }, []);

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const updateWidgetState = useCallback(async () => {
        if (!workoutName || loggedExercises.length === 0) return;

        const totalExercises = loggedExercises.length;
        const exercisesDone = loggedExercises.filter((ex) =>
            ex.series.length > 0 && ex.series.every((s) => s.concluido)
        ).length;

        const widgetData = {
            name: workoutName,
            muscleGroup: loggedExercises.map((ex) => ex.modelo.grupoMuscular).join(', '),
            duration: formatDuration(elapsedTime),
            isCompleted: false,
            dayLabel: "HOJE",
            status: 'in_progress',
            exercisesDone: exercisesDone,
            totalExercises: totalExercises,
            lastUpdate: Date.now(),
        };

        if (Platform.OS === 'ios') {
            await NotificationsLiveActivity.setWidgetData(
                "widget_today_workout",
                JSON.stringify(widgetData)
            );
        }
    }, [workoutName, loggedExercises, elapsedTime]);

    // Update widget periodically or when relevant changes occur
    useEffect(() => {
        if (isTimerRunning || elapsedTime % 60 === 0) {
            updateWidgetState();
        }
    }, [updateWidgetState, elapsedTime, isTimerRunning]);

    const startLiveActivity = async (initialName: string) => {
        if (Platform.OS === 'ios') {
            const activities = await NotificationsLiveActivity.listActivities();
            if (activities.length === 0) {
                const timestamp = Date.now() + (60 * 60 * 1000); // 1 hour default deadline

                await NotificationsLiveActivity.startActivity(
                    timestamp,
                    initialName,
                    1, // Set 1
                    0, // Total sets unknown or 0 for now
                    "-", // Weight
                    "-", // Reps
                    0 // Dropset
                );
            }
        }
    };

    return {
        currentActivityId,
        setCurrentActivityId,
        startLiveActivity
    };
};
