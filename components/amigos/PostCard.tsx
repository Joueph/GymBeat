import { FontAwesome } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Dimensions, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Post } from '../../models/post';
import { Usuario } from '../../models/usuario';
import { getUserProfile } from '../../userService';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = SCREEN_WIDTH * 0.9;

interface PostCardProps {
    post: Post;
    currentUserId: string;
    onDelete?: (postId: string) => void;
    onLike?: (postId: string, userId: string) => void;
    onShare?: (postId: string) => void;
}

const formatDuration = (totalSeconds: number) => {
    if (isNaN(totalSeconds) || totalSeconds < 0) return '00:00';
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

export const PostCard = ({ post, currentUserId, onDelete, onLike }: PostCardProps) => {
    const { stats, imageUrl, usuarioId, likes = [] } = post;
    const muscles = stats.muscles || [];

    const [userProfile, setUserProfile] = useState<Usuario | null>(null);
    const [isLiked, setIsLiked] = useState(likes.includes(currentUserId));
    const [likeCount, setLikeCount] = useState(likes.length);
    const router = useRouter();

    // Denormalized data
    const displayName = userProfile?.nome || post.userName || 'Usuário';
    const displayPhoto = userProfile?.photoURL || post.userPhotoUrl;

    useEffect(() => {
        // Optimization: Use denormalized data if available to avoid unnecessary (and potentially restricted) DB calls
        if (post.userName && post.userPhotoUrl) {
            return;
        }

        const fetchUser = async () => {
            try {
                const profile = await getUserProfile(usuarioId);
                setUserProfile(profile);
            } catch (e: any) {
                // Ignore permission errors as they are expected for non-friends
                if (e.code !== 'permission-denied') {
                    console.warn("Failed to load user for post", e);
                }
            }
        };
        fetchUser();
    }, [usuarioId, post.userName, post.userPhotoUrl]);

    const handleLike = () => {
        const newLikedState = !isLiked;
        setIsLiked(newLikedState);
        setLikeCount(prev => newLikedState ? prev + 1 : prev - 1);
        if (onLike) onLike(post.id, currentUserId); // Optimistic, parent handles DB
    };

    const handleShare = async () => {
        try {
            await Share.share({
                message: `Confira o treino de ${displayName} no GymBeat!`,
                title: 'Compartilhar Treino'
            });
        } catch (error) {
            console.error("Error sharing", error);
        }
    };

    const handleDelete = () => {
        Alert.alert(
            "Deletar Post",
            "Tem certeza que deseja apagar este post?",
            [
                { text: "Cancelar", style: "cancel" },
                { text: "Deletar", style: "destructive", onPress: () => onDelete && onDelete(post.id) }
            ]
        );
    };

    const renderHeader = () => (
        <View style={styles.header}>
            <TouchableOpacity style={styles.userInfo} onPress={() => {/* Navigate to profile? */ }}>
                <Image
                    source={displayPhoto ? { uri: displayPhoto } : require('../../assets/images/icon.png')}
                    style={styles.avatar}
                    contentFit="cover"
                />
                <View>
                    <Text style={styles.username}>{displayName}</Text>
                    <Text style={styles.timestamp}>{new Date(post.createdAt?.toDate ? post.createdAt.toDate() : post.createdAt).toLocaleDateString()}</Text>
                </View>
            </TouchableOpacity>
            {/* Add Friend / Follow Action could go here */}
        </View>
    );

    const renderFooter = () => (
        <View style={styles.footer}>
            <View style={styles.actionsLeft}>
                <TouchableOpacity style={styles.actionButton} onPress={handleLike}>
                    <FontAwesome name={isLiked ? "heart" : "heart-o"} size={20} color={isLiked ? "#E25563" : "#ccc"} />
                    <Text style={styles.actionText}>{likeCount}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
                    <FontAwesome name="share" size={20} color="#ccc" />
                    <Text style={styles.actionText}>Compartilhar</Text>
                </TouchableOpacity>
            </View>
            {currentUserId === usuarioId && (
                <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
                    <FontAwesome name="trash" size={18} color="#EF4444" />
                </TouchableOpacity>
            )}
        </View>
    );


    // Render Content based on image presence
    const renderCardContent = () => {
        if (imageUrl) {
            return (
                <View style={styles.postPreviewCard}>
                    <Image source={{ uri: imageUrl }} style={styles.postImageBackground} contentFit="cover" />
                    <LinearGradient
                        colors={['transparent', 'rgba(0,0,0,0.8)']}
                        style={styles.postOverlay}
                    >
                        <View>
                            <Text style={styles.postTitle}>TREINO CONCLUÍDO</Text>
                            <View style={styles.postStatsRow}>
                                <View style={styles.postStatItem}>
                                    <FontAwesome name="clock-o" size={14} color="#3B82F6" />
                                    <Text style={styles.postStatText}>{formatDuration(stats.duration)}</Text>
                                </View>
                                <View style={styles.postStatItem}>
                                    <FontAwesome name="trophy" size={14} color="#3B82F6" />
                                    <Text style={styles.postStatText}>{stats.exercisesCount} Exercícios</Text>
                                </View>
                            </View>
                            <Text style={styles.postMusclesText}>{muscles.join(' • ')}</Text>
                        </View>
                    </LinearGradient>
                </View>
            );
        }

        return (
            <View style={[styles.postPreviewCard, styles.defaultCard]}>
                <View style={styles.cardHeader}>
                    <Image source={require('../../assets/images/icon.png')} style={{ width: 40, height: 40, borderRadius: 8 }} contentFit="contain" />
                </View>
                <View style={styles.cardBody}>
                    <Text style={styles.cardTitle}>TREINO CONCLUÍDO</Text>
                    <View style={styles.cardStatsGrid}>
                        <View style={styles.cardStatBox}>
                            <Text style={styles.cardStatValue}>{formatDuration(stats.duration)}</Text>
                            <Text style={styles.cardStatLabel}>Tempo</Text>
                        </View>
                        <View style={styles.cardStatBox}>
                            <Text style={styles.cardStatValue}>{stats.exercisesCount}</Text>
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

    return (
        <View style={styles.cardContainer}>
            {renderHeader()}
            {renderCardContent()}
            {renderFooter()}
        </View>
    );
};

const styles = StyleSheet.create({
    cardContainer: {
        marginBottom: 20,
        width: '100%',
        alignItems: 'center',
    },
    header: {
        width: CARD_WIDTH,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    userInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#333',
    },
    username: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
    timestamp: {
        color: '#888',
        fontSize: 12,
    },
    footer: {
        width: CARD_WIDTH,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 10,
    },
    actionsLeft: {
        flexDirection: 'row',
        gap: 20,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    actionText: {
        color: '#ccc',
        fontSize: 14,
    },
    deleteButton: {
        padding: 5,
    },
    postPreviewCard: {
        width: CARD_WIDTH,
        aspectRatio: 4 / 5,
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: '#000',
        borderWidth: 1,
        borderColor: '#333',
    },
    defaultCard: {
        backgroundColor: '#0B0D10', // App Background Color
        justifyContent: 'space-between',
        padding: 20,
        alignItems: 'center',
        borderWidth: 0.5,
        borderColor: '#2A2E37',
    },
    postImageBackground: {
        width: '100%',
        height: '100%',
    },
    postOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'flex-end',
        padding: 20,
    },
    postTitle: {
        color: '#fff',
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 10,
        textTransform: 'uppercase',
    },
    postStatsRow: {
        flexDirection: 'row',
        gap: 15,
        marginBottom: 8,
    },
    postStatItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    postStatText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: 'bold',
    },
    postMusclesText: {
        color: '#ccc',
        fontSize: 14,
        marginTop: 5,
    },

    // Default Card specific styles
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
        fontSize: 22,
        fontWeight: 'bold',
        marginBottom: 20,
        textTransform: 'uppercase',
    },
    cardStatsGrid: {
        flexDirection: 'row',
        gap: 20,
        marginBottom: 20,
    },
    cardStatBox: {
        alignItems: 'center',
        padding: 10,
        borderRadius: 8,
        backgroundColor: '#1A1D23',
        minWidth: 80,
    },
    cardStatValue: {
        color: '#3B82F6',
        fontSize: 20,
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
