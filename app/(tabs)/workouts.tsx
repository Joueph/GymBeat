// app/(tabs)/workouts.tsx

import { FontAwesome } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import AnimatedGradientBorderButton from '../../components/AnimatedGradientBorderButton';
import { FichaModelo } from '../../models/fichaModelo';
import { TreinoModelo } from '../../models/treinoModelo';
import { Usuario } from '../../models/usuario';
import { copyFichaModeloToUser, getFichasModelos, setFichaAtiva } from '../../services/fichaService';
import { getTreinosModelosByIds } from '../../services/treinoService';
import { getUserProfile } from '../../userService';
import { useAuth } from '../authprovider';

export default function WorkoutsScreen() {
  const { user, initialized } = useAuth();
  const router = useRouter(); // router não é usado, mas pode ser útil no futuro.
  const [fichasModelos, setFichasModelos] = useState<FichaModelo[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Usuario | null>(null);
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
        setLoading(true);


        try {
          const [fichas, userProfile] = await Promise.all([
            getFichasModelos(),
            user ? getUserProfile(user.uid) : Promise.resolve(null)
          ]);
          setProfile(userProfile);

          // Mapeia todas as fichas para buscar seus treinos e calcular o total de dias
          const modelosComTotalDias = await Promise.all(fichas.map(async (ficha) => {
            if (ficha.treinos && ficha.treinos.length > 0) {
              const treinosDaFicha = await getTreinosModelosByIds(ficha.treinos);
              const totalDias = treinosDaFicha.reduce((sum, treino) => sum + (treino.diasSemana?.length || 0), 0);
              return { ...ficha, totalDias };
            }
            // Se não houver treinos, o total de dias é 0
            return { ...ficha, totalDias: 0 };
          }));


          // Lógica de Ordenação
          const sortFichas = (a: FichaModelo, b: FichaModelo) => {
            if (!userProfile) return 0;

            const getScore = (ficha: FichaModelo) => {
              let score = 0;
              // Prioridade por nível
              if (ficha.dificuldade === userProfile.nivel) score += 10;
              else if (ficha.dificuldade === 'Todos') score += 5;

              // Prioridade por gênero
              if (ficha.sexo === (userProfile.genero === 'Masculino' ? 'Homem' : userProfile.genero === 'Feminino' ? 'Mulher' : undefined)) score += 10;
              else if (ficha.sexo === 'Ambos') score += 5;

              return score;
            };

            const scoreA = getScore(a);
            const scoreB = getScore(b);

            if (scoreB !== scoreA) {
              return scoreB - scoreA;
            }

            // Critério de desempate: mais treinos primeiro
            return (b.totalDias || 0) - (a.totalDias || 0);
          };

          setFichasModelos(modelosComTotalDias.sort(sortFichas));
        } catch (error) {
          Alert.alert("Erro", "Não foi possível carregar os dados.");
        } finally {
          setLoading(false);
        }
      };
      fetchFichas();
    }, [user, initialized])
  );

  const getStreakImage = (numTreinos: number) => {
    const dias = Math.max(2, Math.min(7, numTreinos)); // Garante que o número esteja entre 2 e 7
    switch (dias) {
      case 2: return require('../../assets/images/Streak-types/Vector_2_dias.png');
      case 3: return require('../../assets/images/Streak-types/Vector_3_dias.png');
      case 4: return require('../../assets/images/Streak-types/Vector_4_dias.png');
      case 5: return require('../../assets/images/Streak-types/Vector_5_dias.png');
      case 6: return require('../../assets/images/Streak-types/Vector_6_dias.png');
      case 7: return require('../../assets/images/Streak-types/Vector_7_dias.png');
      default:
        return require('../../assets/images/Streak-types/Vector_2_dias.png');
    }
  };

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
      await setFichaAtiva(user.uid, newFichaId); // Define a nova ficha como ativa
      setIsCopying(false);
      setModalVisible(false);
      router.push('/treinoHoje'); // Leva o usuário direto para a tela de treinos
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

  const renderFichaItem = ({ item, isCarousel }: { item: FichaModelo, isCarousel?: boolean }) => (
    <TouchableOpacity style={isCarousel ? styles.carouselCard : styles.card} onPress={() => handleSelectFicha(item)} activeOpacity={0.8}>
      {isCarousel ? (
        <>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>{item.nome}</Text>
            <View style={styles.cardDetails}>
              <Text style={styles.cardDetailText}>{item.dificuldade}</Text>
              <Text style={styles.cardDetailText}>{item.sexo}</Text>
            </View>
          </View>
          <Image source={getStreakImage(item.treinos?.length || 0)} style={styles.carouselCardImage} />
        </>
      ) : (
        <>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>{item.nome}</Text>
            <View style={styles.cardDetails}>
              <Text style={styles.cardDetailText}>{item.dificuldade}</Text>
              <Text style={styles.cardDetailText}>{item.sexo}</Text>
              <Text style={styles.cardDetailText}>{item.totalDias || 0} dias</Text>
            </View>
          </View>
          <View style={styles.cardRecommendationContainer}>
            <Image source={getStreakImage(item.totalDias || 0)} style={styles.cardImage} />
          </View>
        </>
      )}
    </TouchableOpacity>
  );

  const recommendedFichas = fichasModelos.slice(0, 5);
  const otherFichas = fichasModelos; // A lista completa já está ordenada

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
          <Text style={styles.headerTitle}>Recomendado para você</Text>
          <FlatList
            data={recommendedFichas}
            renderItem={({ item }) => renderFichaItem({ item, isCarousel: true })}
            keyExtractor={(item) => `rec-${item.id}`}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 20, paddingLeft: 5 }}
            ListEmptyComponent={<Text style={styles.emptyText}>Nenhum modelo recomendado encontrado.</Text>}
          />

          <Text style={styles.headerTitle}>Todos os Modelos</Text>
          <FlatList
            data={otherFichas}
            renderItem={({ item }) => renderFichaItem({ item, isCarousel: false })}
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
    flexDirection: 'row',
    backgroundColor: '#141414',
    borderRadius: 12,
    marginBottom: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#ffffff1a',
    alignItems: 'center',
  },
  carouselCard: {
    backgroundColor: '#141414',
    borderRadius: 12,
    marginRight: 15,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#ffffff1a',
    width: 160,
    height: 180,
    padding: 3,
    position: 'relative',
  },
  cardImage: {
    width: 40,
    height: 40,
    resizeMode: 'contain',
  },
  carouselCardImage: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    width: 50,
    height: 50,
    resizeMode: 'contain',
    opacity: 0.8,
  },
  cardRecommendationContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingRight: 15,
    gap: 5,
  },
  cardContent: {
    flex: 1,
    padding: 15,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  cardDetails: {
    flexDirection: 'column',
    marginTop: 5,
  },
  cardDetailText: {
    fontSize: 14,
    color: '#ccc',
    marginRight: 10,
    textTransform: 'capitalize',
  },
  recommendationText: {
    fontSize: 10,
    color: '#888',
    fontWeight: '500',
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
