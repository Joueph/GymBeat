
import { useAuth } from '@/app/authprovider';
import { getLogsByUsuarioId } from '@/services/logService';
import { FontAwesome, FontAwesome5 } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    KeyboardAvoidingView,
    Modal,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

interface ExerciseNotesModalProps {
    visible: boolean;
    onClose: () => void;
    exerciseId: string;
    exerciseName: string;
    currentNote: string;
    onSaveNote: (note: string) => void;
}

interface NoteHistoryItem {
    id: string; // logId
    date: Date;
    workoutName: string;
    note: string;
}

export const ExerciseNotesModal = ({
    visible,
    onClose,
    exerciseId,
    exerciseName,
    currentNote,
    onSaveNote,
}: ExerciseNotesModalProps) => {
    const { user } = useAuth();
    const [note, setNote] = useState(currentNote);
    const [history, setHistory] = useState<NoteHistoryItem[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setNote(currentNote);
    }, [currentNote]);

    useEffect(() => {
        if (visible && user?.id && exerciseId) {
            loadHistory();
        }
    }, [visible, user, exerciseId]);

    const loadHistory = async () => {
        if (!user?.id) return;
        setLoading(true);
        try {
            const logs = await getLogsByUsuarioId(user.id);
            const notesList: NoteHistoryItem[] = [];

            logs.forEach(log => {
                // Find the exercise in this log
                // Check both exerciciosFeitos (logging) and exercicios (template/plans if structured differently)
                // Usually exerciciosFeitos is the single source of truth for completed workouts
                const exercises = log.exerciciosFeitos || log.exercicios || [];

                const exercise = exercises.find(e => e.modeloId === exerciseId);

                if (exercise && exercise.notes && exercise.notes.trim().length > 0) {
                    notesList.push({
                        id: log.id,
                        date: log.horarioFim ? (log.horarioFim.toDate ? log.horarioFim.toDate() : new Date(log.horarioFim)) : (log.horarioInicio ? (log.horarioInicio.toDate ? log.horarioInicio.toDate() : new Date(log.horarioInicio)) : new Date()),
                        workoutName: typeof log.nomeTreino === 'string' ? log.nomeTreino : 'Treino',
                        note: exercise.notes
                    });
                }
            });

            // Sort by date descending
            notesList.sort((a, b) => b.date.getTime() - a.date.getTime());
            setHistory(notesList);
        } catch (error) {
            console.error("Failed to load exercise history", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = () => {
        onSaveNote(note);
        onClose();
    };

    const toDateString = (date: Date) => {
        return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
    };

    const renderItem = ({ item }: { item: NoteHistoryItem }) => (
        <View style={styles.historyCard}>
            <View style={styles.cardHeader}>
                <View style={styles.dateContainer}>
                    <FontAwesome5 name="calendar-alt" size={12} color="#888" style={{ marginRight: 6 }} />
                    <Text style={styles.dateText}>{toDateString(item.date)}</Text>
                </View>
                <Text style={styles.workoutNameText} numberOfLines={1}>{item.workoutName}</Text>
            </View>
            <Text style={styles.noteText}>{item.note}</Text>
        </View>
    );

    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <View style={styles.overlay}>
                    <BlurView intensity={20} style={StyleSheet.absoluteFill} tint="dark" />

                    <View style={styles.modalContainer}>
                        <View style={styles.header}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.title}>Anotações</Text>
                                <Text style={styles.subtitle}>{exerciseName}</Text>
                            </View>
                            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                                <FontAwesome name="times" size={20} color="#fff" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.inputContainer}>
                            <Text style={styles.sectionTitle}>Anotação Atual</Text>
                            <TextInput
                                style={styles.textInput}
                                value={note}
                                onChangeText={setNote}
                                placeholder="Escreva alguma observação sobre este exercício aqui..."
                                placeholderTextColor="#666"
                                multiline
                                textAlignVertical="top"
                            />
                        </View>

                        <View style={styles.historyContainer}>
                            <Text style={styles.sectionTitle}>Histórico de Anotações</Text>
                            {loading ? (
                                <ActivityIndicator color="#3B82F6" style={{ marginTop: 20 }} />
                            ) : history.length > 0 ? (
                                <FlatList
                                    data={history}
                                    renderItem={renderItem}
                                    keyExtractor={item => item.id}
                                    showsVerticalScrollIndicator={false}
                                    contentContainerStyle={{ paddingBottom: 20 }}
                                />
                            ) : (
                                <Text style={styles.emptyText}>Nenhuma anotação anterior encontrada.</Text>
                            )}
                        </View>

                        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                            <Text style={styles.saveButtonText}>Salvar Anotação</Text>
                        </TouchableOpacity>

                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'flex-end',
    },
    modalContainer: {
        backgroundColor: '#1E232E',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        height: '85%',
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 10,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 24,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 16,
        color: '#3B82F6',
        fontWeight: '600',
    },
    closeButton: {
        padding: 8,
        marginTop: -4,
        marginRight: -8,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#888',
        marginBottom: 12,
        marginTop: 8,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    inputContainer: {
        marginBottom: 24,
    },
    textInput: {
        backgroundColor: '#2A2E37',
        borderRadius: 12,
        color: '#fff',
        padding: 16,
        fontSize: 16,
        minHeight: 100,
        borderWidth: 1,
        borderColor: '#333',
    },
    historyContainer: {
        flex: 1,
    },
    historyCard: {
        backgroundColor: '#2A2E37',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderLeftWidth: 3,
        borderLeftColor: '#3B82F6',
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    dateContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    dateText: {
        color: '#888',
        fontSize: 12,
        fontWeight: '600',
    },
    workoutNameText: {
        color: '#ccc',
        fontSize: 12,
        fontWeight: '500',
        maxWidth: '60%',
    },
    noteText: {
        color: '#fff',
        fontSize: 14,
        lineHeight: 20,
    },
    emptyText: {
        color: '#666',
        fontSize: 14,
        textAlign: 'center',
        marginTop: 40,
    },
    saveButton: {
        backgroundColor: '#3B82F6',
        borderRadius: 16,
        paddingVertical: 16,
        alignItems: 'center',
        marginTop: 16,
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
