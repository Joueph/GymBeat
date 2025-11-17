// components/TimeBasedSetDrawer.tsx
import React, { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NumberSlider } from './NumberSlider';

// --- PROPS ---
interface TimeBasedSetDrawerProps {
  visible: boolean;
  onClose: () => void;
  onSave: (seconds: number) => void;
  initialValue: number; // Em segundos
}

export const TimeBasedSetDrawer = ({ visible, onClose, onSave, initialValue }: TimeBasedSetDrawerProps) => {
  const [seconds, setSeconds] = useState(60);

  // Efeito para definir o valor inicial ao abrir o modal
  useEffect(() => {
    if (visible) {
      setSeconds(initialValue);
    }
  }, [visible, initialValue]);

  // Salva o estado final em segundos
  const handleSave = () => {
    onSave(seconds);
    onClose();
  };

  // Handler para garantir que os segundos sejam múltiplos de 5
  const handleSecondsChange = (newSeconds: number) => {
    setSeconds(Math.round(newSeconds / 5) * 5);
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
              <Text style={styles.title}>Selecionar Duração</Text>
            </View>
            
            <View style={styles.listArea}>
              {/* Slider de Segundos */}
              <View style={styles.listContainer}>
                <Text style={styles.listLabel}>Segundos</Text>
                <NumberSlider
                  min={0}
                  max={300} // 5 minutes
                  step={5} // Garante que os valores sejam múltiplos de 5
                  value={seconds}
                  onChange={handleSecondsChange}
                  vertical
                />
              </View>
            </View>

            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
              <Text style={styles.saveButtonText}>Salvar</Text>
            </TouchableOpacity>
          </SafeAreaView>
        </View>
      </>
    </Modal>
  );
};

// --- ESTILOS ---
const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  drawerContainer: {
    height: '65%',
    backgroundColor: '#000',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  header: {
    alignItems: 'center',
    paddingBottom: 20,
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  listArea: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    height: 300,
    overflow: 'hidden',
  },
  listContainer: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'center',
  },
  listLabel: {
    color: '#aaa',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
    position: 'absolute',
    top: -10,
  },
  saveButton: {
    backgroundColor: '#1cb0f6',
    height: 60,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
