import { FontAwesome } from '@expo/vector-icons';
import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { updateUserProfile } from '../../../../userService';
import { useAuth } from '../../../authprovider';

interface WorkoutScreenPreferenceProps {
  isVisible: boolean;
  onClose: () => void;
  onSelectPreference: (preference: 'simplified' | 'complete') => void;
}

export const WorkoutScreenPreference: React.FC<WorkoutScreenPreferenceProps> = ({
  isVisible,
  onClose,
  onSelectPreference,
}) => {
  const { user } = useAuth();

  const handleSelect = async (preference: 'simplified' | 'complete') => {
    if (user) {
      try {
        await updateUserProfile(user.id, { workoutScreenType: preference });
        onSelectPreference(preference);
        onClose();
      } catch (error) {
        console.error('Erro ao salvar preferência de tela de treino:', error);
        // Optionally, show an alert to the user
      }
    }
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={isVisible}
      onRequestClose={onClose}
    >
      <View style={styles.centeredView}>
        <View style={styles.modalView}>
          <Text style={styles.modalTitle}>Escolha sua Experiência de Treino</Text>
          <Text style={styles.modalDescription}>
            Como você prefere registrar seus treinos?
          </Text>

          <TouchableOpacity
            style={styles.optionButton}
            onPress={() => handleSelect('simplified')}
          >
            <FontAwesome name="star" size={20} color="#fff" style={styles.optionIcon} />
            <View>
              <Text style={styles.optionTitle}>Simplificada</Text>
              <Text style={styles.optionDescription}>Foco rápido em séries e repetições.</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.optionButton}
            onPress={() => handleSelect('complete')}
          >
            <FontAwesome name="list-alt" size={20} color="#fff" style={styles.optionIcon} />
            <View>
              <Text style={styles.optionTitle}>Completa</Text>
              <Text style={styles.optionDescription}>Detalhes avançados, notas e descanso.</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelButtonText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  modalView: {
    margin: 20,
    backgroundColor: '#1f1f1f',
    borderRadius: 20,
    padding: 35,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    width: '90%',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  modalDescription: {
    color: '#ccc',
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 30,
  },
  optionButton: {
    flexDirection: 'row',
    backgroundColor: '#2c2c2e',
    borderRadius: 12,
    padding: 15,
    width: '100%',
    marginBottom: 15,
    alignItems: 'center',
  },
  optionIcon: {
    marginRight: 15,
  },
  optionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  optionDescription: {
    color: '#aaa',
    fontSize: 13,
    marginTop: 2,
  },
  cancelButton: {
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  cancelButtonText: {
    color: '#00A6FF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
