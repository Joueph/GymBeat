import { FontAwesome, FontAwesome5 } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker'; // This line is already correct.
import * as Device from 'expo-device';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import { useNavigation } from 'expo-router';
import { signOut } from "firebase/auth";
import React, { useEffect, useLayoutEffect, useState } from "react";
import { ActivityIndicator, Alert, Button, Image, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "./authprovider";

import { auth } from "../firebaseconfig";
import { Usuario } from "../models/usuario";
import { getLogsByUsuarioId } from "../services/logService";
import { cancelNotification, scheduleNotification } from "../services/notificationService";
import { uploadImageAndGetURL } from "../services/storageService";
import { getUserProfile, updateUserProfile } from "../userService";
import type { NotificationSettings, PrivacySettings } from './settings';
import SettingsPage from "./settings";

// Configuração inicial para o comportamento das notificações
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true, // Plays a sound when the notification is received
    shouldSetBadge: true, // Sets the badge number on the app icon
    shouldShowBanner: true, // (iOS) Show the notification as a banner
    shouldShowList: true, // (iOS) Show the notification in the notification list
  }),
});

// Helper para converter Timestamps do Firestore e outros formatos para um objeto Date.
const toDate = (date: any): Date | null => {
  if (!date) return null;
  // Se for um objeto Timestamp do Firestore, use o método toDate()
  if (typeof date.toDate === 'function') return date.toDate();
  // Tenta criar uma data a partir do valor (pode ser string, número ou já um Date)
  const d = new Date(date);
  return isNaN(d.getTime()) ? null : d;
};

export interface UserSettings {
  notifications: NotificationSettings;
  privacy: PrivacySettings & { profileVisibility: 'todos' | 'amigos' | 'ninguem' };
}

type ProfileWithSettings = Partial<Usuario> & {
  settings?: UserSettings;
  expoPushToken?: string;
  novoPeso?: string; // Propriedade para o campo de input do novo peso
};

const defaultNotificationSettings: NotificationSettings = {
  workoutReminders: true,
  workoutReminderTime: { hour: 9, minute: 0 },
  restTimeEnding: true,
  creatine: true,
  protein: true,
  hypercaloric: false,
  friendWorkoutDone: true,
  morningWorkout: undefined
};

const defaultPrivacySettings: PrivacySettings = {
  profileVisibility: 'amigos', weekStreak: 'todos', workoutDays: 'todos', workoutDetails: 'amigos', autoAcceptFriendRequests: false
};

export default function PerfilScreen() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileWithSettings>({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [newPhotoURI, setNewPhotoURI] = useState<string | null>(null); // Para a nova foto antes do upload
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isEditProfileModalVisible, setEditProfileModalVisible] = useState(false);
  const [isSettingsModalVisible, setSettingsModalVisible] = useState(false); // New state for the settings modal
  const [loggedDays, setLoggedDays] = useState<Set<string>>(new Set());
  const [calendarDate, setCalendarDate] = useState(new Date());
  const navigation = useNavigation();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 25 }}>
          <TouchableOpacity onPress={() => setEditProfileModalVisible(true)} style={{ marginRight: 0 }}>
            <FontAwesome5 name="user-edit" size={22} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setSettingsModalVisible(true)}
            style={{ marginRight: 15 }}
          >
            <FontAwesome name="cog" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
        ),
    });
  }, [navigation]);

  // Efeito para registrar para notificações locais
  useEffect(() => {
    const registerForNotificationsAsync = async () => {
      if (!user) return;

      // Solicita permissões para notificações locais
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.warn('[Notifications] Permissões de notificação negadas');
        return;
      }

      console.log('[Notifications] Permissões de notificação concedidas');

      // Push notifications only work on physical devices
      if (Device.isDevice) {
        try {
          const token = (await Notifications.getExpoPushTokenAsync()).data;
          
          // Salva o token no perfil do usuário se for diferente do já salvo
          if (token && profile.expoPushToken !== token) {
            await updateUserProfile(user.id, { expoPushToken: token } as Partial<Usuario>);
            setProfile(prev => ({ ...prev, expoPushToken: token }));
          }
        } catch (e) { 
          console.error("Falha ao obter o token de notificação", e); 
        }
      }
    };

    registerForNotificationsAsync();
  }, [user]); // Executa quando o usuário loga

  useEffect(() => {
    const fetchProfileAndLogs = async () => {
      if (user) {
        setLoading(true);
        try {
          const [userProfile, userLogs] = await Promise.all([
            getUserProfile(user.id),
            getLogsByUsuarioId(user.id)
          ]);
          if (userProfile) {
            setProfile(userProfile);
          }
          const logsSet = new Set(userLogs.map(log => toDate(log.horarioFim)?.toDateString()).filter((d): d is string => d !== null));
          setLoggedDays(logsSet);
        } catch (error) {
          Alert.alert("Erro", "Não foi possível carregar os dados do perfil.");
        } finally {
          setLoading(false);
        }
      }
    };
    fetchProfileAndLogs();
  }, [user]);

  const handlePickImage = async () => {
    if (!user) return;

    // Pedir permissão para acessar a galeria de mídia
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert("Permissão necessária", "Você precisa permitir o acesso à galeria para escolher uma foto.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled) {
      const uri = result.assets[0].uri;
      setNewPhotoURI(uri); // Armazena a URI local da nova imagem
      setProfile(prev => ({ ...prev, photoURL: uri })); // Atualiza a preview na UI
    }
  };
  
