import { FontAwesome } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface ImagePostCardProps {
    imageUri: string;
    duration: string;
    exercisesCount: number;
    muscles: string[];
    trainingName: string;
}

export const ImagePostCard = ({ imageUri, duration, exercisesCount, muscles, trainingName }: ImagePostCardProps) => {
    return (
        <View style={styles.postPreviewCard}>
            <Image
                source={{ uri: imageUri }}
                style={styles.postImageBackground}
                contentFit="cover"
            />
            <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.9)']}
                locations={[0, 0.5, 1]}
                style={styles.postOverlay}
            >
                <View>
                    <Text style={styles.postSubtitle}>TREINO CONCLUÍDO</Text>
                    <Text style={styles.postTitle} numberOfLines={2}>
                        {trainingName || 'Treino Sem Nome'}
                    </Text>

                    <View style={styles.postStatsRow}>
                        <View style={styles.postStatItem}>
                            <FontAwesome name="clock-o" size={14} color="#3B82F6" />
                            <Text style={styles.postStatText}>{duration}</Text>
                        </View>
                        <View style={styles.separator} />
                        <View style={styles.postStatItem}>
                            <FontAwesome name="trophy" size={14} color="#3B82F6" />
                            <Text style={styles.postStatText}>{exercisesCount} Exercícios</Text>
                        </View>
                    </View>
                    <Text style={styles.postMusclesText}>{muscles.join(' • ')}</Text>
                </View>
            </LinearGradient>
        </View>
    );
};

const styles = StyleSheet.create({
    postPreviewCard: {
        width: '100%',
        aspectRatio: 4 / 5,
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: '#1A1D23',
        marginBottom: 20,
        position: 'relative',
    },
    postImageBackground: {
        ...StyleSheet.absoluteFillObject,
    },
    postOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'flex-end',
        padding: 20,
        paddingBottom: 25,
    },
    postTitle: {
        color: '#fff',
        fontSize: 32,
        fontWeight: 'bold',
        marginBottom: 15,
        lineHeight: 36,
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4,
    },
    postSubtitle: {
        color: '#3B82F6',
        fontSize: 12,
        fontWeight: '700',
        marginBottom: 8,
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
    postStatsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 15,
        marginBottom: 8,
    },
    postStatItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    separator: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#fff',
        opacity: 0.5,
    },
    postStatText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    postMusclesText: {
        color: '#ccc',
        fontSize: 14,
        textTransform: 'capitalize'
    },
});
