import { useAuth } from '@/app/authprovider';
import { useTimer } from '@/contexts/TimerContext'; // Added
import { Log } from '@/models/log';
import { getCachedActiveWorkoutLog } from '@/services/offlineCacheService';
import { FontAwesome, FontAwesome5 } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { WorkoutScreenPreference } from '../app/(treino)/modals/specifics/WorkoutScreenPreference';
import { CircularProgress } from './CircularProgress'; // Added

const toDate = (date: any): Date | null => {
    if (!date) return null;
    if (typeof date.toDate === 'function') return date.toDate();
    const d = new Date(date);
    return isNaN(d.getTime()) ? null : d;
};

const formatElapsedTime = (startTime: Date | null): string => {
    if (!startTime) return '00:00';
    const now = Date.now();
    const diffSeconds = Math.floor((now - startTime.getTime()) / 1000);
    if (diffSeconds < 0) return '00:00';

    const minutes = Math.floor(diffSeconds / 60);
    const seconds = diffSeconds % 60;

    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

export const OngoingWorkoutFooter = () => {
    const { user } = useAuth();
    const router = useRouter();
    // Consuming TimerContext for persistent overlay logic - Moved to top level
    const { startTime: timerStart, duration: timerDuration, type: timerType, elapsedTime: timerElapsed, timerState } = useTimer();

    const [activeLog, setActiveLog] = useState<Log | null>(null);
    const [elapsedTime, setElapsedTime] = useState('00:00');
    const [isPreferenceModalVisible, setPreferenceModalVisible] = useState(false);
    const intervalRef = useRef<number | null>(null);

    useFocusEffect(
        useCallback(() => {
            const checkActiveWorkout = async () => {
                try {
                    const log = await getCachedActiveWorkoutLog();
                    setActiveLog(log);
                } catch (error) {
                    console.error("Failed to get active workout from cache", error);
                    setActiveLog(null);
                }
            };
            checkActiveWorkout();
        }, [])
    );

    useEffect(() => {
        if (activeLog && activeLog.horarioInicio) {
            const startTime = toDate(activeLog.horarioInicio);
            intervalRef.current = window.setInterval(() => {
                setElapsedTime(formatElapsedTime(startTime));
            }, 1000);
        } else {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [activeLog]);

    const handleNavigation = () => {
        if (!activeLog || !activeLog.treino) return;

        const params = {
            fichaId: activeLog.treino.fichaId || '',
            treinoId: activeLog.treino.id,
            logId: activeLog.id,
        };

        if (user?.workoutScreenType === 'complete') {
            router.push({ pathname: '/(treino)/LoggingDuringWorkout', params });
        } else if (user?.workoutScreenType === 'simplified') {
            router.push({ pathname: '/(treino)/ongoingWorkout', params });
        } else {
            setPreferenceModalVisible(true);
        }
    };

    const handlePreferenceSelected = (preference: 'simplified' | 'complete') => {
        setPreferenceModalVisible(false);
        handleNavigation(); // Re-trigger navigation after preference is set
    };

    const isTimerActive = timerState === 'running' || timerState === 'finished'; // Or just checking timerStart

    if (!activeLog || !activeLog.treino) {
        return null;
    }

    // Determine what to show on the right button
    const renderRightButton = () => {
        if (isTimerActive && timerStart) {
            // Calculate progress for the ring
            // We can rely on timerElapsedTime from context which updates periodically
            // Or calculate locally for smoother animation, but Context handles logic.
            const progress = Math.min(1, timerElapsed / timerDuration);

            // If finished, maybe show 100% or a checkmark?
            // For now, consistent ring.

            return (
                <View style={styles.timerContainer}>
                    <CircularProgress
                        progress={progress}
                        size={46}
                        strokeWidth={4}
                        color={timerType === 'rest' ? '#3B82F6' : '#10B981'} // Blue for rest, Green for exercise?
                        backgroundColor="#333"
                        duration={timerDuration} // Let it self-animate for smoothness if context update is laggy
                    />
                    <View style={styles.timerIconOverlay}>
                        {timerType === 'rest' ? (
                            <FontAwesome name="hourglass" size={14} color="#fff" />
                        ) : (
                            <FontAwesome5 name="running" size={14} color="#fff" />
                        )}
                    </View>
                </View>
            );
        }

        return (
            <TouchableOpacity style={styles.playButton} onPress={handleNavigation}>
                <FontAwesome name="play" size={16} color="#fff" />
            </TouchableOpacity>
        );
    };

    return (
        <>
            <Animated.View style={styles.container} entering={SlideInDown.duration(500)} exiting={SlideOutDown.duration(500)}>
                <TouchableOpacity style={styles.infoContainer} onPress={handleNavigation}>
                    <Text style={styles.workoutName} numberOfLines={1}>
                        {activeLog.treino.nome}
                    </Text>
                    <Text style={styles.workoutDetails}>
                        {isTimerActive ? (
                            <Text style={{ color: timerType === 'rest' ? '#3B82F6' : '#10B981', fontWeight: 'bold' }}>
                                {timerType === 'rest' ? 'Descanso' : 'Exercício'}: {Math.max(0, timerDuration - timerElapsed)}s
                            </Text>
                        ) : (
                            `${activeLog.treino.exercicios?.length || 0} exercícios • ${elapsedTime}`
                        )}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={handleNavigation}>
                    {renderRightButton()}
                </TouchableOpacity>
            </Animated.View>
            <WorkoutScreenPreference
                isVisible={isPreferenceModalVisible}
                onClose={() => setPreferenceModalVisible(false)}
                onSelectPreference={handlePreferenceSelected}
                currentPreference={user?.workoutScreenType}
            />
        </>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 0, // Positioned at the bottom of its parent
        left: 0,
        right: 0,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1A1D23',
        padding: 12,
        margin: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#1F2937',
        elevation: 10,
        shadowColor: '#000',
        shadowOpacity: 0.4,
        shadowRadius: 8,
    },
    playButton: {
        backgroundColor: '#3B82F6',
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 12,
    },
    infoContainer: {
        flex: 1,
    },
    workoutName: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    workoutDetails: {
        color: '#ccc',
        fontSize: 13,
        marginTop: 2,
    },
    timerContainer: {
        width: 46,
        height: 46,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 12,
    },
    timerIconOverlay: {
        position: 'absolute',
    }
});