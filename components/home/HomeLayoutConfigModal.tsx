import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

type HomeLayoutConfigModalProps = {
    visible: boolean;
    onClose: () => void;
    layout: { key: string; visible: boolean }[];
    onSaveLayout: (newLayout: { key: string; visible: boolean }[]) => void;
};

const WIDGET_LABELS: { [key: string]: { label: string, icon: string } } = {
    weeklyCalendar: { label: 'Calendário Semanal', icon: 'calendar' },
    streak: { label: 'Contador de Sequência', icon: 'flame' },
    quickActions: { label: 'Ações Rápidas', icon: 'flash' },
    weeklyProgress: { label: 'Progresso Semanal', icon: 'pie-chart' },
    todayWorkout: { label: 'Treino de Hoje', icon: 'barbell' },
    metrics: { label: 'Minhas Métricas', icon: 'stats-chart' },
    pastWorkouts: { label: 'Treinos Passados', icon: 'time' },
};

export const HomeLayoutConfigModal: React.FC<HomeLayoutConfigModalProps> = ({ visible, onClose, layout, onSaveLayout }) => {
    // Separate fixed items from draggable items
    const [draggableLayout, setDraggableLayout] = useState<{ key: string; visible: boolean }[]>([]);

    useEffect(() => {
        setDraggableLayout(layout.filter(item => item.key !== 'weeklyCalendar'));
    }, [layout]);

    const handleToggle = (key: string) => {
        const newLayout = draggableLayout.map(item =>
            item.key === key ? { ...item, visible: !item.visible } : item
        );
        setDraggableLayout(newLayout);
    };

    const handleSave = () => {
        // Reconstruct full layout with fixed calendar at top
        const fixedItem = layout.find(item => item.key === 'weeklyCalendar') || { key: 'weeklyCalendar', visible: true };
        const fullLayout = [fixedItem, ...draggableLayout];
        onSaveLayout(fullLayout);
        onClose();
    };

    const renderItem = ({ item, drag, isActive }: RenderItemParams<{ key: string; visible: boolean }>) => {
        const widgetInfo = WIDGET_LABELS[item.key] || { label: item.key, icon: 'square' };

        return (
            <ScaleDecorator>
                <TouchableOpacity
                    onLongPress={drag}
                    disabled={isActive}
                    style={[
                        styles.switchRow,
                        { backgroundColor: isActive ? '#252830' : '#1A1D23' }
                    ]}
                >
                    <View style={styles.labelContainer}>
                        <TouchableOpacity onPressIn={drag} style={styles.dragHandle}>
                            <Ionicons name="menu" size={24} color="#555" />
                        </TouchableOpacity>
                        <Ionicons name={widgetInfo.icon as any} size={20} color="#888" style={{ marginRight: 10, marginLeft: 5 }} />
                        <Text style={styles.switchLabel}>{widgetInfo.label}</Text>
                    </View>

                    <Switch
                        trackColor={{ false: "#767577", true: "#3B82F6" }}
                        thumbColor={item.visible ? "#ffffff" : "#f4f3f4"}
                        ios_backgroundColor="#3e3e3e"
                        onValueChange={() => handleToggle(item.key)}
                        value={item.visible}
                    />
                </TouchableOpacity>
            </ScaleDecorator>
        );
    };

    const renderHeader = () => {
        const fixedItem = layout.find(item => item.key === 'weeklyCalendar');
        if (!fixedItem) return null;

        return (
            <View style={[styles.switchRow, { opacity: 0.7 }]}>
                <View style={styles.labelContainer}>
                    <View style={[styles.dragHandle, { opacity: 0 }]}>
                        {/* Invisible handle for alignment */}
                        <Ionicons name="menu" size={24} color="#555" />
                    </View>
                    <Ionicons name="calendar" size={20} color="#888" style={{ marginRight: 10, marginLeft: 5 }} />
                    <Text style={styles.switchLabel}>Calendário Semanal</Text>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="lock-closed" size={14} color="#555" style={{ marginRight: 4 }} />
                    <Text style={{ color: '#555', fontSize: 12 }}>Fixo</Text>
                </View>
            </View>
        );
    };

    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <TouchableOpacity style={styles.overlayTouchable} onPress={onClose} />

                <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                        <View style={styles.modalHandle} />
                        <Text style={styles.modalTitle}>Personalizar Home</Text>
                    </View>

                    <GestureHandlerRootView style={{ flex: 1 }}>
                        <DraggableFlatList
                            data={draggableLayout}
                            onDragEnd={({ data }) => setDraggableLayout(data)}
                            keyExtractor={(item) => item.key}
                            renderItem={renderItem}
                            ListHeaderComponent={renderHeader}
                            containerStyle={styles.listContainer}
                        />
                    </GestureHandlerRootView>

                    <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                        <Text style={styles.saveButtonText}>Salvar</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'flex-end',
    },
    overlayTouchable: {
        flex: 1,
    },
    modalContent: {
        backgroundColor: '#1A1D23',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
        paddingBottom: 40,
        width: '100%',
        height: '65%', // Fixed height to ensure list expands
        borderTopWidth: 1,
        borderTopColor: '#333',
    },
    modalHeader: {
        alignItems: 'center',
        marginBottom: 20,
    },
    modalHandle: {
        width: 40,
        height: 4,
        backgroundColor: '#444',
        borderRadius: 2,
        marginBottom: 15,
    },
    modalTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    listContainer: {
        marginBottom: 20,
    },
    switchRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#2A2E37',
    },
    labelContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    dragHandle: {
        padding: 8,
        marginRight: 4,
    },
    switchLabel: {
        color: '#EAEAEA',
        fontSize: 16,
    },
    saveButton: {
        marginTop: 10,
        padding: 15,
        alignItems: 'center',
        width: '100%',
        backgroundColor: '#3B82F6',
        borderRadius: 12,
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
