import { Treino } from '@/models/treino';
import { FontAwesome5 } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface MuscleGroupsRowProps {
    treino: Treino;
    transparent?: boolean;
}

export const MuscleGroupsRow: React.FC<MuscleGroupsRowProps> = ({ treino, transparent }) => {
    const muscles = useMemo(() => {
        if (!treino.exercicios) return '';
        const groups = new Set<string>();
        treino.exercicios.forEach(ex => {
            if (ex.modelo?.grupoMuscular) {
                groups.add(ex.modelo.grupoMuscular);
            }
        });
        return Array.from(groups).join(', ');
    }, [treino]);

    if (!muscles) return null;

    return (
        <View style={[styles.container, transparent && styles.transparent]}>
            <View style={styles.iconContainer}>
                <FontAwesome5 name="dumbbell" size={16} color="#888" />
            </View>
            <View style={styles.contentContainer}>
                <Text style={styles.label}>Grupos Musculares</Text>
                <Text style={styles.value} numberOfLines={2}>{muscles}</Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#ffffff1a',
    },
    transparent: {
        backgroundColor: 'transparent',
        borderWidth: 0,
        marginBottom: 0,
    },
    iconContainer: {
        width: 32,
        alignItems: 'center',
        marginRight: 12,
    },
    contentContainer: {
        flex: 1,
    },
    label: {
        color: '#888',
        fontSize: 12,
        textTransform: 'uppercase',
        fontWeight: '600',
        marginBottom: 2,
    },
    value: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '500',
    },
});
