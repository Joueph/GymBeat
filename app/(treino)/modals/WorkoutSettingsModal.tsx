import { FontAwesome } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RestTimeDrawer } from '../../../components/RestTimeDrawer';
import { getUserProfile, updateUserProfile } from '../../../userService';
import { useAuth } from '../../authprovider';
import { WorkoutScreenPreference } from './specifics/WorkoutScreenPreference';

interface WorkoutSettingsModalProps {
  isVisible: boolean;
  onClose: () => void;
}

export const WorkoutSettingsModal: React.FC<WorkoutSettingsModalProps> = ({
  isVisible,
  onClose,
}) => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isPreferenceModalVisible, setPreferenceModalVisible] = useState(false);
  const [isRestTimeDrawerVisible, setRestTimeDrawerVisible] = useState(false);

  // Estados para as configurações
  const [workoutScreenType, setWorkoutScreenType] = useState<'simplified' | 'complete'>('complete');
  const [defaultRestTime, setDefaultRestTime] = useState(90); // 90 segundos como padrão
  const [restTimeNotificationEnabled, setRestTimeNotificationEnabled] = useState(false);

  useEffect(() => {
    // Busca as configurações do usuário quando o modal se torna visível
    if (isVisible) {
      const fetchSettings = async () => {
        if (user) {
          setIsLoading(true);
          const profile = await getUserProfile(user.id);
          if (profile) {
            // Define o tipo de tela de treino
            setWorkoutScreenType(profile.workoutScreenType || 'complete');

            // Define o tempo de descanso padrão
            const restTimeInSeconds = (profile.defaultRestTime?.min ?? 1) * 60 + (profile.defaultRestTime?.seg ?? 30);
            setDefaultRestTime(restTimeInSeconds);

            // Define a preferência de notificação
            setRestTimeNotificationEnabled(profile.settings?.notifications?.restTimeEnding ?? false);
          }
          setIsLoading(false);
        }
      };
      fetchSettings();
    }
  }, [isVisible, user]);

  const handleWorkoutScreenPreferenceSelect = async (preference: 'simplified' | 'complete') => {
    if (user) {
      try {
        await updateUserProfile(user.id, { workoutScreenType: preference });
        setWorkoutScreenType(preference); // Atualiza o estado local
        setPreferenceModalVisible(false); // Fecha o sub-modal
      } catch (error) {
        console.error('Erro ao salvar preferência de tela de treino:', error);
      }
    }
  };

  const handleRestTimeSave = async (newSeconds: number) => {
    if (user) {
      const newMin = Math.floor(newSeconds / 60);
      const newSeg = newSeconds % 60;
      await updateUserProfile(user.id, { defaultRestTime: { min: newMin, seg: newSeg } });
      setDefaultRestTime(newSeconds); // Atualiza o estado local
    }
    setRestTimeDrawerVisible(false); // Fecha o drawer
  };

  const handleRestTimeNotificationToggle = async (newValue: boolean) => {
    if (!user) return;

    // Se estiver ativando, verifica as permissões primeiro
    if (newValue) {
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') {
        const { status: newStatus } = await Notifications.requestPermissionsAsync();
        if (newStatus !== 'granted') {
          Alert.alert("Permissão Negada", "As notificações não podem ser ativadas sem a sua permissão.");
          return; // Não ativa o toggle se a permissão for negada
        }
      }
    }

    // Se a permissão foi concedida ou se está desativando, atualiza o estado e salva
    setRestTimeNotificationEnabled(newValue);
    try {
      // Para atualizar um campo aninhado com 'deep merge', passamos o objeto aninhado.
      await updateUserProfile(user.id, {
        settings: {
          ...user.settings, // Mantém outras configurações existentes
          notifications: { ...user.settings?.notifications, restTimeEnding: newValue },
        },
      });
    } catch (error) {
      console.error('Erro ao salvar configuração de notificação:', error);
      // Reverte o estado visual em caso de erro
      setRestTimeNotificationEnabled(!newValue);
      Alert.alert("Erro", "Não foi possível salvar a configuração de notificação.");
    }
  };

  const formatRestTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes > 0 && remainingSeconds > 0) return `${minutes}m ${remainingSeconds}s`;
    return minutes > 0 ? `${minutes} min` : `${remainingSeconds} seg`;
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={isVisible}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.modalSafeArea}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Configurações do Treino</Text>
            <TouchableOpacity onPress={onClose}>
              <FontAwesome name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.settingsList}>
            <TouchableOpacity style={styles.settingItem} onPress={() => setPreferenceModalVisible(true)}>
              <FontAwesome name="desktop" size={20} color="#ccc" style={styles.settingIcon} />
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingLabel}>Experiência de Treino</Text>
                <Text style={styles.settingValue}>{workoutScreenType === 'simplified' ? 'Simplificada' : 'Completa'}</Text>
              </View>
              <FontAwesome name="chevron-right" size={16} color="#555" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.settingItem} onPress={() => setRestTimeDrawerVisible(true)}>
              <FontAwesome name="clock-o" size={20} color="#ccc" style={styles.settingIcon} />
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingLabel}>Descanso Padrão</Text>
                {isLoading ? (
                  <ActivityIndicator size="small" color="#ccc" />
                ) : (
                  <Text style={styles.settingValue}>{formatRestTime(defaultRestTime)}</Text>
                )}
              </View>
              <FontAwesome name="chevron-right" size={16} color="#555" />
            </TouchableOpacity>

            <View style={styles.settingItem}>
              <FontAwesome name="bell-o" size={20} color="#ccc" style={styles.settingIcon} />
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingLabel}>Notificar fim do descanso</Text>
              </View>
              <Switch
                onValueChange={handleRestTimeNotificationToggle}
                value={restTimeNotificationEnabled}
                trackColor={{ false: "#767577", true: "#3B82F6" }}
              />
            </View>
          </View>

          {/* Sub-modal para a preferência de tela */}
          <WorkoutScreenPreference
            isVisible={isPreferenceModalVisible}
            onClose={() => setPreferenceModalVisible(false)}
            onSelectPreference={handleWorkoutScreenPreferenceSelect}
            currentPreference={workoutScreenType}
          />

          {/* Drawer para o tempo de descanso */}
          <RestTimeDrawer
            visible={isRestTimeDrawerVisible}
            onClose={() => setRestTimeDrawerVisible(false)}
            onSave={handleRestTimeSave}
            initialValue={defaultRestTime}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalSafeArea: {
    flex: 1,
    backgroundColor: "#030405",
  },
  modalContainer: {
    flexGrow: 1,
    padding: 20,
    backgroundColor: "#030405",
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  settingsList: {
    width: '100%',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141414',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#ffffff1a',
  },
  settingIcon: {
    marginRight: 15,
  },
  settingTextContainer: {
    flex: 1,
  },
  settingLabel: {
    color: '#fff',
    fontSize: 16,
  },
  settingValue: {
    color: '#aaa',
    fontSize: 14,
    marginTop: 4,
  },
});