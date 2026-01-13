import { FontAwesome } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FriendData } from './FriendListItem';

interface FriendsHorizontalWidgetProps {
    friends: FriendData[];
    onAddFriendPress?: () => void;
    onFriendPress?: (friend: FriendData) => void;
}

const CARD_SIZE = 100; // 1:1 Aspect Ratio

export const FriendsHorizontalWidget = ({ friends, onAddFriendPress, onFriendPress }: FriendsHorizontalWidgetProps) => {
    const router = useRouter();

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Meus Amigos</Text>
            <FlatList
                data={[...friends, { id: 'add_friend_card' } as any]}
                keyExtractor={(item) => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.listContent}
                renderItem={({ item }) => {
                    if (item.id === 'add_friend_card') {
                        return (
                            <TouchableOpacity style={styles.addCard} onPress={onAddFriendPress}>
                                <FontAwesome name="plus" size={24} color="#888" />
                                <Text style={styles.addText}>Adicionar</Text>
                            </TouchableOpacity>
                        );
                    }

                    const friend = item as FriendData;
                    return (
                        <TouchableOpacity style={styles.card} onPress={() => onFriendPress?.(friend)}>
                            <Image
                                source={friend.photoURL ? { uri: friend.photoURL } : require('../../assets/images/icon.png')}
                                style={styles.image}
                                contentFit="cover"
                            />
                            <LinearGradient
                                colors={['transparent', 'rgba(0,0,0,0.8)']}
                                style={styles.overlay}
                            >
                                <Text style={styles.name} numberOfLines={1}>{friend.nome}</Text>
                            </LinearGradient>
                            {/* Online/Status Indicator logic could go here if we tracked online status */}
                            {friend.hasTrainedToday && (
                                <View style={styles.statusIndicator} />
                            )}
                        </TouchableOpacity>
                    );
                }}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: 20,
        width: '100%',
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 10,
        paddingHorizontal: 16,
    },
    listContent: {
        paddingHorizontal: 16,
        gap: 12,
    },
    card: {
        width: CARD_SIZE,
        height: CARD_SIZE,
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: '#1A1D23',
        borderWidth: 1,
        borderColor: '#333',
    },
    image: {
        width: '100%',
        height: '100%',
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'flex-end',
        padding: 8,
    },
    name: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 12,
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    addCard: {
        width: CARD_SIZE,
        height: CARD_SIZE,
        borderRadius: 16,
        backgroundColor: '#1A1D23',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#333',
        borderStyle: 'dashed',
    },
    addText: {
        color: '#888',
        fontSize: 12,
        marginTop: 4,
        fontWeight: '500',
    },
    statusIndicator: {
        position: 'absolute',
        top: 8,
        right: 8,
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#4ADE80', // Green for "Trained Today" or generic status
        borderWidth: 1.5,
        borderColor: '#1A1D23',
    }
});
