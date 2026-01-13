import { FontAwesome, FontAwesome5, Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../app/authprovider';
import { Machine } from '../models/machine';
import { createMachine, getMachinesForExercise, softDeleteMachine, updateMachine } from '../services/machineService';

interface MachineChooserDrawerProps {
    visible: boolean;
    onClose: () => void;
    onSelectMachine: (machineId: string | undefined, machineName: string | undefined, shouldClose?: boolean) => void;
    exerciseId: string;
    currentMachineId?: string;
}

export const MachineChooserDrawer = ({ visible, onClose, onSelectMachine, exerciseId, currentMachineId }: MachineChooserDrawerProps) => {
    const { user } = useAuth();
    const [machines, setMachines] = useState<Machine[]>([]);
    const [loading, setLoading] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    const [newMachineName, setNewMachineName] = useState('');
    const [editingMachineId, setEditingMachineId] = useState<string | null>(null);

    const fetchMachines = async () => {
        if (!user || !exerciseId) return;
        setLoading(true);
        const result = await getMachinesForExercise(exerciseId, user.id);
        setMachines(result);
        setLoading(false);
    };

    useEffect(() => {
        if (visible) {
            fetchMachines();
            setIsAdding(false);
            setNewMachineName('');
            setEditingMachineId(null);
        }
    }, [visible, exerciseId, user]);

    const handleAddMachine = async () => {
        if (!newMachineName.trim() || !user) return;

        if (editingMachineId) {
            // Edit existing
            await updateMachine(editingMachineId, { name: newMachineName.trim() });
            setEditingMachineId(null);
        } else {
            // Create new
            await createMachine(exerciseId, user.id, newMachineName.trim());
        }

        setNewMachineName('');
        setIsAdding(false);
        fetchMachines();
    };

    const handleDeleteMachine = (id: string, name: string) => {
        Alert.alert(
            "Excluir Máquina",
            `Deseja excluir a máquina "${name}"?`,
            [
                { text: "Cancelar", style: "cancel" },
                {
                    text: "Excluir", style: "destructive", onPress: async () => {
                        await softDeleteMachine(id);
                        // If we deleted the currently selected machine, revert to default
                        if (id === currentMachineId) {
                            onSelectMachine(undefined, undefined, false);
                        }
                        fetchMachines();
                    }
                }
            ]
        );
    }

    const handleStartEdit = (machine: Machine) => {
        setNewMachineName(machine.name);
        setEditingMachineId(machine.id);
        setIsAdding(true);
    }

    const renderItem = ({ item }: { item: Machine }) => {
        const isSelected = currentMachineId === item.id;
        return (
            <View style={styles.machineRow}>
                <TouchableOpacity
                    style={[styles.machineItem, isSelected && styles.machineItemSelected]}
                    onPress={() => {
                        onSelectMachine(item.id, item.name);
                        onClose();
                    }}
                >
                    <View style={styles.iconContainer}>
                        <FontAwesome5 name="dumbbell" size={16} color={isSelected ? "#fff" : "#888"} />
                    </View>
                    <Text style={[styles.machineName, isSelected && styles.machineNameSelected]}>{item.name}</Text>
                    {isSelected && <FontAwesome name="check" size={16} color="#3B82F6" style={{ marginLeft: 'auto' }} />}
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionButton} onPress={() => handleStartEdit(item)}>
                    <FontAwesome name="pencil" size={16} color="#888" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton} onPress={() => handleDeleteMachine(item.id, item.name)}>
                    <FontAwesome name="trash" size={16} color="#888" />
                </TouchableOpacity>
            </View>
        );
    };

    const renderDefaultOption = () => {
        const isSelected = !currentMachineId;
        return (
            <View style={styles.machineRow}>
                <TouchableOpacity
                    style={[styles.machineItem, isSelected && styles.machineItemSelected]}
                    onPress={() => {
                        onSelectMachine(undefined, undefined);
                        onClose();
                    }}
                >
                    <View style={styles.iconContainer}>
                        <FontAwesome5 name="layer-group" size={16} color={isSelected ? "#fff" : "#888"} />
                    </View>
                    <Text style={[styles.machineName, isSelected && styles.machineNameSelected]}>Exercício Padrão</Text>
                    {isSelected && <FontAwesome name="check" size={16} color="#3B82F6" style={{ marginLeft: 'auto' }} />}
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <Pressable style={styles.overlay} onPress={onClose} />
            <View style={styles.drawerContainer}>
                <SafeAreaView style={{ flex: 1 }} edges={['bottom', 'left', 'right']}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Selecionar Máquina</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Ionicons name="close" size={24} color="#fff" />
                        </TouchableOpacity>
                    </View>

                    {isAdding ? (
                        <View style={styles.addContainer}>
                            <TextInput
                                style={styles.input}
                                placeholder="Nome da máquina..."
                                placeholderTextColor="#666"
                                value={newMachineName}
                                onChangeText={setNewMachineName}
                                autoFocus
                            />
                            <View style={styles.addActions}>
                                <TouchableOpacity style={styles.cancelAddButton} onPress={() => { setIsAdding(false); setEditingMachineId(null); }}>
                                    <Text style={styles.cancelAddText}>Cancelar</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.confirmAddButton} onPress={handleAddMachine}>
                                    <Text style={styles.confirmAddText}>{editingMachineId ? "Salvar" : "Adicionar"}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ) : (
                        <TouchableOpacity style={styles.addButton} onPress={() => { setIsAdding(true); setNewMachineName(''); setEditingMachineId(null); }}>
                            <FontAwesome name="plus" size={16} color="#fff" />
                            <Text style={styles.addButtonText}>Nova Máquina</Text>
                        </TouchableOpacity>
                    )}

                    {loading ? (
                        <ActivityIndicator color="#3B82F6" style={{ marginTop: 20 }} />
                    ) : (
                        <FlatList
                            data={machines}
                            keyExtractor={item => item.id}
                            renderItem={renderItem}
                            ListHeaderComponent={renderDefaultOption}
                            contentContainerStyle={{ paddingBottom: 20 }}
                            style={{ flex: 1, marginTop: 10 }}
                        />
                    )}

                </SafeAreaView>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
    },
    drawerContainer: {
        height: '60%',
        marginTop: 'auto',
        backgroundColor: '#1c1c1e',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    title: {
        color: '#fff',
        fontSize: 20,
        fontWeight: 'bold',
    },
    closeButton: {
        padding: 5,
    },
    machineRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    machineItem: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        backgroundColor: '#2c2c2e',
        borderRadius: 12,
        marginRight: 10,
    },
    machineItemSelected: {
        backgroundColor: '#3a3a3c',
        borderWidth: 1,
        borderColor: '#3B82F6',
    },
    iconContainer: {
        width: 30,
        alignItems: 'center',
        marginRight: 10,
    },
    machineName: {
        color: '#aaa',
        fontSize: 16,
    },
    machineNameSelected: {
        color: '#fff',
        fontWeight: '600',
    },
    actionButton: {
        padding: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#3B82F6',
        padding: 12,
        borderRadius: 10,
        marginBottom: 10,
    },
    addButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        marginLeft: 8,
    },
    addContainer: {
        backgroundColor: '#2c2c2e',
        padding: 15,
        borderRadius: 12,
        marginBottom: 10,
    },
    input: {
        backgroundColor: '#1c1c1e',
        color: '#fff',
        padding: 12,
        borderRadius: 8,
        marginBottom: 10,
        fontSize: 16,
    },
    addActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 10,
    },
    cancelAddButton: {
        padding: 10,
    },
    cancelAddText: {
        color: '#ff453a',
    },
    confirmAddButton: {
        backgroundColor: '#3B82F6',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 8,
    },
    confirmAddText: {
        color: '#fff',
        fontWeight: 'bold',
    },
});
