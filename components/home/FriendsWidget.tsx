
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAmigosData } from '../../hooks/useAmigosData';
import { FriendListItem } from '../amigos/FriendListItem';
import { FriendsSelectionModal } from './FriendsSelectionModal';

const STORAGE_KEY_SELECTED_FRIENDS = 'friendsWidgetSelection';

export const FriendsWidget = () => {
    const { friends, loading } = useAmigosData();
    const [isModalVisible, setModalVisible] = useState(false);
    const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        loadSelection();
    }, []);

    const loadSelection = async () => {
        try {
            const stored = await AsyncStorage.getItem(STORAGE_KEY_SELECTED_FRIENDS);
            if (stored) {
                setSelectedFriendIds(JSON.parse(stored));
            }
        } catch (e) {
            console.warn('Failed to load friends selection', e);
        } finally {
            setIsLoaded(true);
        }
    };

    const handleSaveSelection = async (ids: string[]) => {
        console.log('[FriendsWidget] Saving selection:', ids);
        setSelectedFriendIds(ids);
        try {
            await AsyncStorage.setItem(STORAGE_KEY_SELECTED_FRIENDS, JSON.stringify(ids));
        } catch (e) {
            console.warn('Failed to save friends selection', e);
        }
    };

    if (loading || !isLoaded) {
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

    // Filter display logic:
    // If specific friends are selected, show ONLY them.
    // If NO friends are selected, show default (top 5).
    let displayFriends = friends;
    if (selectedFriendIds.length > 0) {
        // Map ids to friends to preserve order
        displayFriends = selectedFriendIds
            .map(id => friends.find(f => f.id === id))
            .filter((f): f is typeof friends[0] => f !== undefined);

        console.log('[FriendsWidget] Filtering. Selected:', selectedFriendIds.length, 'Matched:', displayFriends.length);
    } else {
        displayFriends = friends.slice(0, 5);
        console.log('[FriendsWidget] No selection, showing default 5');
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Atividade dos Amigos</Text>
                <TouchableOpacity onPress={() => setModalVisible(true)}>
                    <Text style={styles.editButton}>Editar</Text>
                </TouchableOpacity>
            </View>
            <View>
                {displayFriends.length > 0 ? (
                    displayFriends.map(friend => (
                        <FriendListItem key={friend.id} item={friend} />
                    ))
                ) : (
                    <Text style={styles.emptySelectionText}>Nenhum dos amigos selecionados foi encontrado (talvez tenham sido removidos?).</Text>
                )}
            </View>

            <FriendsSelectionModal
                visible={isModalVisible}
                onClose={() => setModalVisible(false)}
                allFriends={friends}
                initialSelection={selectedFriendIds}
                onSave={handleSaveSelection}
            />
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
    editButton: {
        color: '#3B82F6',
        fontSize: 14,
        fontWeight: '600',
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
    },
    emptySelectionText: {
        color: '#666',
        textAlign: 'center',
        marginTop: 10,
        fontSize: 12,
    }
});
