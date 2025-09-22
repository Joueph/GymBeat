import React, { useState, useEffect, useLayoutEffect } from "react";
import { useAuth } from "../authprovider";

import { View, Text, Button, StyleSheet, Alert, TextInput, ActivityIndicator, ScrollView, Image, TouchableOpacity, Platform, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { signOut } from "firebase/auth";
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';

import { auth } from "../../firebaseconfig";
import { getUserProfile, updateUserProfile } from "../../userService";
import { uploadImageAndGetURL } from "../../services/storageService";
import { getLogsByUsuarioId } from "../../services/logService";
import { Usuario } from "../../models/usuario";

// Helper para converter Timestamps do Firestore e outros formatos para um objeto Date.
const toDate = (date: any): Date | null => {
  if (!date) return null;
  // Se for um objeto Timestamp do Firestore, use o método toDate()
  if (typeof date.toDate === 'function') return date.toDate();
  // Tenta criar uma data a partir do valor (pode ser string, número ou já um Date)
  const d = new Date(date);
  return isNaN(d.getTime()) ? null : d;
};

export default function PerfilScreen() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Partial<Usuario>>({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isSettingsModalVisible, setSettingsModalVisible] = useState(false);
  const [loggedDays, setLoggedDays] = useState<Set<string>>(new Set());
  const [calendarDate, setCalendarDate] = useState(new Date());
  const navigation = useNavigation();

  useLayoutEffect(() => {
    navigation.setOptions({
        headerRight: () => (
            <TouchableOpacity onPress={() => setSettingsModalVisible(true)} style={{ marginRight: 15 }}>
                <FontAwesome name="cog" size={24} color="#fff" />
            </TouchableOpacity>
        ),
    });
  }, [navigation]);

  useEffect(() => {
    const fetchProfileAndLogs = async () => {
      if (user) {
        setLoading(true);
        try {
          const [userProfile, userLogs] = await Promise.all([
            getUserProfile(user.uid),
            getLogsByUsuarioId(user.uid)
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
      setUploading(true);
      try {
        const uploadUrl = await uploadImageAndGetURL(result.assets[0].uri, user.uid);
        await updateUserProfile(user.uid, { photoURL: uploadUrl });
        setProfile(prev => ({ ...prev, photoURL: uploadUrl }));
        Alert.alert("Sucesso", "Foto de perfil atualizada!");
      } catch (error) {
        Alert.alert("Erro de Upload", "Não foi possível enviar sua foto.");
      } finally {
        setUploading(false);
      }
    }
  };
  
const handleUpdate = async () => {
    if (!user) return;
    try {
      // Começamos com um objeto limpo para garantir que não enviamos dados indesejados.
      const dataToUpdate: Partial<Usuario> = {
        nome: profile.nome,
        genero: profile.genero,
        nivel: profile.nivel,
        streakGoal: profile.streakGoal || 2,
      };

      // Adiciona os campos numéricos apenas se eles forem válidos, senão usa null.
      const alturaNum = Number(profile.altura);
      if (!isNaN(alturaNum) && alturaNum > 0) {
        dataToUpdate.altura = alturaNum;
      } else {
        dataToUpdate.altura = undefined;
      }

      const pesoNum = Number(profile.peso);
      if (!isNaN(pesoNum) && pesoNum > 0) {
        dataToUpdate.peso = pesoNum;
      } else {
        dataToUpdate.peso = undefined;
      }
      
      // Adiciona a data de nascimento apenas se for uma data válida, senão usa null.
      if (profile.dataNascimento) {
        const dataNasc = toDate(profile.dataNascimento);
        if (dataNasc) {
          dataToUpdate.dataNascimento = dataNasc;
        }
      }

      await updateUserProfile(user.uid, dataToUpdate);
      Alert.alert("Sucesso", "Perfil atualizado com sucesso!");
    } catch (error: any) {
      Alert.alert("Erro ao Atualizar", error.message);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error: any) {
      Alert.alert("Erro ao Sair", error.message);
    }
  };
  
  const handleChange = (field: keyof Usuario, value: any) => {
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
    <View style={{flex: 1, backgroundColor: "#0d181c"}}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.container}>
        <Text style={styles.title}>Seu Perfil</Text>
        <TouchableOpacity onPress={handlePickImage} disabled={uploading}>
          {profile.photoURL ? (
            <Image source={{ uri: profile.photoURL }} style={styles.pfp} />
          ) : (
            <View style={styles.pfpPlaceholder}><Text style={styles.placeholderText}>+</Text></View>
          )}
          {uploading && <ActivityIndicator style={styles.uploadIndicator} size="large" color="#4CAF50" />}
        </TouchableOpacity>
        <Text style={styles.profileName}>{profile.nome}</Text>
        <Text style={styles.emailText}>{user?.email}</Text>

        <View style={styles.widgetsContainer}>
            <View style={styles.widget}>
                <Text style={styles.widgetValue}>{profile.peso || '--'}</Text>
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
        visible={isSettingsModalVisible}
        onRequestClose={() => setSettingsModalVisible(false)}
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalSafeArea}>
          <ScrollView style={styles.modalScrollView} contentContainerStyle={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Configurações</Text>
                <TouchableOpacity onPress={() => setSettingsModalVisible(false)}>
                    <FontAwesome name="close" size={24} color="#fff" />
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>Nome</Text>
              <TextInput style={styles.input} placeholder="Seu Nome" placeholderTextColor="#ccc" value={profile.nome} onChangeText={(text) => handleChange('nome', text)} />

              <Text style={styles.label}>Altura (cm)</Text>
              <TextInput style={styles.input} placeholder="Ex: 175" placeholderTextColor="#ccc" keyboardType="numeric" value={profile.altura ? String(profile.altura) : ''} onChangeText={(text) => handleChange('altura', text)} />

              <Text style={styles.label}>Peso (kg)</Text>
              <TextInput style={styles.input} placeholder="Ex: 70.5" placeholderTextColor="#ccc" keyboardType="numeric" value={profile.peso ? String(profile.peso) : ''} onChangeText={(text) => handleChange('peso', text)} />

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
                <DateTimePicker testID="dateTimePicker" value={toDate(profile.dataNascimento) || new Date()} mode="date" display="default" onChange={handleDateChange} maximumDate={new Date()} themeVariant="dark" textColor="white" style={{ backgroundColor: '#173F5F' }} />
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
                <Button title="Salvar Alterações" onPress={handleUpdate} color="#4CAF50" />
              </View>
              
              <View style={{ marginTop: 40, width: '100%' }}>
                <Button title="Sair" onPress={handleSignOut} color="#f44336" />
              </View>
          </ScrollView>
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
    borderColor: '#4CAF50',
  },
  pfpPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: '#4CAF50',
    backgroundColor: '#173F5F',
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
    backgroundColor: "#0d181c",
  },
  modalScrollView: {
    backgroundColor: "#0d181c",
  },
  container: {
    flexGrow: 1,
    alignItems: "center",
    padding: 20,
    backgroundColor: "#0d181c",
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
    backgroundColor: "#173F5F",
    color: "#fff",
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#4CAF50",
    justifyContent: 'center',
    minHeight: 48,
  },
  optionContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15, width: '100%', gap: 10 },
  optionContainerVertical: { flexDirection: 'column', alignItems: 'stretch', marginBottom: 15, width: '100%' },
  optionButton: { paddingVertical: 12, paddingHorizontal: 10, backgroundColor: '#173F5F', borderRadius: 8, borderWidth: 1, borderColor: '#4CAF50', marginVertical: 5, flex: 1 },
  streakGoalButton: { paddingVertical: 12, paddingHorizontal: 10, backgroundColor: '#173F5F', borderRadius: 8, borderWidth: 1, borderColor: '#4CAF50', flex: 1, alignItems: 'center' },
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
    backgroundColor: '#173F5F',
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4CAF50',
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
    backgroundColor: '#173F5F',
    borderRadius: 10,
    padding: 15,
    marginTop: 10,
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
    backgroundColor: '#173F5F',
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
    backgroundColor: '#173F5F',
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
    backgroundColor: "#0d181c",
  },
  modalContainer: {
    flexGrow: 1,
    padding: 20,
    backgroundColor: "#0d181c",
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 24, fontWeight: "bold", color: "#fff"
  },
});