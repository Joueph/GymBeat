import { DiaSemana, Treino } from '@/models/treino';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface DaysOfWeekSelectorProps {
    treino: Treino;
    onUpdateTreino: (treino: Treino) => void;
    isEditing: boolean;
    setIsEditing: (isEditing: boolean) => void;
    transparent?: boolean;
}

const DIAS_SEMANA_ORDEM = { 'dom': 0, 'seg': 1, 'ter': 2, 'qua': 3, 'qui': 4, 'sex': 5, 'sab': 6 };
const DIAS_SEMANA_ARRAY = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'] as const;

export const DaysOfWeekSelector: React.FC<DaysOfWeekSelectorProps> = ({ treino, onUpdateTreino, isEditing, setIsEditing, transparent }) => {
    const [modalVisible, setModalVisible] = useState(false);

    const handleToggleDay = (day: DiaSemana) => {
        const currentDays = treino.diasSemana || [];
        const newDays = currentDays.includes(day)
            ? currentDays.filter(d => d !== day)
            : [...currentDays, day];

        // Ordena os dias
        newDays.sort((a, b) => DIAS_SEMANA_ORDEM[a] - DIAS_SEMANA_ORDEM[b]);

        if (!isEditing) setIsEditing(true);
        onUpdateTreino({ ...treino, diasSemana: newDays });
    };

    const getDaysLabel = () => {
        if (!treino.diasSemana || treino.diasSemana.length === 0) return 'Selecionar dias...';
        return treino.diasSemana.map(d => d.toUpperCase()).join(', ');
    };

    return (
        <>
            <TouchableOpacity style={[styles.container, transparent && styles.transparent]} onPress={() => setModalVisible(true)}>
                <View style={styles.iconContainer}>
                    <FontAwesome5 name="calendar-alt" size={16} color="#888" />
                </View>
                <View style={styles.contentContainer}>
                    <Text style={styles.label}>Dias da Semana</Text>
                    <Text style={styles.value} numberOfLines={1}>{getDaysLabel()}</Text>
                </View>
                <Ionicons name="chevron-down" size={20} color="#555" />
            </TouchableOpacity>

            <Modal
                animationType="slide"
                transparent={true}
                visible={modalVisible}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Dias da Semana</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeButton}>
                                <Ionicons name="close" size={24} color="#fff" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.daysGrid}>
                            {DIAS_SEMANA_ARRAY.map(day => {
                                const isSelected = treino.diasSemana?.includes(day);
                                return (
                                    <TouchableOpacity
                                        key={day}
                                        style={[styles.dayButton, isSelected && styles.dayButtonSelected]}
                                        onPress={() => handleToggleDay(day)}
                                    >
                                        <Text style={[styles.dayButtonText, isSelected && styles.dayButtonTextSelected]}>
                                            {day.toUpperCase()}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        <TouchableOpacity style={styles.doneButton} onPress={() => setModalVisible(false)}>
                            <Text style={styles.doneButtonText}>Concluir</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#ffffff1a',
    },
    transparent: {
        backgroundColor: 'transparent',
        borderWidth: 0,
        marginBottom: 0,
    },
    iconContainer: {
        width: 32,
        alignItems: 'center',
        marginRight: 12,
    },
    contentContainer: {
        flex: 1,
    },
    label: {
        color: '#888',
        fontSize: 12,
        textTransform: 'uppercase',
        fontWeight: '600',
        marginBottom: 2,
    },
    value: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '500',
    },
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#1c1c1e',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
        paddingBottom: 40,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    closeButton: {
        padding: 5,
    },
    daysGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        justifyContent: 'center',
        marginBottom: 24,
    },
    dayButton: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#2c2c2e',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'transparent',
    },
    dayButtonSelected: {
        backgroundColor: '#3B82F6',
        borderColor: '#3B82F6',
    },
    dayButtonText: {
        color: '#888',
        fontWeight: 'bold',
        fontSize: 12,
    },
    dayButtonTextSelected: {
        color: '#fff',
    },
    doneButton: {
        backgroundColor: '#3B82F6',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    doneButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
});
