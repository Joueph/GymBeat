import { FontAwesome } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { SharedValue, useAnimatedStyle } from 'react-native-reanimated';

interface RestTimerOverlayProps {
    isResting: boolean;
    isDoingExercise: boolean;
    restCountdown: number;
    exerciseCountdown: number;
    progress: SharedValue<number>;
    handleSkipRest: () => void;
    formatTime: (seconds: number) => string;
}

export const RestTimerOverlay = ({
    isResting,
    isDoingExercise,
    restCountdown,
    exerciseCountdown,
    progress,
    handleSkipRest,
    formatTime
}: RestTimerOverlayProps) => {
    const animatedProgressStyle = useAnimatedStyle(() => {
        return {
            width: `${progress.value * 100}%`,
        };
    });

    if (!isResting && !isDoingExercise) return null;

    return (
        <View style={styles.restTimerOverlay}>
            <View style={styles.restTimerProgressContainer}>
                <Animated.View style={[styles.restTimerProgressBar, animatedProgressStyle]} />
            </View>
            <View style={styles.restTimerContent}>
                <View>
                    <Text style={styles.restTimerLabel}>
                        {isDoingExercise ? 'Exercício' : 'Descanso'}
                    </Text>
                    <Text style={styles.restTimerValue}>
                        {formatTime(isDoingExercise ? exerciseCountdown : restCountdown)}
                    </Text>
                </View>
                <TouchableOpacity style={styles.skipButton} onPress={handleSkipRest}>
                    <FontAwesome name="forward" size={20} color="#fff" />
                    <Text style={styles.skipButtonText}>Pular</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    restTimerOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#0B0D10',
        borderTopWidth: 1,
        borderTopColor: '#333',
        paddingBottom: 30, // Space for safe area
    },
    restTimerProgressContainer: {
        height: 4,
        backgroundColor: '#333',
    },
    restTimerProgressBar: {
        height: '100%',
        backgroundColor: '#3B82F6',
    },
    restTimerContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 15,
    },
    restTimerLabel: {
        color: '#aaa',
        fontSize: 14,
    },
    restTimerValue: {
        color: '#fff',
        fontSize: 36,
        fontWeight: 'bold',
        fontVariant: ['tabular-nums'],
    },
    skipButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#3B82F6',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 8,
        gap: 10,
    },
    skipButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
