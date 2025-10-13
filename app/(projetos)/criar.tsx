import { FontAwesome } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { MetaProjeto, Projeto } from '../../models/projeto';
import { createProjeto, getProjetoById, updateProjeto } from '../../services/projetoService';
import { useAuth } from '../authprovider';

// Helper function using a more robust XMLHttpRequest for blob conversion
const uploadCapaProjeto = (uri: string | null, userId: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        // If there's no new local image URI, resolve with the existing one
        if (!uri || !uri.startsWith('file://')) {
            return resolve(uri || '');
        }

        // Convert URI to Blob using XMLHttpRequest
        const xhr = new XMLHttpRequest();
        
        // On success, upload the blob to Firebase Storage
        xhr.onload = async () => {
            try {
                const blob = xhr.response; // This is the blob
                const storage = getStorage();
                const storageRef = ref(storage, `projetos/${userId}/capa_${Date.now()}.jpg`);
                
                const snapshot = await uploadBytes(storageRef, blob);
                const downloadURL = await getDownloadURL(snapshot.ref);
                
                resolve(downloadURL);
            } catch (error) {
                console.error("Erro durante o upload para o Firebase:", error);
                reject(error);
            }
        };

        // On failure, reject the promise
        xhr.onerror = (e) => {
            console.error("Erro de XHR ao processar a imagem:", e);
            reject(new TypeError('Falha na requisição da imagem.'));
        };

        // Set the response type and open the request
        xhr.responseType = 'blob';
        xhr.open('GET', uri, true);
        xhr.send(null);
    });
};

// Componente para a barra de progresso
const ProgressBar = ({ progress }: { progress: number }) => (
  <View style={styles.progressBarContainer}>
    <View style={[styles.progressBar, { width: `${progress}%` }]} />
  </View>
);