const handleUpdate = async () => {
    if (!user) return;
    try {
      setUploading(true); // Mostra o indicador de loading

      let finalPhotoURL = profile.photoURL;
      // Se uma nova imagem foi escolhida, faz o upload dela agora
      if (newPhotoURI) {
        finalPhotoURL = await uploadImageAndGetURL(newPhotoURI, user.id);
      }

      // Começamos com um objeto limpo para garantir que não enviamos dados indesejados.
      const dataToUpdate: Partial<Usuario> = {
        nome: profile.nome,
        genero: profile.genero,
        nivel: profile.nivel,
        streakGoal: profile.streakGoal || 2,
        weeksStreakGoal: profile.weeksStreakGoal || 4,
        photoURL: finalPhotoURL,
      };

      // Adiciona a altura apenas se for um número válido.
      const alturaNum = Number(profile.altura);
      if (!isNaN(alturaNum) && alturaNum > 0) {
        dataToUpdate.altura = alturaNum;
      } else {
        dataToUpdate.altura = undefined;
      }
      
      // Adiciona um novo registro de peso ao histórico se um valor válido for fornecido.
      const pesoNum = Number(profile.novoPeso);
      if (!isNaN(pesoNum) && pesoNum > 0) {
        const novoRegistroPeso = { valor: pesoNum, data: new Date() };
        // Garante que o histórico exista antes de adicionar
        const historicoAtual = profile.historicoPeso || [];
        dataToUpdate.historicoPeso = [...historicoAtual, novoRegistroPeso];
      }
      
      // Adiciona a data de nascimento apenas se for uma data válida.
      if (profile.dataNascimento) {
        const dataNasc = toDate(profile.dataNascimento);
        if (dataNasc) {
          dataToUpdate.dataNascimento = dataNasc;
        }
      }

      await updateUserProfile(user.id, dataToUpdate);
      setNewPhotoURI(null); // Limpa a URI temporária após o sucesso
      handleChange('novoPeso', ''); // Limpa o campo de novo peso
      Alert.alert("Sucesso", "Perfil atualizado com sucesso!");
      setEditProfileModalVisible(false); // Fecha o modal
    } catch (error: any) {
      Alert.alert("Erro ao Atualizar", error.message);
    } finally {
      setUploading(false); // Esconde o indicador de loading
    }
  };

  const handleSettingsChange = async (newSettings: UserSettings) => {
    if (!user) return;
    try {
      // Salva as configurações no Firestore
      await updateUserProfile(user.id, { settings: newSettings } as Partial<Usuario>);
      setProfile(prev => ({ ...prev, settings: newSettings }));

      // Gerencia as notificações locais com base nas novas configurações
      if (newSettings.notifications.creatine) {
        scheduleNotification('creatine-reminder', 'Lembrete de Creatina', 'Hora de tomar sua creatina para manter a força!', { hour: 9, minute: 0, repeats: true });
      } else {
        cancelNotification('creatine-reminder');
      }

      if (newSettings.notifications.morningWorkout) {
        scheduleNotification('morning-workout-reminder', 'Hora de Treinar!', 'Que tal começar o dia com um bom treino?', { hour: 8, minute: 0, repeats: true });
      } else {
        cancelNotification('morning-workout-reminder');
      }
      // Adicione lógica para outras notificações aqui...

      // Lógica para a nova notificação de fim de intervalo
      if (newSettings.notifications.restTimeEnding) {
        const { status } = await Notifications.getPermissionsAsync();
        if (status !== 'granted') {
          const { status: newStatus } = await Notifications.requestPermissionsAsync();
          if (newStatus !== 'granted') {
            // Se o usuário negar, desfaz a alteração no estado visual
            const revertedSettings = {
              ...newSettings,
              notifications: {
                ...newSettings.notifications,
                restTimeEnding: false,
              },
            };
            setProfile(prev => ({ ...prev, settings: revertedSettings }));
            Alert.alert("Permissão Negada", "As notificações não podem ser ativadas sem a sua permissão.");
            return; // Interrompe a execução para não salvar o estado "true"
          }
        }
      }

    } catch (error) {
      console.error("Erro ao salvar configurações:", error);
      Alert.alert("Erro", "Não foi possível salvar suas configurações.");
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error: any) {
      Alert.alert("Erro ao Sair", error.message);
    }
  };
  
  const handleChange = (field: keyof ProfileWithSettings, value: any) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  const handleDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    const currentDate = selectedDate || new Date();
    setShowDatePicker(Platform.OS === 'ios'); // Fecha o picker no iOS, no Android ele fecha automaticamente
    if (selectedDate) {
      setProfile(prev => ({ ...prev, dataNascimento: currentDate }));
    }
  };

  const formatDate = (date?: any) => {
    const d = toDate(date);
    return d ? d.toLocaleDateString('pt-BR') : "";
  };

  const renderCalendar = () => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const monthName = calendarDate.toLocaleString('pt-BR', { month: 'long' });

    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days = [];
    for (let i = 0; i < firstDayOfMonth; i++) {
        days.push(<View key={`blank-${i}`} style={styles.dayCell} />);
    }

    for (let i = 1; i <= daysInMonth; i++) {
        const dayDate = new Date(year, month, i);
        const isLogged = loggedDays.has(dayDate.toDateString());
        days.push(
            <View key={i} style={styles.dayCell}>
                <View style={[styles.dayRing, isLogged ? styles.loggedDayRing : styles.defaultDayRing]}>
                    <Text style={styles.dayText}>{i}</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.calendarContainer}>
            <View style={styles.calendarHeader}>
                <TouchableOpacity onPress={() => setCalendarDate(new Date(year, month - 1, 1))}>
                    <FontAwesome name="chevron-left" size={18} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.calendarMonth}>{`${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${year}`}</Text>
                <TouchableOpacity onPress={() => setCalendarDate(new Date(year, month + 1, 1))}>
                    <FontAwesome name="chevron-right" size={18} color="#fff" />
                </TouchableOpacity>
            </View>
            <View style={styles.weekDaysContainer}>
                {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day, i) => <Text key={i} style={styles.weekDayText}>{day}</Text>)}
            </View>
            <View style={styles.calendarGrid}>
                {days}
            </View>
        </View>
    );
  };

  if (loading) {
    return <ActivityIndicator style={styles.container} size="large" color="#fff" />;
  }

  return (
    <View style={{flex: 1, backgroundColor: "#030405"}}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.container}>
        <View>
          {profile.photoURL ? (
            <Image source={{ uri: profile.photoURL }} style={styles.pfp} />
          ) : (
            <View style={styles.pfpPlaceholder}><FontAwesome name="user" size={50} color="#555" /></View>
          )}
          {uploading && <ActivityIndicator style={styles.uploadIndicator} size="large" color="#ffffff1a" />}
        </View>
        <Text style={styles.profileName}>{profile.nome}</Text>
        <Text style={styles.emailText}>{user?.email}</Text>

        {/* Exibe o peso mais recente do histórico */}
        <View style={styles.widgetsContainer}>
            <View style={styles.widget}>
                <Text style={styles.widgetValue}>
                  {profile.historicoPeso && profile.historicoPeso.length > 0 
                    ? profile.historicoPeso[profile.historicoPeso.length - 1].valor 
                    : '--'}
                </Text>
                <Text style={styles.widgetLabel}>Peso (kg)</Text>
            </View>
            <View style={styles.widget}>
                <Text style={styles.widgetValue}>{profile.altura || '--'}</Text>
                <Text style={styles.widgetLabel}>Altura (cm)</Text>
            </View>
        </View>

        {renderCalendar()}

      </ScrollView>

      <Modal
        animationType="slide"
        visible={isEditProfileModalVisible}
        onRequestClose={() => setEditProfileModalVisible(false)}
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalSafeArea}>
          <ScrollView style={styles.modalScrollView} contentContainerStyle={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Editar Perfil</Text>
                <TouchableOpacity onPress={() => setEditProfileModalVisible(false)}>
                    <FontAwesome name="close" size={24} color="#fff" />
                </TouchableOpacity>
              </View>

              <View style={styles.modalPfpContainer}>
                <TouchableOpacity onPress={handlePickImage}>
                  {newPhotoURI || profile.photoURL ? (
                    <Image source={{ uri: profile.photoURL }} style={styles.pfp} />
                  ) : (
                    <View style={styles.pfpPlaceholder}><FontAwesome name="camera" size={40} color="#555" /></View>
                  )}
                </TouchableOpacity>
                <Text style={styles.changePfpText}>Toque na imagem para alterar</Text>
              </View>

              <Text style={styles.label}>Nome</Text>
              <TextInput style={styles.input} placeholder="Seu Nome" placeholderTextColor="#ccc" value={profile.nome} onChangeText={(text) => handleChange('nome', text)} />

              <Text style={styles.label}>Altura (cm)</Text>
              <TextInput style={styles.input} placeholder="Ex: 175" placeholderTextColor="#ccc" keyboardType="numeric" value={profile.altura ? String(profile.altura) : ''} onChangeText={(text) => handleChange('altura', text)} />

              <Text style={styles.label}>Peso (kg)</Text>
              <TextInput style={styles.input} placeholder="Adicionar novo registro de peso" placeholderTextColor="#ccc" keyboardType="numeric" value={profile.novoPeso ? String(profile.novoPeso) : ''} onChangeText={(text) => handleChange('novoPeso', text)} />
              
              <Text style={styles.label}>Gênero</Text>
              <View style={styles.optionContainer}>
                {(['Masculino', 'Feminino', 'Outro'] as const).map(g => (
                    <TouchableOpacity key={g} style={[styles.optionButton, profile.genero === g && styles.optionSelected]} onPress={() => handleChange('genero', g)}>
                        <Text style={styles.optionText}>{g}</Text>
                    </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Nível na Academia</Text>
              <View style={styles.optionContainerVertical}>
                  {(['Iniciante', 'Intermediário', 'Avançado'] as const).map(n => (
                      <TouchableOpacity key={n} style={[styles.optionButton, profile.nivel === n && styles.optionSelected]} onPress={() => handleChange('nivel', n)}>
                          <Text style={styles.optionText}>{n}</Text>
                      </TouchableOpacity>
                  ))}
              </View>

              <Text style={styles.label}>Meta de Treinos Semanal (para Sequência)</Text>
              <View style={styles.optionContainer}>
                  {[2, 3, 4, 5, 6, 7].map(d => (
                      <TouchableOpacity key={d} style={[styles.streakGoalButton, (profile.streakGoal || 2) === d && styles.optionSelected]} onPress={() => handleChange('streakGoal', d)}>
                          <Text style={styles.optionText}>{d}</Text>
                      </TouchableOpacity>
                  ))}
              </View>

              <Text style={styles.label}>Data de Nascimento</Text>
              <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.input}>
                <Text style={{ color: profile.dataNascimento ? '#fff' : '#ccc' }}>
                  {profile.dataNascimento ? formatDate(profile.dataNascimento) : "Selecione a Data"}
                </Text>
              </TouchableOpacity>

              {showDatePicker && (
                <DateTimePicker testID="dateTimePicker" value={toDate(profile.dataNascimento) || new Date()} mode="date" display="default" onChange={handleDateChange} maximumDate={new Date()} themeVariant="dark" textColor="white" style={{ backgroundColor: '#141414' }} />
              )}

              <Text style={styles.label}>Plano</Text>
              {profile.isPro ? (
                  <View style={styles.proPlanContainer}><Text style={styles.proPlanText}>Você é um membro PRO! ✨</Text></View>
              ) : (
                  <View style={styles.freePlanContainer}>
                      <Text style={styles.freePlanText}>Você está no plano Gratuito.</Text>
                      <Button title="Upgrade para o PRO" onPress={() => Alert.alert("Em Breve", "A funcionalidade de upgrade será adicionada em breve.")} color="#DAA520" />
                  </View>
              )}

              <View style={{ width: '100%', marginTop: 20 }}>
                <Button title="Salvar Alterações" onPress={handleUpdate} color="#1cb0f6" disabled={uploading} />
              </View>
              
              <View style={{ marginTop: 40, width: '100%' }}>
                <Button title="Sair" onPress={handleSignOut} color="#f44336" />
              </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* New Settings Modal */}
      <Modal
        animationType="slide"
        visible={isSettingsModalVisible}
        onRequestClose={() => setSettingsModalVisible(false)}
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Opções</Text>
            <TouchableOpacity onPress={() => setSettingsModalVisible(false)}>
              <FontAwesome name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          <SettingsPage
            initialSettings={{
              // Merge saved settings with defaults to prevent crashes on missing properties
              notifications: { ...defaultNotificationSettings, ...profile.settings?.notifications },
              privacy: { ...defaultPrivacySettings, ...profile.settings?.privacy }
            } as UserSettings}
            onSettingsChange={handleSettingsChange}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  pfp: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: '#ffffff1a',
  },
  pfpPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: '#ffffff1a',
    backgroundColor: '#141414',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#ccc',
    fontSize: 40,
    fontWeight: '300',
  },
  changePfpText: {
    color: '#ccc',
    fontSize: 12,
    marginBottom: 20,
  },
  uploadIndicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  scrollView: {
    backgroundColor: "#030405",
  },
  modalScrollView: {
    backgroundColor: "#030405",
  },
  container: {
    flexGrow: 1,
    alignItems: "center",
    padding: 20,
    backgroundColor: "#030405",
  },
  title: { fontSize: 28, fontWeight: "bold", color: "#fff", marginBottom: 20, alignSelf: 'flex-start' },
  profileName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 10,
  },
  emailText: { fontSize: 14, color: "#ccc", marginBottom: 20 },
  label: {
    fontSize: 16,
    color: "#fff",
    alignSelf: 'flex-start',
    marginLeft: '5%',
    marginBottom: 5,
  },
  input: {
    width: "100%",
    backgroundColor: "#141414",
    color: "#fff",
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#ffffff1a",
    justifyContent: 'center',
    minHeight: 48,
  },
  optionContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15, width: '100%', gap: 10 },
  optionContainerVertical: { flexDirection: 'column', alignItems: 'stretch', marginBottom: 15, width: '100%' },
  optionButton: { paddingVertical: 12, paddingHorizontal: 10, backgroundColor: '#141414', borderRadius: 8, borderWidth: 1, borderColor: '#ffffff1a', marginVertical: 5, flex: 1 },
  streakGoalButton: { paddingVertical: 12, paddingHorizontal: 10, backgroundColor: '#141414', borderRadius: 8, borderWidth: 1, borderColor: '#ffffff1a', flex: 1, alignItems: 'center' },
  optionSelected: { backgroundColor: '#1cb0f6', borderColor: '#fff' },
  optionText: { color: '#fff', textAlign: 'center', fontWeight: 'bold' },

  widgetsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginVertical: 20,
    gap: 15,
  },
  widget: {
    flex: 1,
    backgroundColor: '#ffffff13',
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ffffff52',
  },
  widgetValue: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  widgetLabel: {
    color: '#ccc',
    fontSize: 14,
    marginTop: 5,
  },

  // Calendar Styles
  calendarContainer: {
    width: '100%',
    backgroundColor: '#ffffff13',
    borderRadius: 10,
    padding: 15,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#ffffff52',
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  calendarMonth: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  weekDaysContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 10,
  },
  weekDayText: {
    color: '#ccc',
    fontWeight: 'bold',
    width: '14.28%',
    textAlign: 'center',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayRing: {
    width: '85%',
    height: '85%',
    borderRadius: 50,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  defaultDayRing: {
    borderColor: '#555',
  },
  loggedDayRing: {
    borderColor: '#DAA520',
  },
  dayText: {
    color: '#fff',
  },

  freePlanContainer: {
    width: '100%',
    backgroundColor: '#141414',
    borderRadius: 8,
    padding: 15,
    marginBottom: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DAA520', // Dourado
  },
  freePlanText: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 10,
  },
  proPlanContainer: {
    width: '100%',
    backgroundColor: '#141414',
    borderRadius: 8,
    padding: 15,
    marginBottom: 20,
    alignItems: 'center',
  },
  proPlanText: {
    color: '#DAA520', // Dourado
    fontSize: 16,
    fontWeight: 'bold',
  },

  // Modal Styles
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
  modalPfpContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 24, fontWeight: "bold", color: "#fff"
  },
});