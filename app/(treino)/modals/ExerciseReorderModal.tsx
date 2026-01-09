import { LoggedExercise } from '@/app/(treino)/LoggingDuringWorkout';
import { VideoListItem } from '@/components/VideoListItem';
import { Exercicio } from '@/models/exercicio';
import { FontAwesome } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

interface ExerciseReorderModalProps {
    visible: boolean;
    onClose: () => void;
    exercises: (Exercicio | LoggedExercise)[];
    onSave: (newOrder: (Exercicio | LoggedExercise)[]) => void;
}

export const ExerciseReorderModal = ({ visible, onClose, exercises, onSave }: ExerciseReorderModalProps) => {
    const [data, setData] = useState<(Exercicio | LoggedExercise)[]>(exercises);

    useEffect(() => {
        setData(exercises);
    }, [exercises]);

    const handleSave = () => {
        onSave(data);
        onClose();
    };

    const renderItem = ({ item, drag, isActive, getIndex }: RenderItemParams<Exercicio | LoggedExercise>) => {
        const totalSets = item.series.length;
        const completedSets = item.series.filter(s => s.concluido).length;
        const isLoggedExercise = 'concluido' in (item.series[0] || {});

        return (
            <ScaleDecorator>
                <TouchableOpacity
                    onLongPress={drag}
                    disabled={isActive}
                    style={[styles.itemContainer, isActive && styles.activeItem]}
                >
                    <View style={styles.itemLeft}>
                        <View style={styles.dragHandle}>
                            <FontAwesome name="bars" size={20} color="#888" />
                        </View>

                        {item.modelo?.imagemUrl ? (
                            <VideoListItem uri={item.modelo.imagemUrl} style={styles.thumbnail} />
                        ) : (
                            <View style={[styles.thumbnail, { backgroundColor: '#333' }]} />
                        )}

                        <View style={styles.itemInfo}>
                            <Text style={styles.itemName} numberOfLines={1}>{item.modelo?.nome || 'Exercício'}</Text>
                            <Text style={styles.itemStatus}>
                                {isLoggedExercise
                                    ? `${completedSets}/${totalSets} séries concluídas`
                                    : `${totalSets} séries`
                                }
                            </Text>
                        </View>
                    </View>
                </TouchableOpacity>
            </ScaleDecorator>
        );
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#111' }}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose} style={styles.headerButton}>
                        <Text style={styles.headerButtonText}>Cancelar</Text>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Reordenar</Text>
                    <TouchableOpacity onPress={handleSave} style={styles.headerButton}>
                        <Text style={[styles.headerButtonText, { color: '#3B82F6', fontWeight: 'bold' }]}>Salvar</Text>
                    </TouchableOpacity>
                </View>

                <DraggableFlatList
                    data={data}
                    onDragEnd={({ data }) => setData(data)}
                    keyExtractor={(item, index) => `${item.modeloId}-${index}`}
                    renderItem={renderItem}
                    containerStyle={styles.listContainer}
                />
            </GestureHandlerRootView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#222',
        backgroundColor: '#111',
    },
    headerTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    headerButton: {
        padding: 8,
    },
    headerButtonText: {
        color: '#888',
        fontSize: 16,
    },
    listContainer: {
        flex: 1,
    },
    itemContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        backgroundColor: '#1A1A1A',
        marginBottom: 8,
        marginHorizontal: 16,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#333',
    },
    activeItem: {
        borderColor: '#3B82F6',
        backgroundColor: '#252525',
    },
    itemLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    dragHandle: {
        padding: 8,
        marginRight: 8,
    },
    thumbnail: {
        width: 50,
        height: 50,
        borderRadius: 6,
        backgroundColor: '#333',
        marginRight: 12,
        overflow: 'hidden',
    },
    itemInfo: {
        flex: 1,
    },
    itemName: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4,
    },
    itemStatus: {
        color: '#888',
        fontSize: 13,
    },
});
