import { FontAwesome } from '@expo/vector-icons';
import React, { useState } from 'react';
import { FlatList, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { updateUserProfile } from '../../../userService'; // Assuming this path
import { useAuth } from '../../authprovider'; // Assuming this path
import { WorkoutScreenPreference } from './specifics/WorkoutScreenPreference'; // Assuming this path

interface WorkoutSettingsModalProps {
  isVisible: boolean;
  onClose: () => void;
  currentWorkoutScreenType: 'simplified' | 'complete' | undefined;
  onWorkoutScreenTypeChange: (newType: 'simplified' | 'complete') => void;
}

export const WorkoutSettingsModal: React.FC<WorkoutSettingsModalProps> = ({
  isVisible,
  onClose,
  currentWorkoutScreenType,
  onWorkoutScreenTypeChange,
}) => {
  const { user } = useAuth();
  const [isWorkoutScreenPreferenceVisible, setIsWorkoutScreenPreferenceVisible] = useState(false);

  const handleWorkoutScreenPreferenceSelect = async (preference: 'simplified' | 'complete') => {
    if (user) {
      try {
        await updateUserProfile(user.id, { workoutScreenType: preference });
        onWorkoutScreenTypeChange(preference);
        setIsWorkoutScreenPreferenceVisible(false);
      } catch (error) {
        console.error('Erro ao salvar preferência de tela de treino:', error);
        // Optionally, show an alert to the user
      }
    }
  };

  const settingsOptions = [
    {
      id: 'workoutScreenType',
      title: 'Tipo de Tela de Treino',
      description: currentWorkoutScreenType === 'simplified' ? 'Simplificada' : 'Completa',
      action: () => setIsWorkoutScreenPreferenceVisible(true),
    },
    // Add other settings options here
    {
      id: 'otherSetting1',
      title: 'Outra Configuração 1',
      description: 'Descrição da configuração 1',
      action: () => console.log('Other setting 1 pressed'),
    },
    {
      id: 'otherSetting2',
      title: 'Outra Configuração 2',
      description: 'Descrição da configuração 2',
      action: () => console.log('Other setting 2 pressed'),
    },
  ];

  const renderSettingItem = ({ item }: { item: typeof settingsOptions[0] }) => (
    <TouchableOpacity style={styles.settingItem} onPress={item.action}>
      <View>
        <Text style={styles.settingTitle}>{item.title}</Text>
        <Text style={styles.settingDescription}>{item.description}</Text>
      </View>
      <FontAwesome name="chevron-right" size={16} color="#888" />
    </TouchableOpacity>
  );

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={isVisible}
      onRequestClose={onClose}
    >
      <View style={styles.centeredView}>
        <View style={styles.modalView}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalMainTitle}>Configurações do Treino</Text>
            <TouchableOpacity onPress={onClose}>
              <FontAwesome name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          <FlatList
            data={settingsOptions}
            keyExtractor={(item) => item.id}
            renderItem={renderSettingItem}
            style={styles.settingsList}
          />

          <WorkoutScreenPreference
            isVisible={isWorkoutScreenPreferenceVisible}
            onClose={() => setIsWorkoutScreenPreferenceVisible(false)}
            onSelectPreference={handleWorkoutScreenPreferenceSelect}
          />
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
    padding: 20,
    width: '90%',
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalMainTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
  },
  settingsList: {
    width: '100%',
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#2c2c2e',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
  },
  settingTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  settingDescription: {
    color: '#aaa',
    fontSize: 13,
    marginTop: 2,
  },
});
