import { FontAwesome } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ScaleDecorator } from 'react-native-draggable-flatlist';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Treino } from '../../models/treino';

interface WorkoutItemProps {
    id: string;
    data: Treino;
    index: number;
    isActive: boolean;
    onPress: (treinoId: string, fichaId?: string) => void;
    drag: () => void;
}

export function WorkoutItem({ id, data, index, isActive, onPress, drag }: WorkoutItemProps) {
    return (
        <Animated.View entering={FadeInUp.duration(300).delay(index * 50)}>
            <ScaleDecorator>
                <TouchableOpacity
                    onLongPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        drag();
                    }}
                    disabled={isActive}
                    style={[styles.workoutCard, { opacity: isActive ? 0.5 : 1 }]}
                    onPress={() => onPress(id, data.fichaId || undefined)}
                >
                    <View style={styles.workoutCardContent}>
                        <Text style={styles.workoutCardTitle}>{data.nome}</Text>
                        <Text style={styles.workoutCardSubtitle}>
                            {data.diasSemana.length > 0
                                ? data.diasSemana.join(', ').toUpperCase()
                                : 'Sem dia definido'}
                        </Text>
                    </View>
                    <FontAwesome name="chevron-right" size={18} color="#555" />
                </TouchableOpacity>
            </ScaleDecorator>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    workoutCard: {
        marginTop: 8,
        backgroundColor: '#1A1D23',
        borderRadius: 25,
        paddingVertical: 15,
        height: 72,
        paddingHorizontal: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginVertical: 5,
        borderWidth: 0.5,
        borderColor: '#2A2E37',
    },
    workoutCardContent: {
        flex: 1,
    },
    workoutCardTitle: {
        color: '#FBFBFB',
        fontSize: 16,
        fontWeight: '600',
    },
    workoutCardSubtitle: {
        color: '#FBFBFB',
        fontSize: 10,
        fontWeight: '300',
        opacity: 0.7,
        marginTop: 4,
    },
});
