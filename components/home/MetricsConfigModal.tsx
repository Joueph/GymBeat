import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';

type MetricsConfigModalProps = {
    visible: boolean;
    onClose: () => void;
    config: { key: string; visible: boolean; fullWidth: boolean }[];
    onSaveConfig: (newConfig: { key: string; visible: boolean; fullWidth: boolean }[]) => void;
};

const METRIC_LABELS: { [key: string]: { label: string } } = {
    weight: { label: 'Peso Corporal' },
    time: { label: 'Tempo de Treino' },
    sets: { label: 'Séries' },
    volume: { label: 'Volume' },
};

export const MetricsConfigModal: React.FC<MetricsConfigModalProps> = ({ visible, onClose, config, onSaveConfig }) => {
    const [localConfig, setLocalConfig] = useState(config);

    useEffect(() => {
        setLocalConfig(config);
    }, [config]);

    const handleToggleVisibility = (index: number) => {
        const newConfig = [...localConfig];
        newConfig[index] = { ...newConfig[index], visible: !newConfig[index].visible };
        setLocalConfig(newConfig);
    };

    const handleToggleWidth = (index: number) => {
        const newConfig = [...localConfig];
        newConfig[index] = { ...newConfig[index], fullWidth: !newConfig[index].fullWidth };
        setLocalConfig(newConfig);
    };

    const handleSave = () => {
        onSaveConfig(localConfig);
        onClose();
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
                <View style={styles.modalHeader}>
                    <View style={styles.modalHandle} />
                    <Text style={styles.modalTitle}>Personalizar Métricas</Text>
                </View>

                <ScrollView style={styles.configContainer}>
                    {localConfig.map((item, index) => {
                        const label = METRIC_LABELS[item.key]?.label || item.key;

                        return (
                            <View key={item.key} style={styles.configRow}>
                                <View style={styles.labelContainer}>
                                    <Text style={styles.labelText}>{label}</Text>
                                </View>

                                <View style={styles.controlsContainer}>
                                    <TouchableOpacity
                                        style={[styles.sizeButton, item.fullWidth && styles.sizeButtonActive]}
                                        onPress={() => handleToggleWidth(index)}
                                    >
                                        <Ionicons
                                            name={item.fullWidth ? "square" : "grid"}
                                            size={16}
                                            color="#fff"
                                            style={{ marginRight: 4 }}
                                        />
                                        <Text style={styles.sizeButtonText}>
                                            {item.fullWidth ? '1:2' : '1:1'}
                                        </Text>
                                    </TouchableOpacity>

                                    <Switch
                                        trackColor={{ false: "#767577", true: "#3B82F6" }}
                                        thumbColor={item.visible ? "#ffffff" : "#f4f3f4"}
                                        ios_backgroundColor="#3e3e3e"
                                        onValueChange={() => handleToggleVisibility(index)}
                                        value={item.visible}
                                        style={{ marginLeft: 10 }}
                                    />
                                </View>
                            </View>
                        );
                    })}
                </ScrollView>

                <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                    <Text style={styles.saveButtonText}>Salvar</Text>
                </TouchableOpacity>
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
        backgroundColor: '#1A1D23',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
        paddingBottom: 40,
        position: 'absolute',
        bottom: 0,
        width: '100%',
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
    configContainer: {
        marginBottom: 20,
        maxHeight: 400,
    },
    configRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#2A2E37',
    },
    labelContainer: {
        flex: 1,
    },
    labelText: {
        color: '#EAEAEA',
        fontSize: 16,
    },
    controlsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    sizeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#2A2E37',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#444',
    },
    sizeButtonActive: {
        backgroundColor: '#3B82F6',
        borderColor: '#3B82F6',
    },
    sizeButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 12,
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
