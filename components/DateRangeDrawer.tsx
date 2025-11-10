import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View, Switch, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';

type DateRange = {
  startDate: Date;
  endDate: Date | null;
};

interface DateRangeDrawerProps {
  visible: boolean;
  onClose: () => void;
  onApply: (range: DateRange) => void;
}

export const DateRangeDrawer = ({ visible, onClose, onApply }: DateRangeDrawerProps) => {
  const [mode, setMode] = useState<'start' | 'range'>('start');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState<'start' | 'end' | null>(null);

  const handleApply = () => {
    onApply({ startDate, endDate: mode === 'range' ? endDate : null });
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    const currentDate = selectedDate || (showPicker === 'start' ? startDate : endDate);
    if (Platform.OS === 'android') {
        setShowPicker(null);
    }
    if (showPicker === 'start') {
      setStartDate(currentDate);
    } else {
      setEndDate(currentDate);
    }
  };

  const showDatepicker = (picker: 'start' | 'end') => {
    setShowPicker(picker);
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <>
        <Pressable style={styles.overlay} onPress={onClose} />
        <View style={styles.drawerContainer}>
          <SafeAreaView style={{ flex: 1 }} edges={['bottom', 'left', 'right']}>
            <View style={styles.header}>
              <Text style={styles.title}>Filtrar por data</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="#EAEAEA" />
              </TouchableOpacity>
            </View>

            <View style={styles.toggleContainer}>
              <Text style={styles.toggleLabel}>A partir de</Text>
              <Switch
                value={mode === 'range'}
                onValueChange={(value) => setMode(value ? 'range' : 'start')}
                trackColor={{ false: '#767577', true: '#3B82F6' }}
                thumbColor={'#f4f3f4'}
              />
              <Text style={styles.toggleLabel}>Intervalo</Text>
            </View>

            <View style={styles.dateSelectors}>
              <View style={styles.dateSelector}>
                <Text style={styles.dateLabel}>Início</Text>
                <TouchableOpacity onPress={() => showDatepicker('start')} style={styles.dateButton}>
                  <Text style={styles.dateText}>{startDate.toLocaleDateString()}</Text>
                </TouchableOpacity>
              </View>
              {mode === 'range' && (
                <View style={styles.dateSelector}>
                  <Text style={styles.dateLabel}>Fim</Text>
                  <TouchableOpacity onPress={() => showDatepicker('end')} style={styles.dateButton}>
                    <Text style={styles.dateText}>{endDate.toLocaleDateString()}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {showPicker && (
              <DateTimePicker
                testID="dateTimePicker"
                value={showPicker === 'start' ? startDate : endDate}
                mode={'date'}
                is24Hour={true}
                display="default"
                onChange={onDateChange}
              />
            )}

            <View style={styles.footer}>
                <TouchableOpacity style={styles.saveButton} onPress={handleApply}>
                    <Text style={styles.saveButtonText}>Aplicar</Text>
                </TouchableOpacity>
            </View>

          </SafeAreaView>
        </View>
      </>
    </Modal>
  );
};

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
    },
    drawerContainer: {
        height: '45%',
        backgroundColor: '#0B0D10',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingBottom: 20,
    },
    title: {
        color: '#fff',
        fontSize: 20,
        fontWeight: 'bold',
    },
    closeButton: {
        position: 'absolute',
        right: 0,
    },
    toggleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginVertical: 20,
    },
    toggleLabel: {
        color: '#EAEAEA',
        fontSize: 16,
        marginHorizontal: 10,
    },
    dateSelectors: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginVertical: 20,
    },
    dateSelector: {
        alignItems: 'center',
    },
    dateLabel: {
        color: '#888',
        fontSize: 14,
        marginBottom: 8,
    },
    dateButton: {
        padding: 10,
        backgroundColor: '#1A1D23',
        borderRadius: 8,
    },
    dateText: {
        color: '#EAEAEA',
        fontSize: 16,
    },
    footer: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    saveButton: {
        backgroundColor: '#3B82F6',
        height: 60,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
});
