import React, { useState, useEffect } from "react";
import { useAuth } from "../authprovider";

import { View, Text, Button, StyleSheet, Alert, TextInput, ActivityIndicator, ScrollView, Image, TouchableOpacity, Platform } from "react-native";
import { signOut } from "firebase/auth";
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';

import { auth } from "../../firebaseconfig";
import { getUserProfile, updateUserProfile } from "../../userService";
import { uploadImageAndGetURL } from "../../services/storageService";
import { Usuario } from "../../models/usuario";

export default function PerfilScreen() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Partial<Usuario>>({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);


  useEffect(() => {
    const fetchProfile = async () => {
      if (user) {
        try {
          const userProfile = await getUserProfile(user.uid);
          if (userProfile) {
            setProfile(userProfile);
          }
        } catch (error) {
          Alert.alert("Erro", "Não foi possível carregar os dados do perfil.");
        } finally {
          setLoading(false);
        }
      }
    };
    fetchProfile();
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
        const dataNasc = new Date(profile.dataNascimento as any);
        // Verifica se a data é válida antes de adicionar
        if (!isNaN(dataNasc.getTime())) {
          dataToUpdate.dataNascimento = dataNasc;
        } else {
          dataToUpdate.dataNascimento = undefined;
        }
      } else {
        dataToUpdate.dataNascimento = undefined;
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
  
  const handleChange = (field: keyof Usuario, value: string) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  const handleDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    const currentDate = selectedDate || new Date();
    setShowDatePicker(Platform.OS === 'ios'); // Fecha o picker no iOS, no Android ele fecha automaticamente
    if (selectedDate) {
      setProfile(prev => ({ ...prev, dataNascimento: currentDate }));
    }
  };

  const formatDate = (date?: Date | string) => {
    if (!date) return "";
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString('pt-BR');
  };



  if (loading) {
    return <ActivityIndicator style={styles.container} size="large" color="#fff" />;
  }

  return (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.container}>
      <TouchableOpacity onPress={handlePickImage} disabled={uploading}>
        <Image
          source={{ uri: profile.photoURL }}
          style={styles.pfp} 
        />
        {uploading && <ActivityIndicator style={styles.uploadIndicator} size="large" color="#4CAF50" />}
      </TouchableOpacity>
      <Text style={styles.changePfpText}>Toque na imagem para alterar</Text>

      <Text style={styles.emailText}>Logado como: {user?.email}</Text>
      
      <Text style={styles.label}>Nome</Text>
      <TextInput
        style={styles.input}
        placeholder="Seu Nome"
        placeholderTextColor="#ccc"
        value={profile.nome}
        onChangeText={(text) => handleChange('nome', text)}
      />

      <Text style={styles.label}>Altura (cm)</Text>
      <TextInput
        style={styles.input}
        placeholder="Ex: 175"
        placeholderTextColor="#ccc"
        keyboardType="numeric"
        value={profile.altura ? String(profile.altura) : ''}
        onChangeText={(text) => handleChange('altura', text)}
      />

      <Text style={styles.label}>Peso (kg)</Text>
      <TextInput
        style={styles.input}
        placeholder="Ex: 70.5"
        placeholderTextColor="#ccc"
        keyboardType="numeric"
        value={profile.peso ? String(profile.peso) : ''}
        onChangeText={(text) => handleChange('peso', text)}
      />

      <Text style={styles.label}>Data de Nascimento</Text>
      <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.input}>
        <Text style={{ color: profile.dataNascimento ? '#fff' : '#ccc' }}>
          {profile.dataNascimento ? formatDate(profile.dataNascimento) : "Selecione a Data"}
        </Text>
      </TouchableOpacity>

      {showDatePicker && (
        <DateTimePicker
          testID="dateTimePicker"
          value={profile.dataNascimento ? new Date(profile.dataNascimento) : new Date()}
          mode="date"
          display="default"
          onChange={handleDateChange}
          maximumDate={new Date()} // Não permite datas futuras
          themeVariant="dark" // Força o tema escuro
          textColor="white" // Tenta forçar a cor do texto para branco (pode não funcionar em todas as plataformas/versões)
          style={{ backgroundColor: '#173F5F' }} // Estilo para o background do picker
        />
      )}



      <Button title="Salvar Alterações" onPress={handleUpdate} color="#4CAF50" />
      
      <View style={{ marginTop: 40, width: '90%' }}>
        <Button title="Sair" onPress={handleSignOut} color="#f44336" />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // ... (estilos anteriores)
  pfp: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: '#4CAF50',
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
  container: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#0d181c",
  },
  title: { fontSize: 24, fontWeight: "bold", color: "#fff", marginBottom: 10 },
  emailText: { fontSize: 16, color: "#ccc", marginBottom: 30 },
  label: {
    fontSize: 16,
    color: "#fff",
    alignSelf: 'flex-start',
    marginLeft: '5%',
    marginBottom: 5,
  },
  input: {
    width: "90%",
    backgroundColor: "#173F5F",
    color: "#fff",
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#4CAF50",
  },
});