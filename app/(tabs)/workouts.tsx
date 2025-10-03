import { FontAwesome } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import AnimatedGradientBorderButton from '../../components/AnimatedGradientBorderButton';
import { FichaModelo } from '../../models/fichaModelo';
import { TreinoModelo } from '../../models/treinoModelo';
import { copyFichaModeloToUser, getFichasModelos } from '../../services/fichaService';
import { getTreinosModelosByIds } from '../../services/treinoService';
import { useAuth } from '../authprovider';

export default function WorkoutsScreen() {
  const { user, initialized } = useAuth();
  const router = useRouter(); // router não é usado, mas pode ser útil no futuro.
  const [fichasModelos, setFichasModelos] = useState<FichaModelo[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalVisible, setModalVisible] = useState(false);
  const [selectedFicha, setSelectedFicha] = useState<FichaModelo | null>(null);
  const [treinos, setTreinos] = useState<TreinoModelo[]>([]);
  const [loadingTreinos, setLoadingTreinos] = useState(false);
  const [isCopying, setIsCopying] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const fetchFichas = async () => {
        // Se a autenticação ainda não foi inicializada, simplesmente aguardamos.
        // O estado 'loading' já é 'true' por padrão, então a UI mostrará o spinner.
        if (!initialized) {
          return;
        }
        setLoading(true); // Garante que o loading seja exibido ao re-focar na tela


        try {
          const modelos = await getFichasModelos();
          setFichasModelos(modelos);
        } catch (error) {
          Alert.alert("Erro", "Não foi possível carregar os dados.");
        } finally {
          setLoading(false);
        }
      };
      fetchFichas();
    }, [user, initialized])
  );

const handleSelectFicha = async (ficha: FichaModelo) => {
  console.log("[handleSelectFicha] Ficha selecionada:", ficha.id, ficha.nome, "treinos:", ficha.treinos);

  setSelectedFicha(ficha);
  setModalVisible(true);
  setLoadingTreinos(true);
  try {
    const treinosData = await getTreinosModelosByIds(ficha.treinos ?? []);
    setTreinos(treinosData);
  } catch (error) {
    console.error("Erro ao buscar treinos da ficha:", error);
    Alert.alert("Erro", "Não foi possível carregar os detalhes desta ficha.");
  } finally {
    setLoadingTreinos(false);
  }
};

  const handleCopyFicha = async () => {
    if (!user || !selectedFicha) return;
    setIsCopying(true);
    try {
      const newFichaId = await copyFichaModeloToUser(selectedFicha, user.uid);
      setIsCopying(false);
      setModalVisible(false);
      Alert.alert(
        "Sucesso!",
        "A ficha foi copiada para seus treinos. Você pode editá-la agora ou mais tarde.",
        [
          { text: "OK", style: "cancel" }, { text: "Editar Agora", onPress: () => router.push({ pathname: '/(treino)/criatFicha', params: { fichaId: newFichaId } }) }
        ]
      );
    } catch (error) {
      setIsCopying(false);
      console.error("Erro ao copiar ficha:", error);
      Alert.alert("Erro", "Ocorreu um erro ao tentar copiar a ficha.");
    }
  };

  const closeModal = () => {
    setModalVisible(false);
    setSelectedFicha(null);
    setTreinos([]);
  };

  const renderFichaItem = ({ item }: { item: FichaModelo }) => (
    <TouchableOpacity style={styles.card} onPress={() => handleSelectFicha(item)}>
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle}>{item.nome}</Text>
        <View style={styles.cardDetails}>
          <Text style={styles.cardDetailText}>{item.dificuldade}</Text>
          <Text style={styles.cardDetailText}>{item.sexo}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderTreinoDetailItem = ({ item }: { item: TreinoModelo }) => (
    <View style={styles.treinoContainer}>
      <Text style={styles.treinoTitle}>{item.nome}</Text>
      <Text style={styles.treinoDays}>{item.diasSemana.join(', ').toUpperCase()}</Text>
      {item.exercicios.map((ex, index) => (
        <Text key={`${ex.modeloId}-${index}`} style={styles.exercicioText}>- {ex.modelo.nome}</Text>
      ))}
    </View>
  );

  if (loading) {
    return <ActivityIndicator style={styles.centered} size="large" color="#fff" />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.listContainer}>
          <Text style={styles.headerTitle}>Modelos de Treino</Text>
          <FlatList
            data={fichasModelos}
            renderItem={renderFichaItem}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            ListEmptyComponent={<Text style={styles.emptyText}>Nenhum modelo de treino encontrado.</Text>}
          />
        </ScrollView>

        <Modal
          visible={isModalVisible}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={closeModal}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selectedFicha?.nome}</Text>
              <TouchableOpacity onPress={closeModal}>
                <FontAwesome name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            
            {loadingTreinos ? (
              <ActivityIndicator style={styles.centered} size="large" color="#fff" />
            ) : (
              <FlatList
                data={treinos}
                renderItem={renderTreinoDetailItem}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.modalList}
                ListEmptyComponent={<Text style={styles.emptyText}>Nenhum treino nesta ficha.</Text>}
              />
            )}

            <View style={styles.modalFooter}>
              <AnimatedGradientBorderButton onPress={handleCopyFicha} disabled={isCopying}>
                {isCopying ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.copyButtonText}>Usar este plano de treino</Text>
                )}
              </AnimatedGradientBorderButton>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#030405',
  },
  listContainer: {
    padding: 15,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
  },
  card: {
    backgroundColor: '#141414',
    borderRadius: 12,
    marginBottom: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#ffffff1a',
  },
  cardContent: {
    padding: 15,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  cardDetails: {
    flexDirection: 'row',
    marginTop: 5,
  },
  cardDetailText: {
    fontSize: 14,
    color: '#ccc',
    marginRight: 10,
    textTransform: 'capitalize',
  },
  emptyText: {
    color: '#aaa',
    textAlign: 'center',
    marginTop: 20,
    fontSize: 16,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#030405',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#030405',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#ffffff1a',
    paddingBottom: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  modalList: {
    paddingBottom: 20,
  },
  treinoContainer: {
    backgroundColor: '#141414',
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#ffffff1a',
  },
  treinoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  treinoDays: {
    fontSize: 12,
    color: '#1cb0f6',
    marginTop: 5,
  },
  exercicioText: {
    fontSize: 14,
    color: '#ccc',
    marginLeft: 10,
    marginTop: 3,
  },
  modalFooter: {
    marginTop: 20,
    marginBottom: 10,
    borderTopWidth: 1,
    borderTopColor: '#ffffff1a',
    padding: 10,
  },
  copyButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
