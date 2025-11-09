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
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ficha } from '../../../models/ficha';
import { addFicha, getFichasByUsuarioId } from '../../../services/fichaService';
import { useAuth } from '../../authprovider';

export default function OpcoesTreinoScreen() {
  const router = useRouter();
  const { user } = useAuth();
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
    // Navega diretamente para a tela de edição de treino, sem forçar a seleção de uma pasta.
    // O treino será criado como "avulso" (sem fichaId) por padrão.
    router.push(route);
  };

  const handleSelectFicha = (fichaId: string) => {
    if (nextRoute) {
      const routeObject = typeof nextRoute === 'string' 
        ? { pathname: nextRoute, params: { fichaId } }
        : { pathname: nextRoute.pathname, params: { ...nextRoute.params, fichaId } };

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
      setNewFolderName('');
      setNewFolderInputVisible(false);
      router.back(); // Volta para a tela de treinos, que irá recarregar
    } catch (error) {
      console.error("Erro ao criar nova pasta:", error);
      Alert.alert("Erro", "Não foi possível criar a pasta.");
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
            <Text style={styles.cardTitle}>Criar um treino para depois</Text>
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
          </View>
        ) : (
          <TouchableOpacity style={styles.largeCard} onPress={() => setNewFolderInputVisible(true)}>
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

      {/* Modal para selecionar a pasta */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isFolderModalVisible}
        onRequestClose={() => setFolderModalVisible(false)}
      >
        <View style={styles.modalCenteredView}>
          <View style={styles.modalView}>
            <Text style={styles.modalTitle}>Selecionar Pasta</Text>
            {loadingFichas ? <ActivityIndicator color="#fff" /> : (
              <FlatList
                data={[
                  // Adiciona manualmente a opção "Meus Treinos" no topo da lista
                  { id: 'unassigned', nome: 'Meus Treinos (Avulsos)' },
                  ...userFichas
                ]}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity 
                    style={styles.fichaOption} 
                    onPress={() => {
                      // 'unassigned' será tratado como null/undefined nas telas de destino
                      handleSelectFicha(item.id === 'unassigned' ? 'unassigned' : item.id);
                    }}
                  >
                    <Text style={styles.fichaOptionText}>{item.nome}</Text>
                  </TouchableOpacity>
                )}
                style={{ width: '100%' }}
              />
            )}
            <TouchableOpacity style={styles.cancelButton} onPress={() => setFolderModalVisible(false)}>
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
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
    justifyContent: 'flex-start', // Alinha à esquerda
    paddingVertical: 10,
    marginBottom: 20,
    gap: 15, // Espaço entre o botão e o título
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
  // Modal Styles
  modalCenteredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  modalView: {
    margin: 20,
    backgroundColor: '#1f1f1f',
    borderRadius: 20,
    padding: 25,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    width: '90%',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  fichaOption: {
    backgroundColor: '#2c2c2e',
    padding: 15,
    borderRadius: 10,
    width: '100%',
    marginBottom: 10,
  },
  fichaOptionText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
  },
  cancelButton: {
    marginTop: 15,
    padding: 10,
  },
  cancelButtonText: {
    color: '#1cb0f6',
    fontSize: 16,
  },
  input: {
    width: '100%',
    backgroundColor: '#262A32',
    color: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    fontSize: 16,
    // textAlign: 'center', // Removido para alinhar à esquerda
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
});