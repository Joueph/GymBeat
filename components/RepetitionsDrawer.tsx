// components/RepetitionsDrawer.tsx
import React, { useEffect, useState } from 'react';
import {
    Modal,
    Pressable,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NumberSlider } from './NumberSlider';


// --- CONSTANTES ---
const MAX_REP_DIFF = 5;

// --- PROPS ---
interface RepetitionsDrawerProps {
  visible: boolean;
  onClose: () => void;
  onSave: (reps: string) => void;
  initialValue: string | number;
}

export const RepetitionsDrawer = ({ visible, onClose, onSave, initialValue }: RepetitionsDrawerProps) => {
  const [isRange, setIsRange] = useState(false);
  const [minReps, setMinReps] = useState(8);
  const [maxReps, setMaxReps] = useState(12);
  const [delta, setDelta] = useState(4); // A diferença entre min e max
  const [singleRep, setSingleRep] = useState(10);

  // Efeito para rolar para a posição inicial ao abrir
  useEffect(() => {
    if (visible) {
      let min = 8, max = 12, single = 10;
      let range = false;
      let currentDelta = 4;
      const val = String(initialValue);

      if (val.includes('-')) {
        const parts = val.split('-').map(Number);
        range = true;
        min = parts[0] || 8;
        max = parts[1] || 12;

        // Ensure max is not less than min and respects MAX_REP_DIFF
        if (max < min) {
          max = min;
        }
        if (max > min + MAX_REP_DIFF) {
          max = min + MAX_REP_DIFF;
        }
        currentDelta = max - min;

      } else {
        range = false;
        single = Number(val) || 10;
      }
      
      setIsRange(range); 
      setMinReps(min);
      setMaxReps(max);
      setSingleRep(single);
      setDelta(currentDelta);
    }
  }, [visible, initialValue]);

  // Salva o estado final
  const handleSave = () => {
    if (isRange) {
      onSave(`${minReps}-${maxReps}`);
    } else {
      onSave(String(singleRep));
    }
    onClose();
  };

  const handleToggleRange = (newValue: boolean) => {
    setIsRange(newValue);

    if (newValue === true) {
      // Trocando de Single -> Range
      const newMin = singleRep;
      // REGRA: "o valor padrão deve ser o min + 2"
      const newMax = Math.min(newMin + 2, 50); 
      const newDelta = newMax - newMin;

      setMinReps(newMin);
      setMaxReps(newMax);
      setDelta(newDelta);
    } else {
      // Trocando de Range -> Single
      const newSingle = minReps;
      setSingleRep(newSingle);
    }
  };

  // --- NOVOS HANDLERS USANDO O NumberSlider ---

  const handleMinRepsChange = (newMin: number) => {
    // Mantém a diferença (delta) constante, ajustando o valor máximo uniformemente.
    const newMax = Math.min(newMin + delta, 50); // Garante que o máximo não passe de 50.
    setMinReps(newMin);
    setMaxReps(newMax);
  };

  const handleMaxRepsChange = (newMax: number) => {
    // Garante que o valor máximo não seja menor que o mínimo
    // e não exceda o delta máximo permitido.
    const finalMax = Math.max(minReps, Math.min(newMax, minReps + MAX_REP_DIFF));
    setMaxReps(finalMax);
    setDelta(finalMax - minReps);
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
              <Text style={styles.title}>Selecionar Repetições</Text>
            </View>
            
            <View style={styles.toggleContainer}>
              <Text style={styles.toggleLabel}>Usar faixa (ex: 8-12)</Text>
              <Switch
                trackColor={{ false: '#767577', true: '#1cb0f6' }}
                thumbColor={isRange ? '#f4f3f4' : '#f4f3f4'}
                ios_backgroundColor="#3e3e3e"
                onValueChange={handleToggleRange}
                value={isRange}
              />
            </View>

            <View style={styles.listArea}>
              {isRange ? (
                <>
                  {/* Lista da Esquerda (Min) */}
                  <View style={styles.listContainer}>
                    <Text style={styles.listLabel}>Mín.</Text>
                    <NumberSlider
                      min={1}
                      max={50}
                      value={minReps}
                      onChange={handleMinRepsChange}
                      initialValue={minReps}
                      vertical
                      validRange={{ min: 1, max: maxReps - 1 }}
                    />
                  </View>
                  
                  <Text style={styles.rangeDash}>-</Text>
                  
                  {/* Lista da Direita (Max) */}
                  <View style={styles.listContainer}>
                    <Text style={styles.listLabel}>Máx.</Text>
                    <NumberSlider
                      min={1}
                      max={50}
                      value={maxReps}
                      onChange={handleMaxRepsChange}
                      initialValue={maxReps}
                      vertical
                      // Passando os limites válidos para o componente
                      validRange={{ min: minReps + 1, max: minReps + MAX_REP_DIFF }}
                    />
                  </View>
                </>
              ) : (
                // Lista Única
                <View style={styles.listContainer}>
                  <Text style={styles.listLabel}>Reps</Text>
                  <NumberSlider
                    min={1}
                    max={50}
                    value={singleRep}
                    onChange={setSingleRep}
                    initialValue={singleRep}
                    vertical
                  />
                </View>
              )}
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
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#1f1f1f',
    borderRadius: 10,
  },
  toggleLabel: {
    color: '#fff',
    fontSize: 16,
  },
  listArea: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    height: 300, // Altura fixa para a área do slider
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