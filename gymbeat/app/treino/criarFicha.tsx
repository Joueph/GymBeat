import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TextInput, Button, ActivityIndicator, Alert, Switch, TouchableOpacity, Image, Text } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getFichaById, updateFicha, getFichaAtiva, setFichaAtiva } from '../../services/fichaService';
import { uploadImageAndGetURL } from '../../services/storageService';
import { getUserProfile } from '../../userService';
import { Ficha } from '../../models/ficha';
import { Usuario } from '../../models/usuario';
import { useAuth } from '../authprovider';
import * as ImagePicker from 'expo-image-picker';

export default function CriarFichaScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { fichaId } = useLocalSearchParams<{ fichaId: string }>();
  
  const [ficha, setFicha] = useState<Partial<Ficha>>({ nome: '', ativa: false });
  const [profile, setProfile] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  useEffect(() => {
    if (!fichaId) {
      Alert.alert("Erro", "Nenhuma ficha selecionada.");
      router.back();
      return;
    }

    const fetchInitialData = async () => {
      if (!user) {
        Alert.alert("Erro", "Usuário não autenticado.");
        router.back();
        return;
      }
      try {
        setLoading(true);
        const [fetchedFicha, userProfile] = await Promise.all([
          getFichaById(fichaId),
          getUserProfile(user.uid)
        ]);

        if (fetchedFicha) {
          setFicha(fetchedFicha);
        } else {
          Alert.alert("Erro", "Ficha não encontrada.");
          router.back();
        }
        setProfile(userProfile);
      } catch (error) {
        console.error("Erro ao buscar ficha:", error);
        Alert.alert("Erro", "Não foi possível carregar os dados da ficha.");
        router.back();
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, [fichaId, user]);

  const handlePickImage = async () => {
    if (!fichaId) return;

    if (!profile?.isPro) {
      Alert.alert(
        "Recurso PRO",
        "Adicionar imagens às suas fichas é um recurso exclusivo para membros PRO. Faça o upgrade para personalizar seus treinos!",
        [{ text: "OK" }]
      );
      return;
    }

    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert("Permissão necessária", "Você precisa permitir o acesso à galeria para escolher uma foto.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });

    if (!result.canceled) {
      setIsUploadingImage(true);
      try {
        const uploadUrl = await uploadImageAndGetURL(result.assets[0].uri, `fichas/${fichaId}/cover`);
        setFicha(prev => ({ ...prev, imagemUrl: uploadUrl }));
      } catch (error) {
        Alert.alert("Erro de Upload", "Não foi possível enviar a imagem da ficha.");
      } finally {
        setIsUploadingImage(false);
      }
    }
  };

  const handleSave = async () => {
    if (!fichaId || !ficha.nome?.trim()) {
      Alert.alert("Atenção", "O nome da ficha é obrigatório.");
      return;
    }

    if (!user) {
      Alert.alert("Erro", "Usuário não autenticado.");
      return;
    }

    setIsSaving(true);
    try {
      const dataToUpdate: Partial<Ficha> = { 
        nome: ficha.nome,
        imagemUrl: ficha.imagemUrl
      };

      if (ficha.ativa) {
        await updateFicha(fichaId, dataToUpdate);
        await setFichaAtiva(user.uid, fichaId);
      } else {
        // Se estamos desativando, podemos atualizar tudo de uma vez.
        dataToUpdate.ativa = false;
        await updateFicha(fichaId, dataToUpdate);
      }

      Alert.alert("Sucesso", "Ficha salva com sucesso!");
      router.back();
    } catch (error) {
      console.error("Erro ao salvar ficha:", error);
      Alert.alert("Erro", "Não foi possível salvar as alterações.");
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#fff" />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      {/* Use Stack.Screen to configure the header for this screen */}
      <Stack.Screen
        options={{
          title: 'Editar Ficha',
          headerShown: true,
          headerStyle: { backgroundColor: 'rgba(255, 255, 255, 0.05)' },
          headerTintColor: '#fff',
        }}
      />
      
      <TouchableOpacity onPress={handlePickImage} disabled={isUploadingImage} style={styles.imagePicker}>
        <Image
            source={{ uri: ficha.imagemUrl ?? 'https://via.placeholder.com/400x200.png?text=Toque+para+adicionar+imagem' }}
            style={styles.fichaImage} 
        />
        {!profile?.isPro && ficha.imagemUrl && (
          <View style={styles.proOverlay}>
            <Text style={styles.proBadgeText}>PRO</Text>
          </View>
        )}
        {isUploadingImage && <ActivityIndicator style={styles.uploadIndicator} size="large" color="#fff" />}
      </TouchableOpacity>

      <ThemedText style={styles.label}>Nome da Ficha</ThemedText>
      <TextInput
        style={styles.input}
        placeholder="Ex: Treino de Peito e Tríceps"
        placeholderTextColor="#ccc"
        value={ficha.nome}
        onChangeText={(text) => setFicha(prev => ({ ...prev, nome: text }))}
      />

      {/* Switch para definir como Ficha Ativa */}
      <View style={styles.switchContainer}>
        <ThemedText style={styles.labelSwitch}>Definir como Ficha Ativa</ThemedText>
        <Switch
          trackColor={{ false: "#767577", true: "#81b0ff" }}
          thumbColor={ficha.ativa ? "#4CAF50" : "#f4f3f4"}
          ios_backgroundColor="#3e3e3e"
          onValueChange={(value) => setFicha(prev => ({ ...prev, ativa: value }))}
          value={!!ficha.ativa} // Garante que o valor é sempre booleano
        />
      </View>

      <Button title={isSaving ? "Salvando..." : "Salvar Ficha"} onPress={handleSave} color="#4CAF50" disabled={isSaving} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    padding: 20,
    backgroundColor: "#0d181c",
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: "#0d181c",
  },
  imagePicker: {
    width: '90%',
    marginBottom: 20,
  },
  fichaImage: {
    width: '100%',
    height: 180,
    borderRadius: 8,
    backgroundColor: '#333',
  },
  uploadIndicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  proOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  proBadgeText: {
    color: '#DAA520', // Dourado
    fontSize: 24,
    fontWeight: 'bold',
    borderWidth: 2,
    borderColor: '#DAA520',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
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
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#4CAF50",
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '90%',
    marginBottom: 30,
    backgroundColor: '#173F5F',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#4CAF50",
  },
  labelSwitch: {
    fontSize: 16,
    color: "#fff",
  },
});