import { createExercicioModelo } from '@/services/exercicioService';
import { uploadMediaAndGetURL } from '@/services/storageService';
import { FontAwesome } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { VideoListItem } from '../../../components/VideoListItem';
import { useAuth } from '../../authprovider';

interface CreateExerciseModalProps {
  visible: boolean;
  onClose: () => void;
  onExerciseCreated: (newExercise: any) => void;
  muscleGroups: string[];
}

export const CreateExerciseModal = ({
  visible,
  onClose,
  onExerciseCreated,
  muscleGroups,
}: CreateExerciseModalProps) => {
  const { user } = useAuth();
  const [nome, setNome] = useState('');
  const [grupoMuscular, setGrupoMuscular] = useState('');
  const [selectedMediaUri, setSelectedMediaUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);

  const pickMedia = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled) {
      setSelectedMediaUri(result.assets[0].uri);
    }
  };

  const handleCreate = async () => {
    if (!nome || !grupoMuscular) {
      Alert.alert('Erro', 'Por favor, preencha todos os campos.');
      return;
    }
    if (!user) {
      Alert.alert('Erro', 'Usuário não autenticado.');
      return;
    }

    setLoading(true);
    let downloadURL = '';

    if (selectedMediaUri) {
      setIsUploadingMedia(true);
      try {
        const fileName = selectedMediaUri.split('/').pop();
        const filePath = `exerciseMedia/${user.id}/${Date.now()}_${fileName}`;
        downloadURL = await uploadMediaAndGetURL(selectedMediaUri, filePath);
      } catch (error) {
        console.error('Erro ao fazer upload da mídia:', error);
        Alert.alert('Erro', 'Não foi possível fazer upload da mídia.');
        setLoading(false);
        setIsUploadingMedia(false);
        return;
      } finally {
        setIsUploadingMedia(false);
      }
    }

    try {
      const newExercise = await createExercicioModelo({
        nome,
        grupoMuscular,
        tipo: 'força',
        imagemUrl: downloadURL,
      });
      onExerciseCreated(newExercise);
      setNome('');
      setGrupoMuscular('');
      setSelectedMediaUri(null);
      onClose();
    } catch (error) {
      console.error('Erro ao criar exercício:', error);
      Alert.alert('Erro', 'Não foi possível criar o exercício.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <FontAwesome name="chevron-down" size={18} color="#fff" style={{ marginRight: 10 }} />
            <Text style={styles.modalTitle}>Criar Novo Exercício</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.form}>
          {selectedMediaUri ? (
            <VideoListItem style={styles.videoPreview} uri={selectedMediaUri} />
          ) : null}
          <TouchableOpacity
            style={styles.mediaPickerButton}
            onPress={pickMedia}
            disabled={isUploadingMedia || loading}
          >
            <FontAwesome name="image" size={20} color="#fff" />
            <Text style={styles.mediaPickerButtonText}>
              {selectedMediaUri ? 'Mudar Mídia' : 'Selecionar Imagem/Vídeo'}
            </Text>
          </TouchableOpacity>
          {isUploadingMedia && <ActivityIndicator size="small" color="#3B82F6" style={{ marginTop: 10 }} />}

          <TextInput
            style={styles.input}
            placeholder="Nome do Exercício"
            value={nome}
            onChangeText={setNome}
            placeholderTextColor="#888"
          />
          <Text style={styles.label}>Grupo Muscular</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.groupSelector}>
            {muscleGroups.map((group) => (
              <TouchableOpacity
                key={group}
                style={[
                  styles.groupButton,
                  grupoMuscular === group && styles.groupSelected,
                ]}
                onPress={() => setGrupoMuscular(group)}
              >
                <Text style={styles.groupText}>{group}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity
            style={[styles.createButton, (loading || isUploadingMedia) && styles.createButtonDisabled]}
            onPress={handleCreate}
            disabled={loading || isUploadingMedia}
          >
            <Text style={styles.createButtonText}>{loading ? 'Criando...' : 'Criar Exercício'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: '#0B0D10',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 0.5,
    borderBottomColor: '#222',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  form: {
    padding: 15,
  },
  input: {
    backgroundColor: '#1A1D23',
    color: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#222',
  },
  label: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 10,
  },
  groupSelector: {
    marginBottom: 15,
  },
  groupButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#1A1D23',
    borderRadius: 8,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#222',
  },
  groupSelected: {
    backgroundColor: '#3B82F6',
  },
  groupText: {
    color: '#fff',
    fontSize: 14,
  },
  createButton: {
    backgroundColor: '#3B82F6',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  createButtonDisabled: {
    backgroundColor: '#3B82F6',
    opacity: 0.5,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  videoPreview: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 15,
    backgroundColor: '#1A1D23',
  },
  mediaPickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A1D23',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#222',
    gap: 10,
  },
  mediaPickerButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
