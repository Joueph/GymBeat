import { Ionicons } from '@expo/vector-icons';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from '../firebaseconfig';
import { useAuth } from './authprovider';

interface SuggestFeatureModalProps {
  visible: boolean;
  onClose: () => void;
}

export const SuggestFeatureModal = ({ visible, onClose }: SuggestFeatureModalProps) => {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) {
      Alert.alert('Campos incompletos', 'Por favor, preencha o título e a descrição da sua sugestão.');
      return;
    }
    if (!user) {
      Alert.alert('Erro', 'Você precisa estar logado para enviar uma sugestão.');
      return;
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'feature_suggestions'), {
        title: title.trim(),
        description: description.trim(),
        votes: 1,
        votedBy: [user.id],
        createdBy: user.id,
        createdAt: serverTimestamp(),
      });

      Alert.alert('Obrigado!', 'Sua sugestão foi enviada com sucesso.');
      setTitle('');
      setDescription('');
      onClose();
    } catch (error) {
      console.error('Erro ao enviar sugestão:', error);
      Alert.alert('Erro', 'Não foi possível enviar sua sugestão. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      animationType="slide"
      visible={visible}
      onRequestClose={onClose}
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={styles.modalSafeArea} edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Sugerir Funcionalidade</Text>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>
              Tem uma ideia para melhorar o GymBeat? Conte para a gente!
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Título da funcionalidade (ex: Sincronizar com Spotify)"
              placeholderTextColor="#888"
              value={title}
              onChangeText={setTitle}
            />
            <TextInput
              style={[styles.input, styles.inputDescription]}
              placeholder="Descreva sua ideia em mais detalhes..."
              placeholderTextColor="#888"
              value={description}
              onChangeText={setDescription}
              multiline
            />

            <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Enviar Sugestão</Text>
              )}
            </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalSafeArea: { flex: 1, backgroundColor: '#0B0D10' },
  modalContainer: { flex: 1, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  modalTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  modalSubtitle: { color: '#aaa', fontSize: 15, marginBottom: 25, lineHeight: 22 },
  input: {
    backgroundColor: '#1A1D23',
    color: '#fff',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#2A2E37',
  },
  inputDescription: { height: 120, textAlignVertical: 'top' },
  submitButton: { backgroundColor: '#3B82F6', padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});