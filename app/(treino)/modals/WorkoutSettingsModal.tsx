import { Treino } from '@/models/treino';
import { FontAwesome } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RestTimeDrawer } from '../../../components/RestTimeDrawer';
import { getUserProfile, updateUserProfile } from '../../../userService';
import { useAuth } from '../../authprovider';
import { WorkoutScreenPreference } from './specifics/WorkoutScreenPreference';

const DIAS_SEMANA_ORDEM = { 'dom': 0, 'seg': 1, 'ter': 2, 'qua': 3, 'qui': 4, 'sex': 5, 'sab': 6 };
const DIAS_SEMANA_ARRAY = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'] as const;
type DiaSemana = typeof DIAS_SEMANA_ARRAY[number];

interface WorkoutSettingsModalProps {
  isVisible: boolean;
  onClose: () => void;
  treino?: Treino | null; // Opcional, pois pode ser usado apenas para configs globais
  onUpdateTreino?: (treino: Treino) => void;
}

export const WorkoutSettingsModal: React.FC<WorkoutSettingsModalProps> = ({
  isVisible,
  onClose,
  treino,
  onUpdateTreino
}) => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isPreferenceModalVisible, setPreferenceModalVisible] = useState(false);
  const [isRestTimeDrawerVisible, setRestTimeDrawerVisible] = useState(false);

  // Estados para as configurações
  const [workoutScreenType, setWorkoutScreenType] = useState<'simplified' | 'complete'>('complete');
  const [defaultRestTime, setDefaultRestTime] = useState(90);
  const [restTimeNotificationEnabled, setRestTimeNotificationEnabled] = useState(false);

  useEffect(() => {
    if (isVisible) {
      const fetchSettings = async () => {
        if (user) {
          setIsLoading(true);
          const profile = await getUserProfile(user.id);
          if (profile) {
            setWorkoutScreenType(profile.workoutScreenType || 'complete');
            const restTimeInSeconds = (profile.defaultRestTime?.min ?? 1) * 60 + (profile.defaultRestTime?.seg ?? 30);
            setDefaultRestTime(restTimeInSeconds);
            setRestTimeNotificationEnabled(profile.settings?.notifications?.restTimeEnding ?? false);
          }
          setIsLoading(false);
        }
      };
      fetchSettings();
    }
  }, [isVisible, user]);

  const handleToggleDay = (day: DiaSemana) => {
    if (!treino || !onUpdateTreino) return;

    const currentDays = treino.diasSemana || [];
    const newDays = currentDays.includes(day)
      ? currentDays.filter(d => d !== day)
      : [...currentDays, day];

    // Ordena os dias para manter consistência
    newDays.sort((a, b) => DIAS_SEMANA_ORDEM[a] - DIAS_SEMANA_ORDEM[b]);

    onUpdateTreino({ ...treino, diasSemana: newDays });
  };

  const handleWorkoutScreenPreferenceSelect = async (preference: 'simplified' | 'complete') => {
    if (user) {
      try {
        await updateUserProfile(user.id, { workoutScreenType: preference });
        setWorkoutScreenType(preference);
        setPreferenceModalVisible(false);
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
      setDefaultRestTime(newSeconds);
    }
    setRestTimeDrawerVisible(false);
  };

  const handleRestTimeNotificationToggle = async (newValue: boolean) => {
    if (!user) return;

    if (newValue) {
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') {
        const { status: newStatus } = await Notifications.requestPermissionsAsync();
        if (newStatus !== 'granted') {
          Alert.alert("Permissão Negada", "As notificações não podem ser ativadas sem a sua permissão.");
          return;
        }
      }
    }

    setRestTimeNotificationEnabled(newValue);
    try {
      await updateUserProfile(user.id, {
        settings: {
          ...user.settings,
          notifications: { ...user.settings?.notifications, restTimeEnding: newValue },
        },
      });
    } catch (error) {
      console.error('Erro ao salvar configuração de notificação:', error);
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
            <Text style={styles.modalTitle}>Configurações</Text>
            <TouchableOpacity onPress={onClose}>
              <FontAwesome name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.settingsList}>
            {/* Seção de Dias da Semana - Exibida apenas se um treino for fornecido */}
            {treino && (
              <View style={styles.sectionContainer}>
                <Text style={styles.sectionTitle}>Dias da Semana</Text>
                <View style={styles.daysContainer}>
                  {DIAS_SEMANA_ARRAY.map(day => {
                    const isSelected = treino.diasSemana?.includes(day);
                    return (
                      <TouchableOpacity
                        key={day}
                        style={[styles.dayButton, isSelected && styles.dayButtonSelected]}
                        onPress={() => handleToggleDay(day)}
                      >
                        <Text style={[styles.dayButtonText, isSelected && styles.dayButtonTextSelected]}>
                          {day.toUpperCase()}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            <View style={styles.divider} />

            <Text style={styles.sectionTitle}>Preferências Globais</Text>

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
          </ScrollView>

          <WorkoutScreenPreference
            isVisible={isPreferenceModalVisible}
            onClose={() => setPreferenceModalVisible(false)}
            onSelectPreference={handleWorkoutScreenPreferenceSelect}
            currentPreference={workoutScreenType}
          />

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
    paddingTop: 0,
    backgroundColor: "#030405",
  },
  modalContainer: {
    flex: 1,
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
  },
  settingsList: {
    width: '100%',
    flex: 1,
  },
  sectionContainer: {
    marginBottom: 10,
  },
  sectionTitle: {
    color: '#888',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
    marginTop: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  divider: {
    height: 1,
    backgroundColor: '#222',
    marginVertical: 15,
  },
  // Day Selector Styles
  daysContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between', // Distribui melhor em telas pequenas
  },
  dayButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#141414',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ffffff1a',
  },
  dayButtonSelected: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  dayButtonText: {
    color: '#888',
    fontSize: 11,
    fontWeight: 'bold',
  },
  dayButtonTextSelected: {
    color: '#fff',
  },
  // Existing Setting Item Styles
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
    width: 24, // Fixed width for alignment
    textAlign: 'center',
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