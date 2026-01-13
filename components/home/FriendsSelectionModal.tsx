import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { FlatList, Image, Modal, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { FriendData } from '../amigos/FriendListItem';

type FriendsSelectionModalProps = {
    visible: boolean;
    onClose: () => void;
    allFriends: FriendData[];
    initialSelection: string[];
    onSave: (selectedIds: string[]) => void;
};

export const FriendsSelectionModal: React.FC<FriendsSelectionModalProps> = ({ visible, onClose, allFriends, initialSelection, onSave }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    useEffect(() => {
        if (visible) {
            setSelectedIds(initialSelection);
            setSearchQuery('');
        }
    }, [visible, initialSelection]);

    const handleToggleSelection = (friendId: string) => {
        if (selectedIds.includes(friendId)) {
            setSelectedIds(prev => prev.filter(id => id !== friendId));
        } else {
            if (selectedIds.length >= 4) {
                // Determine if we should alert or just ignore. For a smooth UI, maybe just ignore or shake.
                return;
            }
            setSelectedIds(prev => [...prev, friendId]);
        }
    };

    const handleSave = () => {
        onSave(selectedIds);
        onClose();
    };

    const filteredFriends = allFriends.filter(friend =>
        friend.nome.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Separate selected friends to show them in the grid/list at the top if needed, 
    // or just mark them in the main list. 
    // The requirement says: "1:4 grid with the chosen people with the hability to remove" 
    // AND "list with all frienda / search results".

    // Map IDs to friend objects to preserve order for the draggable list
    const selectedFriendsData = selectedIds
        .map(id => allFriends.find(f => f.id === id))
        .filter((f): f is FriendData => f !== undefined);

    const renderSelectedFriend = ({ item, drag, isActive }: RenderItemParams<FriendData>) => {
        return (
            <ScaleDecorator>
                <TouchableOpacity
                    onLongPress={drag}
                    disabled={isActive}
                    delayLongPress={200}
                    style={[styles.selectedItem, isActive && { opacity: 0.7 }]}
                >
                    <View style={styles.selectedAvatarContainer}>
                        {item.photoURL ? (
                            <Image source={{ uri: item.photoURL }} style={styles.selectedAvatar} />
                        ) : (
                            <View style={[styles.selectedAvatar, styles.placeholderAvatar]}>
                                <Ionicons name="person" size={24} color="#555" />
                            </View>
                        )}
                        <TouchableOpacity
                            style={styles.removeButton}
                            onPress={() => handleToggleSelection(item.id)}
                        >
                            <Ionicons name="close" size={12} color="#fff" />
                        </TouchableOpacity>
                    </View>
                    <Text style={styles.selectedName} numberOfLines={1}>{item.nome.split(' ')[0]}</Text>
                </TouchableOpacity>
            </ScaleDecorator>
        );
    };

    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <TouchableWithoutFeedback onPress={onClose}>
                <View style={styles.modalOverlay} />
            </TouchableWithoutFeedback>

            <View style={styles.modalContent}>
                <GestureHandlerRootView style={{ flex: 1 }}>
                    <View style={styles.header}>
                        <View style={styles.handle} />
                        <View style={styles.headerTopRow}>
                            <Text style={styles.title}>Editar Amigos (Max 4)</Text>
                            <TouchableOpacity onPress={handleSave} style={styles.saveButton}>
                                <Text style={styles.saveButtonText}>Salvar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Search Bar */}
                    <View style={styles.searchContainer}>
                        <Ionicons name="search" size={20} color="#888" style={styles.searchIcon} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Buscar amigos..."
                            placeholderTextColor="#888"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchQuery('')}>
                                <Ionicons name="close-circle" size={20} color="#888" />
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Selected Friends Grid (Draggable) */}
                    {selectedIds.length > 0 && (
                        <View style={styles.selectedContainer}>
                            <Text style={styles.sectionTitle}>Selecionados ({selectedIds.length}/4) - Segure para ordenar</Text>
                            <View style={{ height: 100 }}>
                                <DraggableFlatList
                                    data={selectedFriendsData}
                                    onDragEnd={({ data }) => setSelectedIds(data.map(f => f.id))}
                                    keyExtractor={(item) => item.id}
                                    renderItem={renderSelectedFriend}
                                    horizontal
                                    containerStyle={styles.selectedGrid}
                                    showsHorizontalScrollIndicator={false}
                                />
                            </View>
                        </View>
                    )}

                    {/* All Friends List */}
                    <FlatList
                        data={filteredFriends}
                        keyExtractor={item => item.id}
                        contentContainerStyle={styles.listContent}
                        renderItem={({ item }) => {
                            const isSelected = selectedIds.includes(item.id);
                            return (
                                <TouchableOpacity
                                    style={[styles.friendItem, isSelected && styles.friendItemActive]}
                                    onPress={() => handleToggleSelection(item.id)}
                                >
                                    {item.photoURL ? (
                                        <Image source={{ uri: item.photoURL }} style={styles.listAvatar} />
                                    ) : (
                                        <View style={[styles.listAvatar, styles.placeholderAvatar]}>
                                            <Ionicons name="person" size={20} color="#555" />
                                        </View>
                                    )}
                                    <Text style={[styles.listName, isSelected && styles.listNameActive]}>{item.nome}</Text>
                                    {isSelected ? (
                                        <Ionicons name="checkmark-circle" size={24} color="#3B82F6" />
                                    ) : (
                                        <Ionicons name="ellipse-outline" size={24} color="#444" />
                                    )}
                                </TouchableOpacity>
                            );
                        }}
                        ListEmptyComponent={
                            <Text style={styles.emptyText}>Nenhum amigo encontrado.</Text>
                        }
                    />
                </GestureHandlerRootView>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
    },
    modalContent: {
        flex: 1,
        marginTop: 60, // Leave some space at top
        backgroundColor: '#1A1D23',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingHorizontal: 20,
        paddingTop: 10,
    },
    header: {
        alignItems: 'center',
        marginBottom: 20,
    },
    handle: {
        width: 40,
        height: 4,
        backgroundColor: '#444',
        borderRadius: 2,
        marginBottom: 15,
    },
    headerTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
    },
    saveButton: {
        backgroundColor: '#3B82F6',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
    },
    saveButtonText: {
        color: '#fff',
        fontWeight: 'bold',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#262A32',
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 46,
        marginBottom: 20,
    },
    searchIcon: {
        marginRight: 10,
    },
    searchInput: {
        flex: 1,
        color: '#fff',
        fontSize: 16,
    },
    selectedContainer: {
        marginBottom: 20,
    },
    sectionTitle: {
        color: '#888',
        fontSize: 14,
        marginBottom: 10,
        textTransform: 'uppercase',
        fontWeight: '600',
    },
    selectedGrid: {
        flexDirection: 'row',
        gap: 15,
    },
    selectedItem: {
        width: 70,
        alignItems: 'center',
    },
    selectedAvatarContainer: {
        position: 'relative',
        marginBottom: 5,
    },
    selectedAvatar: {
        width: 60,
        height: 60,
        borderRadius: 30,
        borderWidth: 2,
        borderColor: '#3B82F6',
    },
    placeholderAvatar: {
        backgroundColor: '#333',
        justifyContent: 'center',
        alignItems: 'center',
    },
    removeButton: {
        position: 'absolute',
        top: 0,
        right: 0,
        backgroundColor: '#EF4444',
        width: 20,
        height: 20,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: '#1A1D23',
    },
    selectedName: {
        color: '#fff',
        fontSize: 12,
        textAlign: 'center',
    },
    listContent: {
        paddingBottom: 40,
    },
    friendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    friendItemActive: {
        backgroundColor: '#262A32',
        marginHorizontal: -20,
        paddingHorizontal: 20,
    },
    listAvatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        marginRight: 15,
    },
    listName: {
        flex: 1,
        color: '#ccc',
        fontSize: 16,
    },
    listNameActive: {
        color: '#fff',
        fontWeight: 'bold',
    },
    emptyText: {
        color: '#888',
        textAlign: 'center',
        marginTop: 20,
        fontStyle: 'italic',
    },
});
