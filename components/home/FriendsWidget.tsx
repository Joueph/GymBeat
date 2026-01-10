
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAmigosData } from '../../hooks/useAmigosData';
import { FriendListItem } from '../amigos/FriendListItem';

export const FriendsWidget = () => {
    const { friends, loading } = useAmigosData();

    if (loading) {
        return (
            <View style={styles.container}>
                <Text style={styles.loadingText}>Carregando atividade dos amigos...</Text>
            </View>
        );
    }

    if (friends.length === 0) {
        return (
            <View style={styles.container}>
                <Text style={styles.emptyText}>Adicione amigos para ver a atividade deles aqui!</Text>
            </View>
        );
    }

    // Sort friends by who trained most recently (or just use default order which is usually alphabetical or ID based, 
    // but typically activity feed should be recency based. For now, let's trust the order from hook or just list them).
    // The hook creates `friends` based on the map keys. Let's just render them. 
    // We limit to 5 to avoid clogging the home screen.
    const displayFriends = friends.slice(0, 5);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Atividade dos Amigos</Text>
            </View>
            <View>
                {displayFriends.map(friend => (
                    <FriendListItem key={friend.id} item={friend} />
                ))}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: 0,
        paddingTop: 16,
        paddingHorizontal: 0,
        marginHorizontal: 0,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
        paddingHorizontal: 0,
    },
    title: {
        fontSize: 18, fontWeight: 'bold', color: '#EAEAEA', opacity: 0.7,
    },

    loadingText: {
        color: '#888',
        textAlign: 'center',
        marginTop: 10,
    },
    emptyText: {
        color: '#888',
        textAlign: 'center',
        marginTop: 10,
        fontStyle: 'italic',
    }
});
