import React, { useState, useEffect } from "react";
import { View, Text, Button, StyleSheet, Alert, TextInput, ActivityIndicator, ScrollView, Image, TouchableOpacity } from "react-native";
import { signOut } from "firebase/auth";
import * as ImagePicker from 'expo-image-picker';

import { useAuth } from "../authprovider";
import { auth } from "../../firebaseconfig";
import { getUserProfile, updateUserProfile } from "../../userService";
import { uploadImageAndGetURL } from "../../services/storageService";
import { Usuario } from "../../models/usuario";

export default function PerfilScreen() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Partial<Usuario>>({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

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
      const dataToUpdate = {
        ...profile,
        altura: Number(profile.altura) || undefined,
        peso: Number(profile.peso) || undefined,
        dataNascimento: profile.dataNascimento ? new Date(profile.dataNascimento) : undefined,
      };
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

  if (loading) {
    return <ActivityIndicator style={styles.container} size="large" color="#fff" />;
  }

  return (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.container}>
      <TouchableOpacity onPress={handlePickImage} disabled={uploading}>
        <Image 
          source={profile.photoURL ? { uri: profile.photoURL } : require('../../assets/images/default-pfp.png')} 
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

      {/* ... outros inputs ... */}

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