export default function CriarProjetoScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const isEditing = !!params.id;
  const TOTAL_STEPS = 3; // Título/Descrição, Meta, Foto

  // Estado para controlar a etapa atual
  const [step, setStep] = useState(1);

  // Estados para os campos do formulário
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [meta, setMeta] = useState<MetaProjeto>({ tipo: 'diasPorSemana', valor: 3 });
  const [loading, setLoading] = useState(false);
  const [fotoCapa, setFotoCapa] = useState<string | null>(null);

  useEffect(() => {
    if (isEditing && params.id) {
      const fetchProjeto = async () => {
        setLoading(true);
        const projetoExistente = await getProjetoById(params.id!);
        if (projetoExistente) {
          setTitulo(projetoExistente.titulo);
          setDescricao(projetoExistente.descricao);
          setMeta(projetoExistente.meta);
          setFotoCapa(projetoExistente.fotoCapa ?? null);
        } else {
          Alert.alert("Erro", "Projeto não encontrado.");
          router.back();
        }
        setLoading(false);
      };
      fetchProjeto();
    }
  }, [isEditing, params.id]);

  // Navegação entre as etapas
  const handleNext = () => {
    if (step < TOTAL_STEPS) {
      setStep(s => s + 1);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(s => s - 1);
    } else {
      router.back();
    }
  };

  const handleEscolherFoto = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.granted === false) {
      Alert.alert("Permissão necessária", "É necessário permitir o acesso à galeria para escolher uma foto.");
      return;
    }

    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.5,
    });

    if (!pickerResult.canceled) {
      setFotoCapa(pickerResult.assets[0].uri);
    }
  };

  const handleSubmit = async () => {
    if (!user) {
      Alert.alert("Erro", "Você precisa estar logado.");
      return;
    }
    if (!titulo.trim()) {
      Alert.alert("Campo Obrigatório", "Por favor, dê um título ao seu projeto. Volte para a primeira etapa.");
      return;
    }

    setLoading(true);
    try {
      const fotoCapaUrl = await uploadCapaProjeto(fotoCapa, user.uid);
      if (isEditing && params.id) {
        const dadosAtualizados: Partial<Projeto> = { titulo, descricao, meta, fotoCapa: fotoCapaUrl };
        await updateProjeto(params.id, dadosAtualizados);
        Alert.alert("Sucesso!", "Seu projeto foi atualizado.");
        router.back();
      } else {
        const novoProjetoId = await createProjeto({
          criadorId: user.uid,
          titulo,
          descricao,
          dataCriacao: new Date(),
          participantes: [user.uid],
          meta,
          semanasSeguidas: 0,
          fotoCapa: fotoCapaUrl,
          galeriaFotos: [],
          logsTreinos: [],
        });
        Alert.alert("Sucesso!", "Seu projeto foi criado.");
        router.replace({ pathname: '/(projetos)/[id]', params: { id: novoProjetoId } });
      }
    } catch (error) {
      console.error("Erro ao salvar projeto:", error);
      Alert.alert("Erro", "Não foi possível salvar o projeto. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const getStepTitle = () => {
    switch (step) {
        case 1: return isEditing ? "Edite as informações básicas" : "Informações básicas do projeto";
        case 2: return "Qual será a meta semanal?";
        case 3: return "Escolha uma foto de capa";
        default: return "";
    }
  };
  
  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Título do Projeto</Text>
              <TextInput style={styles.input} placeholder="Ex: Foco Total 30 Dias" placeholderTextColor="#888" value={titulo} onChangeText={setTitulo} />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Descrição</Text>
              <TextInput style={[styles.input, { height: 100, textAlignVertical: 'top' }]} placeholder="Qual o objetivo deste projeto?" placeholderTextColor="#888" value={descricao} onChangeText={setDescricao} multiline />
            </View>
          </>
        );
      case 2:
        return (
          <View style={styles.inputGroup}>
            <Text style={styles.subLabel}>Ir à academia X dias por semana</Text>
            <View style={styles.metaOptionsContainer}>
              {[2, 3, 4, 5, 6, 7].map(dias => (
                <TouchableOpacity key={dias} style={[styles.metaOptionButton, meta.valor === dias && styles.metaOptionSelected]} onPress={() => setMeta({ tipo: 'diasPorSemana', valor: dias })}>
                  <Text style={styles.metaOptionText}>{dias}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );
      case 3:
        return (
          <View style={styles.inputGroup}>
            <TouchableOpacity style={styles.imagePicker} onPress={handleEscolherFoto}>
              {fotoCapa ? (
                <Image source={{ uri: fotoCapa }} style={styles.coverImagePreview} />
              ) : (
                <>
                  <FontAwesome name="camera" size={24} color="#888" />
                  <Text style={styles.placeholderText}>Escolher imagem</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        );
      default:
        return null;
    }
  };

  if (loading && !isEditing) {
      return <View style={styles.container}><ActivityIndicator size="large" color="#fff" /></View>;
  }

  const progress = (step / TOTAL_STEPS) * 100;

  return (
    <View style={styles.container}>
        <ProgressBar progress={progress} />
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <FontAwesome name="chevron-left" size={24} color="#fff" />
        </TouchableOpacity>
      
        <ScrollView style={styles.contentContainer} contentContainerStyle={{flexGrow: 1, justifyContent: 'center'}}>
            <Text style={styles.stepTitle}>{getStepTitle()}</Text>
            {renderStepContent()}
        </ScrollView>
        
        <View style={styles.footer}>
            <TouchableOpacity style={[styles.actionButton, loading && styles.actionButtonDisabled]} onPress={handleNext} disabled={loading}>
                {loading ? (
                    <ActivityIndicator color="#fff" />
                ) : (
                    <Text style={styles.actionButtonText}>
                        {step === TOTAL_STEPS ? (isEditing ? 'Atualizar Projeto' : 'Criar Projeto') : 'Próximo'}
                    </Text>
                )}
            </TouchableOpacity>
        </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#030405',
    padding: 20,
  },
  contentContainer: {
    flex: 1,
    marginTop: 60,
  },
  progressBarContainer: { 
    height: 8, 
    width: '100%', 
    backgroundColor: '#141414', 
    borderRadius: 4, 
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
  },
  progressBar: { 
    height: '100%', 
    backgroundColor: '#1cb0f6', 
    borderRadius: 4 
  },
  backButton: {
    position: 'absolute',
    top: 85,
    left: 20,
    zIndex: 1,
  },
  stepTitle: { 
    fontSize: 24, 
    fontWeight: "bold", 
    marginBottom: 25, 
    textAlign: "center", 
    color: "#fff" 
  },
  footer: {
    paddingVertical: 10,
  },
  inputGroup: {
    marginBottom: 20,
  },
  input: {
    backgroundColor: '#141414',
    color: '#fff',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 8,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#222',
  },
  label: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subLabel: {
    color: '#aaa',
    fontSize: 14,
    marginBottom: 15,
    textAlign: 'center',
  },
  metaOptionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  metaOptionButton: {
    backgroundColor: '#141414',
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#333',
  },
  metaOptionSelected: {
    backgroundColor: '#1cb0f6',
    borderColor: '#fff',
  },
  metaOptionText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  placeholderText: {
    color: '#888',
    textAlign: 'center',
    marginTop: 8,
  },
  imagePicker: {
    backgroundColor: '#141414',
    borderRadius: 8,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#222',
    borderStyle: 'dashed',
    overflow: 'hidden',
  },
  coverImagePreview: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  actionButton: {
    backgroundColor: '#1cb0f6',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonDisabled: {
    backgroundColor: '#555',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

