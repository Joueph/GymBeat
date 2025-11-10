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

interface WeightInputDrawerProps {
  visible: boolean;
  onClose: () => void;
  onSave: (weight: number) => void;
  initialValue: number;
}

export const WeightInputDrawer = ({ visible, onClose, onSave, initialValue }: WeightInputDrawerProps) => {
  const [weight, setWeight] = useState(70);

  useEffect(() => {
    if (visible) {
      setWeight(initialValue || 70);
    }
  }, [visible, initialValue]);

  const handleSave = () => {
    onSave(weight);
    onClose();
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
              <Text style={styles.title}>Atualizar Peso</Text>
            </View>
            
            <View style={styles.listArea}>
              <View style={styles.listContainer}>
                <Text style={styles.listLabel}>Peso (kg)</Text>
                <NumberSlider
                  min={30}
                  max={200}
                  step={1} // Permite valores decimais
                  value={weight}
                  onChange={(val) => setWeight(parseFloat(val.toFixed(1)))}
                  initialValue={weight}
                  vertical={false}
                />
              </View>
            </View>

            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
              <Text style={styles.saveButtonText}>Salvar Novo Peso</Text>
            </TouchableOpacity>
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
    justifyContent: 'center',
  },
  listContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  listLabel: {
    color: '#aaa',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
  },
  saveButton: {
    backgroundColor: '#1A1D23',
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