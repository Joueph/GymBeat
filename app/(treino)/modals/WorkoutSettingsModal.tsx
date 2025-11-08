import { FontAwesome } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FlatList, Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { updateUserProfile } from '../../../userService'; // Assuming this path
import { useAuth } from '../../authprovider'; // Assuming this path

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

  useEffect(() => {
    if (isVisible) {
      translationY.value = 0;
    }
  }, [isVisible]);

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
        // Optionally, show an alert to the user
      }
    }
  };

  const settingsOptions = [
    {
      id: 'workoutScreenType',
      title: 'Tipo de Tela de Treino',
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

    return (
      <TouchableOpacity style={styles.settingItem} onPress={item.action}>
        <View>
          <Text style={styles.settingTitle}>{item.title}</Text>
          <Text style={styles.settingDescription}>{item.description}</Text>
        </View>
        <FontAwesome name="chevron-right" size={16} color="#888" />
      </TouchableOpacity>
    );
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
  cardSettingItem: {
    backgroundColor: '#2c2c2e',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
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
