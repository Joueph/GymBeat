import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, ActivityIndicator, Alert, Animated, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { useAuth } from '../authprovider';
import { getFichasModelos, copyFichaModeloToUser } from '../../services/fichaService';
import { getTreinosModelosByIds } from '../../services/treinoService';
import { FichaModelo } from '../../models/fichaModelo';
import { TreinoModelo } from '../../models/treinoModelo';

export default function WorkoutsScreen() {
  const { user } = useAuth();
  const router = useRouter();
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
        if (!user) {
          setLoading(false);
          return;
        }
        setLoading(true);
        try {
          const modelos = await getFichasModelos();
          setFichasModelos(modelos);
        } catch (error) {
          console.error("Erro ao buscar fichas modelo:", error);
          Alert.alert("Erro", "Não foi possível carregar os dados.");
        } finally {
          setLoading(false);
        }
      };
      fetchFichas();
    }, [user])
  );

  const handleSelectFicha = async (ficha: FichaModelo) => {
    setSelectedFicha(ficha);
    setModalVisible(true);
    setLoadingTreinos(true);
    try {
      const treinosData = await getTreinosModelosByIds(ficha.treinos);
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
          { text: "OK", style: "cancel" },
          { text: "Editar Agora", onPress: () => router.push(`/treino/criarFicha?fichaId=${newFichaId}`) }
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
              <TouchableOpacity style={styles.copyButton} onPress={handleCopyFicha} disabled={isCopying}>
                {isCopying ? (
                  <ActivityIndicator color="#0d181c" />
                ) : (
                  <Text style={styles.copyButtonText}>Usar este plano de treino</Text>
                )}
              </TouchableOpacity>
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
    backgroundColor: '#0d181c',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0d181c',
  },
  listContainer: {
    padding: 15,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 15,
  },
  card: {
    backgroundColor: '#1a2a33',
    borderRadius: 12,
    marginBottom: 15,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#2a3b42',
  },
  cardContent: {
    padding: 20,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },
  cardDetails: {
    flexDirection: 'row',
    gap: 15,
  },
  cardDetailText: {
    fontSize: 14,
    color: '#ccc',
    backgroundColor: '#2a3b42',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: 'hidden', // for iOS to respect borderRadius
  },
  emptyText: {
    color: '#aaa',
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
  },
  emptyContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptySubText: {
    color: '#888',
    textAlign: 'center',
    marginTop: 5,
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#0d181c',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2a3b42',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    marginRight: 10,
  },
  modalList: {
    padding: 20,
  },
  treinoContainer: {
    backgroundColor: '#1a2a33',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
  },
  treinoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  treinoDays: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1cb0f6',
    marginTop: 4,
    marginBottom: 10,
  },
  exercicioText: {
    fontSize: 15,
    color: '#ccc',
    lineHeight: 22,
  },
  modalFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#2a3b42',
    backgroundColor: '#0d181c',
  },
  copyButton: {
    backgroundColor: '#1cb0f6',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  copyButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
