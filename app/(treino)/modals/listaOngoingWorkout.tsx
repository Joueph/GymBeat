import { Exercicio } from '@/models/exercicio';
import { Treino } from '@/models/treino';
import { FontAwesome } from '@expo/vector-icons';
import React from 'react';
import { FlatList, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface OngoingWorkoutListModalProps {
    visible: boolean;
    onClose: () => void;
    treino: Treino | null;
    currentExerciseIndex: number;
    onEditExercise: (exercise: Exercicio) => void;
}

const ExerciseProgressItem = ({ item, index, currentExerciseIndex, totalExercises, onEdit }: {
    item: Exercicio;
    index: number;
    currentExerciseIndex: number;
    totalExercises: number;
    onEdit: (exercise: Exercicio) => void;
}) => {
    const isCompleted = index < currentExerciseIndex;
    const isCurrent = index === currentExerciseIndex;

    const TopTrack = () => <View style={{ position: 'absolute', top: 0, bottom: '50%', width: 2, backgroundColor: (isCompleted || isCurrent) ? '#1cb0f6' : '#333', opacity: index === 0 ? 0 : 1, }} />;
    const BottomTrack = () => <View style={{ position: 'absolute', top: '50%', bottom: 0, width: 2, backgroundColor: isCompleted ? '#1cb0f6' : '#333', opacity: index === totalExercises - 1 ? 0 : 1, }} />;

    return (
        <View style={styles.progressListItem}>
            <View style={styles.timelineContainer}>
                <TopTrack />
                <BottomTrack />
                <View style={[styles.timelineDot, isCompleted && styles.completedDot, isCurrent && styles.currentDot]} />
            </View>
            <View style={styles.exerciseContent}>
                <Text style={[styles.modalExerciseName, isCompleted && { textDecorationLine: 'line-through', opacity: 0.7 }]}>
                    {item.modelo.nome}
                </Text>
                <Text style={styles.modalExerciseDetails}>
                    {item.series.filter(s => (s.type || 'normal') === 'normal').length} séries
                    {item.series.filter(s => s.type === 'dropset').length > 0 ? ` + ${item.series.filter(s => s.type === 'dropset').length} dropsets` : null}
                </Text>
            </View>
            <TouchableOpacity style={styles.editListButton} onPress={() => onEdit(item)}>
                <FontAwesome name="pencil" size={20} color="#888" />
            </TouchableOpacity>
        </View>
    );
};

export const OngoingWorkoutListModal = ({ visible, onClose, treino, currentExerciseIndex, onEditExercise }: OngoingWorkoutListModalProps) => {
    if (!treino) return null;

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <SafeAreaView style={styles.modalSafeArea}>
                <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Lista de Exercícios</Text>
                    <TouchableOpacity onPress={onClose}>
                        <FontAwesome name="close" size={24} color="#fff" />
                    </TouchableOpacity>
                </View>
                <FlatList
                    data={treino.exercicios}
                    keyExtractor={(item, index) => `exercicio-lista-${index}`}
                    renderItem={({ item, index }) => (
                        <ExerciseProgressItem
                            item={item}
                            index={index}
                            currentExerciseIndex={currentExerciseIndex}
                            totalExercises={treino.exercicios.length}
                            onEdit={onEditExercise}
                        />
                    )}
                    contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20 }}
                />
            </SafeAreaView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalSafeArea: { flex: 1, backgroundColor: '#141414' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#222', marginBottom: 20 },
    modalTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
    progressListItem: { flexDirection: 'row', alignItems: 'center', minHeight: 80 },
    timelineContainer: { width: 30, alignItems: 'center', alignSelf: 'stretch' },
    timelineDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#333', position: 'absolute', top: 24 },
    exerciseContent: { flex: 1, paddingLeft: 10, paddingTop: 20, paddingBottom: 20 },
    completedDot: { backgroundColor: '#1cb0f6' },
    currentDot: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#0d181c', borderWidth: 3, borderColor: '#1cb0f6', top: 21 },
    modalExerciseName: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
    modalExerciseDetails: { color: '#aaa', fontSize: 14, marginTop: 4 },
    editListButton: {
        padding: 15,
        alignSelf: 'center',
    },
});