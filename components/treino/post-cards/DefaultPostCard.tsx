import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface DefaultPostCardProps {
    muscles: string[];
    count: number;
    time: string;
    trainingName: string;
}

export const DefaultPostCard = ({ muscles, count, time, trainingName }: DefaultPostCardProps) => {
    return (
        <View style={[styles.postPreviewCard, styles.defaultCard]}>
            <View style={styles.cardHeader}>
                <Image
                    source={require('../../../assets/images/icon.png')}
                    style={{ width: 40, height: 40, borderRadius: 8 }}
                    contentFit="contain"
                />
            </View>
            <View style={styles.cardBody}>
                {/* Changed Hierarchy: Name is bigger, subtitle is smaller */}
                <Text style={styles.cardTitle} numberOfLines={2}>
                    {trainingName || 'Treino Sem Nome'}
                </Text>
                <Text style={styles.cardSubtitle}>TREINO CONCLUÍDO</Text>

                <View style={styles.cardStatsGrid}>
                    <View style={styles.cardStatBox}>
                        <Text style={styles.cardStatValue}>{time}</Text>
                        <Text style={styles.cardStatLabel}>Tempo</Text>
                    </View>
                    <View style={styles.cardStatBox}>
                        <Text style={styles.cardStatValue}>{count}</Text>
                        <Text style={styles.cardStatLabel}>Exercícios</Text>
                    </View>
                </View>
                <Text style={styles.cardMuscles}>{muscles.join(' • ')}</Text>
            </View>
            <View style={styles.cardFooter}>
                <Text style={styles.watermark}>@gymbeatapp</Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    postPreviewCard: {
        width: '100%',
        aspectRatio: 4 / 5,
        borderRadius: 16,
        overflow: 'hidden',
        position: 'relative',
    },
    defaultCard: {
        backgroundColor: '#0B0D10', // App Background Color
        justifyContent: 'space-between',
        padding: 20,
        alignItems: 'center',
    },
    cardHeader: {
        marginTop: 20,
        alignItems: 'center',
    },
    cardBody: {
        alignItems: 'center',
        width: '100%',
    },
    cardTitle: {
        color: '#fff',
        fontSize: 28, // Increased size
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 5,
    },
    cardSubtitle: {
        color: '#3B82F6', // Blue accent for subtitle
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 25,
        letterSpacing: 1.5,
        textTransform: 'uppercase',
    },
    cardStatsGrid: {
        flexDirection: 'row',
        gap: 20,
        marginBottom: 20,
    },
    cardStatBox: {
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 15,
        borderRadius: 8,
        backgroundColor: '#1A1D23',
        minWidth: 90,
    },
    cardStatValue: {
        color: '#3B82F6',
        fontSize: 22,
        fontWeight: 'bold',
    },
    cardStatLabel: {
        color: '#888',
        fontSize: 12,
        marginTop: 4,
    },
    cardMuscles: {
        color: '#ccc',
        fontSize: 14,
        textAlign: 'center',
        marginTop: 10,
        textTransform: 'capitalize'
    },
    cardFooter: {
        marginBottom: 10,
    },
    watermark: {
        color: '#fff',
        opacity: 0.2,
        fontSize: 14,
        fontWeight: 'bold',
    },
});
