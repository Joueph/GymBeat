import * as Haptics from 'expo-haptics';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as NotificationsLiveActivity from '../modules/notifications-live-activity';
import { cancelNotification, scheduleNotification } from '../services/notificationService';

type TimerType = 'rest' | 'exercise' | 'none';

export interface TimerMetadata {
    exerciseIndex?: number;
    setIndex?: number;
    exerciseName?: string;
    weight?: string;
    reps?: string;
    totalSets?: number;
    dropsetCount?: number;
    nextExerciseName?: string; // For static info after timer ends
    nextSetWeight?: string;
    nextSetReps?: string;
}

interface TimerContextProps {
    startTime: number | null;
    duration: number; // in seconds
    type: TimerType;
    metadata: TimerMetadata | null;
    timerState: 'running' | 'paused' | 'finished' | 'idle';
    elapsedTime: number; // Reactive elapsed time for UI
    startTimer: (duration: number, type: TimerType, metadata?: TimerMetadata) => void;
    stopTimer: () => void;
    skipTimer: () => void;
}

const TimerContext = createContext<TimerContextProps>({
    startTime: null,
    duration: 0,
    type: 'none',
    metadata: null,
    timerState: 'idle',
    elapsedTime: 0,
    startTimer: () => { },
    stopTimer: () => { },
    skipTimer: () => { },
});

export const useTimer = () => useContext(TimerContext);

export const TimerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [startTime, setStartTime] = useState<number | null>(null);
    const [duration, setDuration] = useState(0);
    const [type, setType] = useState<TimerType>('none');
    const [metadata, setMetadata] = useState<TimerMetadata | null>(null);
    const [timerState, setTimerState] = useState<'running' | 'paused' | 'finished' | 'idle'>('idle');
    const [elapsedTime, setElapsedTime] = useState(0);

    const intervalRef = useRef<any>(null);

    // Manage interval for reactive UI updates
    useEffect(() => {
        if (startTime && timerState === 'running') {
            intervalRef.current = setInterval(() => {
                const now = Date.now();
                const elapsed = Math.floor((now - startTime) / 1000);
                setElapsedTime(elapsed);

                if (elapsed >= duration) {
                    handleTimerFinished();
                }
            }, 500); // Check every 0.5s for smoothness
        } else {
            if (intervalRef.current) clearInterval(intervalRef.current);
        }

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [startTime, duration, timerState]);

    const startTimer = async (newDuration: number, newType: TimerType, newMetadata?: TimerMetadata) => {
        // 1. Clear existing
        if (intervalRef.current) clearInterval(intervalRef.current);
        cancelNotification('rest-timer');

        // 2. Set State
        const now = Date.now();
        setStartTime(now);
        setDuration(newDuration);
        setType(newType);
        setMetadata(newMetadata || null);
        setTimerState('running');
        setElapsedTime(0);

        // 3. Notifications / Haptics
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        if (newType === 'rest') {
            // Assuming scheduleNotification(id, title, body, trigger)
            // Fix trigger to be object if required, or number if seconds
            scheduleNotification('rest-timer', 'Descanso Finalizado', 'Volte para o treino!', { seconds: newDuration });
        }


        // 4. Live Activity (iOS)
        if (Platform.OS === 'ios' && newMetadata) {
            try {
                const timestamp = now + (newDuration * 1000);
                const activities = await NotificationsLiveActivity.listActivities();
                const activeId = activities.length > 0 ? activities[0] : null;

                if (activeId) {
                    await NotificationsLiveActivity.updateActivity(
                        activeId,
                        timestamp,
                        newMetadata.exerciseName || "Treino",
                        (newMetadata.setIndex || 0) + 1,
                        newMetadata.totalSets || 0,
                        newMetadata.weight || "-",
                        newMetadata.reps || "-",
                        newMetadata.dropsetCount || 0
                    );
                } else {
                    await NotificationsLiveActivity.startActivity(
                        timestamp,
                        newMetadata.exerciseName || "Treino",
                        (newMetadata.setIndex || 0) + 1,
                        newMetadata.totalSets || 0,
                        newMetadata.weight || "-",
                        newMetadata.reps || "-",
                        newMetadata.dropsetCount || 0
                    );
                }
            } catch (e) {
                console.log("Live Activity Error", e);
            }
        }
    };

    const stopTimer = async () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setStartTime(null);
        setDuration(0);
        setType('none');
        setMetadata(null);
        setTimerState('idle');
        setElapsedTime(0);
        cancelNotification('rest-timer');

        if (Platform.OS === 'ios') {
            // End Live Activity logic
            try {
                const activities = await NotificationsLiveActivity.listActivities();
                if (activities.length > 0) {
                    await NotificationsLiveActivity.endActivity(activities[0]);
                }
            } catch (e) { console.log('Error ending activity', e); }
        }
    };

    const skipTimer = async () => {
        // User manually skips
        stopTimer();
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        // Maybe trigger next set auto-start logic?
        // For now, just stop.
    };

    const handleTimerFinished = async () => {
        setTimerState('finished');
        if (intervalRef.current) clearInterval(intervalRef.current);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        // Keep state as 'finished' so UI can show "00:00" or "Ready" until user dismisses or starts new
        // Or auto-dismiss? 
        // Decision: Let it sit at 0 until user interacts, or maybe clear after 5s?
        // For persistent overlay, likely want to show "Next Set: ... "

        if (Platform.OS === 'ios') {
            // Update Live Activity to show static "Ready" state
            // This needs function access to update activity without ending it immediately if desired
            // Or just end it.
        }
    };

    return (
        <TimerContext.Provider value={{
            startTime,
            duration,
            type,
            metadata,
            timerState,
            elapsedTime,
            startTimer,
            stopTimer,
            skipTimer
        }}>
            {children}
        </TimerContext.Provider>
    );
};
