import { FontAwesome, FontAwesome5 } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface WorkoutStatsProps {
    elapsedTime: number;
    totalLoad: number;
}

export const WorkoutStats = ({ elapsedTime, totalLoad }: WorkoutStatsProps) => {
    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    return (
        <View style={statsContainerStyle}>
            <View style={statItemStyle}>
                <FontAwesome name="clock-o" size={16} color="#aaa" />
                <Text style={styles.statValue}>{formatTime(elapsedTime)}</Text>
            </View>
            <View style={statItemStyle}>
                <FontAwesome5 name="weight-hanging" size={16} color="#aaa" />
                <Text style={styles.statValue}>{Math.round(totalLoad).toLocaleString('pt-BR')} kg</Text>
            </View>
        </View>
    );
};

const statsContainerStyle = {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    justifyContent: 'flex-start' as const,
    gap: 20,
    paddingVertical: 15,
    paddingHorizontal: 15,
    backgroundColor: '#0B0D10',
};

const statItemStyle = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    backgroundColor: 'transparent',
    justifyContent: 'center' as const,
    flex: 1,
};

const styles = StyleSheet.create({
    statValue: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
