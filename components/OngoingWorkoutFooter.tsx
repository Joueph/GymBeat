import { useAuth } from '@/app/authprovider';
import { Log } from '@/models/log';
import { getCachedActiveWorkoutLog } from '@/services/offlineCacheService';
import { FontAwesome } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { WorkoutScreenPreference } from '../app/(treino)/modals/specifics/WorkoutScreenPreference';

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

    if (!activeLog || !activeLog.treino) {
        return null;
    }

    return (
        <>
            <Animated.View style={styles.container} entering={SlideInDown.duration(500)} exiting={SlideOutDown.duration(500)}>
                <TouchableOpacity style={styles.playButton} onPress={handleNavigation}>
                    <FontAwesome name="play" size={16} color="#030405" />
                </TouchableOpacity>
                <View style={styles.infoContainer}>
                    <Text style={styles.workoutName} numberOfLines={1}>{activeLog.treino.nome}</Text>
                    <Text style={styles.workoutDetails}>
                        {activeLog.treino.exercicios?.length || 0} exercícios • {elapsedTime}
                    </Text>
                </View>
            </Animated.View>
            <WorkoutScreenPreference
                isVisible={isPreferenceModalVisible}
                onClose={() => setPreferenceModalVisible(false)}
                onSelectPreference={handlePreferenceSelected}
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
        backgroundColor: '#1C1C1E',
        padding: 12,
        margin: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#ffffff2a',
        elevation: 10,
        shadowColor: '#000',
        shadowOpacity: 0.4,
        shadowRadius: 8,
    },
    playButton: {
        backgroundColor: '#00A6FF',
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
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
});