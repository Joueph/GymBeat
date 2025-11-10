import { FontAwesome } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Modal, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { FlatList, Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { updateUserProfile } from '../../../userService';
import { useAuth } from '../../authprovider';

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
  const scrollRef = useRef<FlatList<any>>(null);
  const scrollY = useSharedValue(0);
  const translationY = useSharedValue(0);
  const isModalActive = useSharedValue(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  useEffect(() => {
    if (isVisible) {
      translationY.value = 0;
      // Verifica o estado inicial das permissões e configurações do usuário
      const checkInitialStatus = async () => {
        if (user?.settings?.notifications?.restTimeEnding) {
          const { status } = await Notifications.getPermissionsAsync();
          setNotificationsEnabled(status === 'granted');
        } else {
          setNotificationsEnabled(false);
        }
      };
      checkInitialStatus();
    }
  }, [isVisible, user]);

  const panGesture = Gesture.Pan()
    .onBegin(() => {
      isModalActive.value = scrollY.value <= 0;
    })
    .onChange((event) => {
      if (isModalActive.value && event.translationY > 0) {
        translationY.value = event.translationY;
      }
    })
    .onEnd(() => {
      if (translationY.value > 150) {
        runOnJS(onClose)();
      } else {
        translationY.value = withSpring(0);
      }
    });

  const nativeScroll = Gesture.Native().shouldCancelWhenOutside(false);
  const composed = Gesture.Simultaneous(panGesture, nativeScroll);

  const animatedModalStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translationY.value }],
  }));

  const handleWorkoutScreenPreferenceSelect = async (preference: 'simplified' | 'complete') => {
    if (user) {
      try {
        await updateUserProfile(user.id, { workoutScreenType: preference });
        onWorkoutScreenTypeChange(preference);
      } catch (error) {
        console.error('Erro ao salvar preferência de tela de treino:', error);
      }
    }
  };

  const handleNotificationToggle = async (newValue: boolean) => {
    if (!user) return;

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

    // Se a permissão foi concedida (ou já existia), ou se está desativando
    setNotificationsEnabled(newValue);
    try {
      // Cria um objeto de configurações atualizado para salvar no perfil
      const updatedSettings = {
        ...user.settings,
        notifications: {
          ...user.settings?.notifications,
          restTimeEnding: newValue,
        },
      };
      await updateUserProfile(user.id, { settings: updatedSettings });
    } catch (error) {
      console.error('Erro ao salvar configuração de notificação:', error);
    }
  };

  const settingsOptions = [
    {
      id: 'workoutScreenType',
      title: 'Tipo de Tela de Treino',
    },
    {
      id: 'restTimeNotification',
      title: 'Notificar ao fim do intervalo',
    },
  ];

  const renderSettingItem = ({ item }: { item: (typeof settingsOptions)[0] }) => {
    if (item.id === 'workoutScreenType') {
      return (
        <View style={styles.cardSettingItem}>
          <Text style={styles.settingTitle}>{item.title}</Text>
          <View style={styles.cardContainer}>
            <TouchableOpacity
              style={styles.cardOption}
              onPress={() => handleWorkoutScreenPreferenceSelect('simplified')}
            >
              <Text style={[styles.cardOptionText, currentWorkoutScreenType === 'simplified' && styles.cardOptionTextSelected]}>
                Simplificada
              </Text>
            </TouchableOpacity>
            <View style={styles.separator} />
            <TouchableOpacity
              style={styles.cardOption}
              onPress={() => handleWorkoutScreenPreferenceSelect('complete')}
            >
              <Text style={[styles.cardOptionText, currentWorkoutScreenType === 'complete' && styles.cardOptionTextSelected]}>
                Completa
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    if (item.id === 'restTimeNotification') {
      return (
        <View style={styles.cardSettingItem}>
          <View style={styles.switchSettingItem}>
            <Text style={styles.settingTitle}>{item.title}</Text>
            <Switch onValueChange={handleNotificationToggle} value={notificationsEnabled} />
          </View>
        </View>
      );
    }

    return null; // Para outras configurações futuras
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={isVisible}
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={styles.centeredView}>
          <GestureDetector gesture={composed}>
            <Animated.View style={[styles.modalView, animatedModalStyle]}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={onClose}>
                  <FontAwesome name="arrow-down" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.modalMainTitle}>Configurações</Text>
                <View style={{ width: 24 }} />
              </View>

              <FlatList
                ref={scrollRef}
                onScroll={(e) => {
                  scrollY.value = e.nativeEvent.contentOffset.y;
                }}
                scrollEventThrottle={16}
                data={settingsOptions}
                keyExtractor={(item) => item.id}
                renderItem={renderSettingItem}
                style={styles.settingsList}
              />
            </Animated.View>
          </GestureDetector>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  modalView: {
    margin: 0,
    backgroundColor: '#141414',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    width: '100%',
    height: '90%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -3,
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
  cardSettingItem: {
    backgroundColor: '#2c2c2e',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
  },
  switchSettingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  settingTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cardContainer: {
    flexDirection: 'row',
    marginTop: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#555',
    overflow: 'hidden',
  },
  cardOption: {
    flex: 1,
    padding: 15,
    alignItems: 'center',
  },
  cardOptionText: {
    color: '#aaa',
    fontWeight: 'bold',
    fontSize: 16,
  },
  cardOptionTextSelected: {
    color: '#1cb0f6',
  },
  separator: {
    width: 1,
    backgroundColor: '#555',
  },
});