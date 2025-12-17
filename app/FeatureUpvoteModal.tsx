import { Ionicons } from '@expo/vector-icons';
import { arrayUnion, collection, doc, increment, onSnapshot, orderBy, query, updateDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from '../firebaseconfig';
import { useAuth } from './authprovider';
import { SuggestFeatureModal } from './SuggestFeatureModal';

interface Feature {
  id: string;
  title: string;
  description: string;
  votes: number;
  votedBy?: string[];
}

// const initialFeatures: Feature[] = [
//   { id: '1', title: 'Modo escuro para o app todo', description: 'Uma opção para deixar a interface totalmente escura, para conforto dos olhos.', votes: 128 },
//   { id: '2', title: 'Conexão com Apple Health/Google Fit', description: 'Sincronizar dados de treino, peso corporal e outras métricas.', votes: 95 },
//   { id: '3', title: 'Desafios e Conquistas', description: 'Gamificação com medalhas e desafios para manter a motivação.', votes: 82 },
//   { id: '4', title: 'Editor de Exercícios Avançado', description: 'Permitir criar variações de exercícios existentes e adicionar mais detalhes.', votes: 55 },
// ];

interface FeatureUpvoteModalProps {
  visible: boolean;
  onClose: () => void;
}

export const FeatureUpvoteModal = ({ visible, onClose }: FeatureUpvoteModalProps) => {
  const { user } = useAuth();
  const [features, setFeatures] = useState<Feature[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSuggestModalVisible, setSuggestModalVisible] = useState(false);

  useEffect(() => {
    if (!visible) return;

    setLoading(true);
    const q = query(collection(db, 'feature_suggestions'), orderBy('votes', 'desc'));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const featuresData: Feature[] = [];
      querySnapshot.forEach((doc) => {
        featuresData.push({ id: doc.id, ...doc.data() } as Feature);
      });
      setFeatures(featuresData);
      setLoading(false);
    }, (error) => {
      console.error("Erro ao buscar funcionalidades:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [visible]);

  const handleUpvote = async (feature: Feature) => {
    if (!user) return;

    // Previne que o usuário vote duas vezes
    if (feature.votedBy?.includes(user.id)) {
      return;
    }

    const featureRef = doc(db, 'feature_suggestions', feature.id);
    await updateDoc(featureRef, {
      votes: increment(1),
      votedBy: arrayUnion(user.id)
    });
  };

  const renderItem = ({ item }: { item: Feature }) => {
    const userHasVoted = user ? item.votedBy?.includes(user.id) : false;
    return (
      <View style={styles.featureCard}>
        <View style={styles.featureInfo}>
          <Text style={styles.featureTitle}>{item.title}</Text>
          <Text style={styles.featureDescription}>{item.description}</Text>
        </View>
        <TouchableOpacity style={[styles.upvoteButton, userHasVoted && styles.upvotedButton]} onPress={() => handleUpvote(item)} disabled={userHasVoted}>
          <Ionicons name="caret-up" size={20} color={userHasVoted ? '#3B82F6' : '#fff'} />
          <Text style={[styles.upvoteCount, userHasVoted && styles.upvotedCount]}>{item.votes}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
      presentationStyle="pageSheet"
    >
      <View style={styles.modalContainer}>
        <SafeAreaView style={styles.modalSafeArea} edges={['top', 'bottom', 'left', 'right']}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Votar em Funcionalidades</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          <Text style={styles.modalSubtitle}>
            Ajude-nos a decidir o que construir a seguir! Suas funcionalidades mais pedidas aparecerão aqui.
          </Text>
          {loading ? (
            <ActivityIndicator size="large" color="#fff" style={{ flex: 1 }} />
          ) : (
            <>
              <FlatList
                data={features}
                renderItem={renderItem}
                keyExtractor={item => item.id}
                contentContainerStyle={{ paddingBottom: 80 }} // Aumenta o espaço para o botão não sobrepor o último item
              />
              <TouchableOpacity style={styles.suggestButton} onPress={() => setSuggestModalVisible(true)}>
                <Text style={styles.suggestButtonText}>Sugerir uma funcionalidade</Text>
              </TouchableOpacity>
            </>
          )}
          <SuggestFeatureModal
            visible={isSuggestModalVisible}
            onClose={() => setSuggestModalVisible(false)}
          />
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalSafeArea: { paddingTop: 20, flex: 1 },
  modalContainer: {
    flex: 1,
    backgroundColor: '#0B0D10',
    padding: 20,
    paddingTop: "15%",
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
  },
  modalSubtitle: {
    color: '#aaa',
    fontSize: 15,
    marginBottom: 25,
    lineHeight: 22,
  },
  featureCard: {
    backgroundColor: '#1A1D23',
    borderRadius: 12,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2A2E37',
  },
  featureInfo: {
    flex: 1,
  },
  featureTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  featureDescription: {
    color: '#aaa',
    fontSize: 13,
  },
  upvoteButton: {
    backgroundColor: '#2A2E37',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
    marginLeft: 15,
  },
  upvotedButton: {
    backgroundColor: '#1A1D23',
    borderColor: '#3B82F6',
    borderWidth: 1,
  },
  upvoteCount: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 2,
  },
  upvotedCount: {
    color: '#3B82F6',
  },
  suggestButton: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#3B82F6',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  suggestButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});