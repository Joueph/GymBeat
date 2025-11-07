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
interface RestTimeDrawerProps {
  visible: boolean;
  onClose: () => void;
  onSave: (seconds: number) => void;
  initialValue: number; // Em segundos
}

export const RestTimeDrawer = ({ visible, onClose, onSave, initialValue }: RestTimeDrawerProps) => {
  const [minutes, setMinutes] = useState(1);
  const [seconds, setSeconds] = useState(30);

  // Efeito para definir os valores iniciais ao abrir o modal
  useEffect(() => {
    if (visible) {
      const initialMinutes = Math.floor(initialValue / 60);
      const initialSeconds = initialValue % 60;
      setMinutes(initialMinutes);
      setSeconds(initialSeconds);
    }
  }, [visible, initialValue]);

  // Salva o estado final em segundos
  const handleSave = () => {
    const totalSeconds = minutes * 60 + seconds;
    onSave(totalSeconds);
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
              <Text style={styles.title}>Selecionar Descanso</Text>
            </View>
            
            <View style={styles.listArea}>
              {/* Slider de Minutos */}
              <View style={styles.listContainer}>
                <Text style={styles.listLabel}>Minutos</Text>
                <NumberSlider
                  min={0}
                  max={10}
                  value={minutes}
                  onChange={setMinutes}
                  initialValue={minutes}
                  vertical
                />
              </View>
              
              <Text style={styles.rangeDash}>:</Text>
              
              {/* Slider de Segundos */}
              <View style={styles.listContainer}>
                <Text style={styles.listLabel}>Segundos</Text>
                <NumberSlider
                  min={0}
                  max={55}
                  step={5} // Garante que os valores sejam múltiplos de 5
                  value={seconds}
                  onChange={handleSecondsChange}
                  initialValue={seconds}
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
  rangeDash: {
    color: '#fff',
    fontSize: 36,
    fontWeight: 'bold',
    marginHorizontal: 25,
    paddingBottom: 20, // Ajuste para alinhar com os números
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