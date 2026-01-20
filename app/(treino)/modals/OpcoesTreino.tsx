import { FontAwesome, FontAwesome5, Ionicons } from '@expo/vector-icons';
import { Href, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFeedback } from '../../../components/providers/FeedbackProvider';
import { usePremiumStatus } from '../../../hooks/usePremiumStatus';
import { Ficha } from '../../../models/ficha';
import { addFicha, getFichasByUsuarioId } from '../../../services/fichaService';
import { useAuth } from '../../authprovider';

export default function OpcoesTreinoScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { isPremium, navigateToPaywall, isLoading: isPremiumLoading } = usePremiumStatus();
  const { showFeedback } = useFeedback();
  const [isFolderModalVisible, setFolderModalVisible] = useState(false);
  const [isNewFolderInputVisible, setNewFolderInputVisible] = useState(false);
  const [userFichas, setUserFichas] = useState<Ficha[]>([]);
  const [loadingFichas, setLoadingFichas] = useState(false);
  const [nextRoute, setNextRoute] = useState<Href | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);

  useEffect(() => {
    if (!user) return;
    setLoadingFichas(true);
    getFichasByUsuarioId(user.id)
      .then(setUserFichas)
      .catch(err => console.error("Erro ao buscar fichas:", err))
      .finally(() => setLoadingFichas(false));
  }, [user]);

  const handleNavigation = (route: Href) => {
    // Intercepta a navegação para perguntar em qual ficha o usuário quer adicionar
    setNextRoute(route);
    setFolderModalVisible(true);
  };

  const handleSelectFicha = (fichaId: string) => {
    if (nextRoute) {
      const routeObject = typeof nextRoute === 'string'
        ? { pathname: nextRoute, params: { fichaId } }
        : { pathname: nextRoute.pathname as string, params: { ...nextRoute.params, fichaId } };

      router.push(routeObject as Href);
      setFolderModalVisible(false);
      setNextRoute(null);
    }
  };

  const handleCreateNewFolder = async () => {
    if (!newFolderName.trim() || !user) {
      Alert.alert("Erro", "O nome da pasta não pode ser vazio.");
      return;
    }
    setIsCreatingFolder(true);
    try {
      const expirationDate = new Date();
      expirationDate.setMonth(expirationDate.getMonth() + 3);
      const newFicha: Omit<Ficha, "id"> = {
        usuarioId: user.id,
        nome: newFolderName.trim(),
        treinos: [],
        dataExpiracao: expirationDate,
        opcoes: 'Programa de treinamento',
        ativa: false,
      };
      await addFicha(newFicha);
      showFeedback('success', 'Sucesso', 'Pasta criada com sucesso!');
      setNewFolderName('');
      setNewFolderInputVisible(false);

      // Refresh fichas list
      setLoadingFichas(true);
      getFichasByUsuarioId(user.id)
        .then(setUserFichas)
        .finally(() => setLoadingFichas(false));

    } catch (error) {
      console.error("Erro ao criar nova pasta:", error);
      showFeedback('failure', 'Erro', 'Não foi possível criar a pasta.', 4000);
    } finally {
      setIsCreatingFolder(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Criar</Text>
        </View>

        <View style={styles.cardGrid}>
          <TouchableOpacity
            style={styles.card}
            onPress={() => handleNavigation({ pathname: '/(treino)/editarTreino', params: { fromConfig: 'true' } })}
          >
            <FontAwesome5 name="calendar-plus" size={24} color="#fff" style={styles.cardIcon} />
            <Text style={styles.cardTitle}>Criar treino para depois</Text>
            <Text style={styles.cardDescription}>Monte um treino e adicione a uma ficha para usar no futuro.</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.card}
            onPress={() => handleNavigation('/(treino)/LoggingDuringWorkout')}
          >
            <FontAwesome5 name="running" size={24} color="#fff" style={styles.cardIcon} />
            <Text style={styles.cardTitle}>Registrar treino livre</Text>
            <Text style={styles.cardDescription}>Adicione exercícios e séries conforme for treinando.</Text>
          </TouchableOpacity>
        </View>

        {isNewFolderInputVisible ? (
          <View style={styles.newFolderContainer}>
            <TextInput
              style={styles.input}
              placeholder="Nome da nova pasta"
              placeholderTextColor="#888"
              value={newFolderName}
              onChangeText={setNewFolderName}
              autoFocus={true}
            />
            <TouchableOpacity style={styles.primaryButton} onPress={handleCreateNewFolder} disabled={isCreatingFolder}>
              {isCreatingFolder ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Criar</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelLinkButton} onPress={() => setNewFolderInputVisible(false)}>
              <Text style={styles.cancelLinkText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.largeCard, isPremiumLoading && { opacity: 0.5 }]}
            disabled={isPremiumLoading}
            onPress={() => {
              console.log('DEBUG CHECK:', { isPremium, isPremiumLoading, userFichasCount: userFichas.length });

              // Prevent checking if still loading (though button is disabled, just safety)
              if (isPremiumLoading) return;

              // PREMIUM CHECK BEFORE OPENING INPUT
              if (!isPremium && userFichas.length >= 1) {
                showFeedback('failure', 'Limite Atingido', 'Usuários gratuitos podem criar apenas 1 pasta. Assine o Premium!', 4000);
                setTimeout(() => navigateToPaywall(), 1500);
                return;
              }
              setNewFolderInputVisible(true);
            }}
          >
            <FontAwesome name="folder" size={24} color="#fff" style={styles.cardIcon} />
            <View>
              <Text style={styles.cardTitle}>Criar uma nova pasta de treinos</Text>
              <Text style={styles.cardDescription}>Organize seus treinos em fichas personalizadas.</Text>
            </View>
          </TouchableOpacity>
        )}

        <View style={styles.dividerContainer}>
          <View style={styles.divider} />
          <Text style={styles.dividerText}>ou</Text>
          <View style={styles.divider} />
        </View>

        <TouchableOpacity
          style={styles.largeCard}
          onPress={() => router.push('../workouts')}
        >
          <FontAwesome name="star" size={24} color="#fff" style={styles.cardIcon} />
          <View>
            <Text style={styles.cardTitle}>Ingressar em um treino de especialista</Text>
            <Text style={styles.cardDescription}>Explore planos de treinos criados por profissionais.</Text>
          </View>
        </TouchableOpacity>
      </ScrollView>

      {/* Modal para selecionar a pasta (Drawer Style) */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isFolderModalVisible}
        onRequestClose={() => setFolderModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setFolderModalVisible(false)}>
          <View style={styles.modalOverlay} />
        </TouchableWithoutFeedback>

        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Onde deseja salvar?</Text>
          </View>

          {loadingFichas ? <ActivityIndicator color="#fff" style={{ marginTop: 20 }} /> : (
            <FlatList
              data={[
                { id: 'unassigned', nome: 'Meus Treinos (Avulsos)' },
                ...userFichas
              ]}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingBottom: 40 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.fichaOption}
                  onPress={() => {
                    handleSelectFicha(item.id === 'unassigned' ? 'unassigned' : item.id);
                  }}
                >
                  <View style={styles.iconContainer}>
                    <FontAwesome name={item.id === 'unassigned' ? "list-ul" : "folder"} size={20} color="#fff" />
                  </View>
                  <Text style={styles.fichaOptionText}>{item.nome}</Text>
                  <Ionicons name="chevron-forward" size={20} color="#666" />
                </TouchableOpacity>
              )}
              style={{ width: '100%' }}
            />
          )}

          <TouchableOpacity style={styles.cancelButton} onPress={() => setFolderModalVisible(false)}>
            <Text style={styles.cancelButtonText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0B0D10',
  },
  container: {
    flex: 1,
    paddingHorizontal: 15,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingVertical: 10,
    marginBottom: 20,
    gap: 15,
  },
  backButton: { padding: 5 },
  headerTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
  },
  cardGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 15,
    marginBottom: 15,
  },
  card: {
    flex: 1,
    backgroundColor: '#1A1D23',
    borderRadius: 12,
    padding: 15,
    borderWidth: 1,
    borderColor: '#2A2E37',
    minHeight: 180,
  },
  largeCard: {
    backgroundColor: '#1A1D23',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2A2E37',
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  cardIcon: {
    marginBottom: 15,
    marginRight: 15,
    opacity: 0.8,
  },
  cardTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  cardDescription: {
    color: '#aaa',
    fontSize: 13,
    lineHeight: 18,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 30,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: '#222',
  },
  dividerText: {
    color: '#888',
    marginHorizontal: 15,
    fontWeight: 'bold',
  },
  newFolderContainer: {
    backgroundColor: '#1A1D23',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2A2E37',
  },
  input: {
    width: '100%',
    backgroundColor: '#262A32',
    color: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    fontSize: 16,
  },
  primaryButton: {
    backgroundColor: '#3B82F6',
    padding: 15,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cancelLinkButton: {
    marginTop: 15,
    alignSelf: 'center',
  },
  cancelLinkText: {
    color: '#888',
    fontSize: 14,
  },

  // Drawer/Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modalContent: {
    backgroundColor: '#1A1D23',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
    height: '50%', // Half screen
    position: 'absolute',
    bottom: 0,
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#444',
    borderRadius: 2,
    marginBottom: 15,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  fichaOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#262A32',
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#333',
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  fichaOptionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  cancelButton: {
    marginTop: 15,
    padding: 15,
    alignItems: 'center',
    width: '100%',
  },
  cancelButtonText: {
    color: '#FF453A',
    fontSize: 16,
    fontWeight: '600',
  },
});