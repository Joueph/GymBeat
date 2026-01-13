import { FontAwesome } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getLogsByUsuarioId } from '../../services/logService';
import { getRecentPosts } from '../../services/postService';
import { getTreinosByUsuarioId } from '../../services/treinoService';
import { ActivityCalendar } from '../ActivityCalendar';
import { FriendData } from './FriendListItem';
import { PerfilCard } from './PerfilCard';
import { PostFeedWidget } from './PostFeedWidget';

interface FriendDetailsModalProps {
    visible: boolean;
    onClose: () => void;
    friend: FriendData | null;
    onRemoveFriend: (friendId: string) => void;
}

const toDate = (date: any): Date | null => {
    if (!date) return null;
    if (typeof date.toDate === 'function') return date.toDate();
    const d = new Date(date);
    return isNaN(d.getTime()) ? null : d;
};

export const FriendDetailsModal = ({ visible, onClose, friend, onRemoveFriend }: FriendDetailsModalProps) => {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        friendsCount: 0,
        workoutsCount: 0,
        postsCount: 0
    });
    const [loggedDays, setLoggedDays] = useState<Set<string>>(new Set());
    const [showOptions, setShowOptions] = useState(false);

    useEffect(() => {
        if (visible && friend) {
            loadStats();
        } else {
            // Reset state when closing/changing
            setShowOptions(false);
            setLoading(true);
            setLoggedDays(new Set());
        }
    }, [visible, friend]);

    const loadStats = async () => {
        if (!friend) return;
        setLoading(true);
        try {
            const [workouts, posts, logs] = await Promise.all([
                getTreinosByUsuarioId(friend.id),
                getRecentPosts('mine', friend.id),
                getLogsByUsuarioId(friend.id)
            ]);

            setStats({
                friendsCount: friend.amizades ? Object.keys(friend.amizades).length : 0,
                workoutsCount: workouts.length,
                postsCount: posts.length
            });

            const logsSet = new Set(logs.map(log => toDate(log.horarioFim)?.toDateString()).filter((d): d is string => d !== null));
            setLoggedDays(logsSet);

        } catch (error) {
            console.error("Error loading friend stats:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleRemovePress = () => {
        if (!friend) return;

        Alert.alert(
            "Remover amigo",
            `Tem certeza que deseja remover ${friend.nome} dos seus amigos?`,
            [
                { text: "Cancelar", style: "cancel" },
                {
                    text: "Remover",
                    style: "destructive",
                    onPress: () => {
                        onRemoveFriend(friend.id);
                        onClose();
                    }
                }
            ]
        );
    };

    if (!friend) return null;

    return (
        <Modal
            visible={visible}
            transparent={false} // Full screen
            animationType="slide"
            onRequestClose={onClose}
            presentationStyle="pageSheet" // Nice iOS effect
        >
            <View style={styles.container}>
                <SafeAreaView style={{ flex: 1 }} edges={['top']}>
                    <View style={styles.header}>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <FontAwesome name="chevron-down" size={20} color="#ccc" />
                        </TouchableOpacity>
                        <View style={{ flex: 1 }} />
                        {/* Right side options or empty */}
                    </View>

                    {loading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color="#fff" />
                        </View>
                    ) : (
                        <ScrollView contentContainerStyle={styles.scrollContent}>
                            <View style={styles.cardContainer}>
                                <PerfilCard
                                    user={friend}
                                    friendsCount={stats.friendsCount}
                                    workoutsCount={stats.workoutsCount}
                                    postsCount={stats.postsCount}
                                    onPress={() => { }} // Disable navigation
                                    actionButton={
                                        <TouchableOpacity onPress={() => setShowOptions(!showOptions)} style={{ padding: 5 }}>
                                            <FontAwesome name="ellipsis-v" size={18} color="#fff" />
                                        </TouchableOpacity>
                                    }
                                />
                            </View>

                            {showOptions && (
                                <View style={styles.optionsPopup}>
                                    <TouchableOpacity style={styles.optionItem} onPress={handleRemovePress}>
                                        <FontAwesome name="user-times" size={16} color="#EF4444" />
                                        <Text style={styles.optionText}>Remover amigo</Text>
                                    </TouchableOpacity>
                                </View>
                            )}

                            <Text style={styles.sectionTitle}>Atividade Mensal</Text>
                            <ActivityCalendar loggedDays={loggedDays} />

                            <View style={styles.feedContainer}>
                                <PostFeedWidget targetUserId={friend.id} />
                            </View>

                        </ScrollView>
                    )}
                </SafeAreaView>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#030405',
    },
    header: {
        flexDirection: 'row',
        padding: 16,
        alignItems: 'center',
    },
    closeButton: {
        padding: 8,
        backgroundColor: '#1A1D23',
        borderRadius: 20,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scrollContent: {
        padding: 16,
        paddingTop: 0,
    },
    cardContainer: {
        marginBottom: 20,
        marginHorizontal: 0, // Override PerfilCard margin if needed, or pass style prop
    },
    // Keep options logic or change to ActionSheet if preferred.
    // Since we are full screen, absolute positioning works but verify zIndex context.
    optionsPopup: {
        position: 'absolute',
        top: 60, // Adjust
        right: 30,
        backgroundColor: '#1A1D23',
        borderRadius: 8,
        padding: 5,
        borderWidth: 1,
        borderColor: '#333',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
        zIndex: 100,
    },
    optionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
        gap: 10,
    },
    optionText: {
        color: '#EF4444',
        fontWeight: 'bold',
        fontSize: 14,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 10,
        marginTop: 20,
    },
    feedContainer: {
        marginTop: 20,
        paddingBottom: 40,
    }
});
