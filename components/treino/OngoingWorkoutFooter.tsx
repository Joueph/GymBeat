import { FontAwesome5 } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useTimer } from '../../contexts/TimerContext';
import { Log } from '../../models/log';
import { getCachedActiveWorkoutLog } from '../../services/offlineCacheService';

export function OngoingWorkoutFooter() {
    const router = useRouter();
    const pathname = usePathname();
    const { timerState, startTime, elapsedTime: timerElapsed, type } = useTimer();
    const [activeLog, setActiveLog] = useState<Log | null>(null);
    const [elapsedTime, setElapsedTime] = useState(0);

    // Check for active workout in cache (persistence)
    useEffect(() => {
        const checkActive = async () => {
            const log = await getCachedActiveWorkoutLog();
            setActiveLog(log);

            // If we have a log but no running timer context, we might calculate elapsed from log start
            if (log && timerState === 'idle' && log.horarioInicio) {
                // Calculate initial elapsed
                const start = log.horarioInicio.seconds ? log.horarioInicio.seconds * 1000 : new Date(log.horarioInicio).getTime();
                const now = Date.now();
                setElapsedTime(Math.floor((now - start) / 1000));
            }
        };

        checkActive();
        // Poll every few seconds to sync with cache if it changes externally? 
        // Or assume Context is main driver when app is open.
        const interval = setInterval(checkActive, 2000);
        return () => clearInterval(interval);
    }, [timerState]);

    // Sync with TimerContext if running
    useEffect(() => {
        if (timerState === 'running') {
            // If context is running, use its elapsed time for display if it's an exercise timer?
            // Actually, the footer usually shows TOTAL workout duration, not just the set timer.
            // But the user asked for "active timer". 
            // Typically "Ongoing Workout" shows total duration. 
            // Let's stick to total duration from log start if available.
            if (activeLog && activeLog.horarioInicio) {
                const start = activeLog.horarioInicio.seconds ? activeLog.horarioInicio.seconds * 1000 : new Date(activeLog.horarioInicio).getTime();
                const now = Date.now();
                setElapsedTime(Math.floor((now - start) / 1000));
            } else {
                // Fallback to timer context if it matches? 
                setElapsedTime(timerElapsed);
            }
        } else if (activeLog) {
            // Update elapsed even if timer context is idle (between sets)
            if (activeLog.horarioInicio) {
                const start = activeLog.horarioInicio.seconds ? activeLog.horarioInicio.seconds * 1000 : new Date(activeLog.horarioInicio).getTime();
                const now = Date.now();
                setElapsedTime(Math.floor((now - start) / 1000));
            }
        }
    }, [timerElapsed, activeLog, timerState]);

    // Local ticker for smooth updates when not relying purely on context
    useEffect(() => {
        if (activeLog) {
            const interval = setInterval(() => {
                if (activeLog.horarioInicio) {
                    const start = activeLog.horarioInicio.seconds ? activeLog.horarioInicio.seconds * 1000 : new Date(activeLog.horarioInicio).getTime();
                    const now = Date.now();
                    setElapsedTime(Math.floor((now - start) / 1000));
                }
            }, 1000);
            return () => clearInterval(interval);
        }
    }, [activeLog]);


    if (!activeLog) return null;
    if (pathname.includes('LoggingDuringWorkout')) return null;

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const handlePress = () => {
        router.push({
            pathname: '/(treino)/LoggingDuringWorkout',
            params: { logId: activeLog.id, treinoId: activeLog.treino.id, fichaId: activeLog.treino.fichaId }
        });
    };

    return (
        <Animated.View
            entering={FadeIn.duration(300)}
            exiting={FadeOut.duration(300)}
            style={styles.container}
        >
            <TouchableOpacity onPress={handlePress} style={styles.content}>
                <View style={styles.leftInfo}>
                    <View style={styles.iconContainer}>
                        <FontAwesome5 name="dumbbell" size={16} color="#ffffff" />
                    </View>
                    <View>
                        <Text style={styles.label}>Em andamento</Text>
                        <Text style={styles.workoutName} numberOfLines={1}>{activeLog.nomeTreino || 'Treino'}</Text>
                    </View>
                </View>

                <View style={styles.rightInfo}>
                    <Text style={styles.timer}>{formatTime(elapsedTime)}</Text>
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 90, // Position above the tab bar (approx 80-90px)
        left: 16,
        right: 16,
        backgroundColor: '#2A2E37',
        borderRadius: 16,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.30,
        shadowRadius: 4.65,
        elevation: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)'
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 12,
    },
    leftInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
    },
    iconContainer: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#3B82F6',
        alignItems: 'center',
        justifyContent: 'center',
    },
    label: {
        color: '#3B82F6',
        fontSize: 10,
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
    workoutName: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    rightInfo: {
        paddingLeft: 16,
    },
    timer: {
        color: '#fff',
        fontSize: 16,
        fontVariant: ['tabular-nums'],
        fontWeight: 'bold',
    }
});
