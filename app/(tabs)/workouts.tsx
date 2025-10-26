// app/(tabs)/workouts.tsx

import { FontAwesome } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { GestureHandlerRootView, ScrollView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import AnimatedGradientBorderButton from '../../components/AnimatedGradientBorderButton';
import { FichaModelo } from '../../models/fichaModelo';
import { TreinoModelo } from '../../models/treinoModelo';
import { Usuario } from '../../models/usuario';
import { copyFichaModeloToUser, getFichasModelos, setFichaAtiva } from '../../services/fichaService';
import { getTreinosModelosByIds } from '../../services/treinoService';
import { getUserProfile, updateUserProfile } from '../../userService';
import { useAuth } from '../authprovider';

const DIAS_SEMANA_ORDEM: { [key: string]: number } = {
  'dom': 0, 'seg': 1, 'ter': 2, 'qua': 3, 'qui': 4, 'sex': 5, 'sab': 6
};
const DIAS_SEMANA_ARRAY = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];

const DIAS_SEMANA_MAP: { [key: number]: string } = {
  0: 'dom', 1: 'seg', 2: 'ter', 3: 'qua', 4: 'qui', 5: 'sex', 6: 'sab'
};

export default function WorkoutsScreen() {
  const { user, initialized } = useAuth();
  const router = useRouter();
  const [fichasModelos, setFichasModelos] = useState<FichaModelo[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Usuario | null>(null);
  const [isModalVisible, setModalVisible] = useState(false);
  const [selectedFicha, setSelectedFicha] = useState<FichaModelo | null>(null);
  const [treinos, setTreinos] = useState<TreinoModelo[]>([]);
  const [loadingTreinos, setLoadingTreinos] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  // Novos estados para personalização do calendário
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [customDays, setCustomDays] = useState<string[]>([]);
  const [originalDays, setOriginalDays] = useState<Set<string>>(new Set());
  const [isCustomizationAllowed, setIsCustomizationAllowed] = useState(true);

  // Alterado de useFocusEffect para useEffect para carregar dados apenas uma vez.
  // A estrutura foi corrigida para remover o useCallback aninhado.
  useEffect(() => {
    const fetchFichas = async () => {
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
            // Corretamente soma os dias de cada treino
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

          // Critério de desempate: mais dias de treino primeiro
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
  }, [user, initialized]);

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
  setSelectedFicha(ficha);
  setModalVisible(true);
  setLoadingTreinos(true);
  try {
    const treinosData = await getTreinosModelosByIds(ficha.treinos ?? []);

    // Verifica se algum treino tem mais de um dia, desabilitando a customização se for o caso.
    const allowCustomization = treinosData.every(t => t.diasSemana.length <= 1);
    setIsCustomizationAllowed(allowCustomization);
    // Ordena os treinos pela ordem dos dias da semana (dom a sab)
    treinosData.sort((a, b) => (DIAS_SEMANA_ORDEM[a.diasSemana[0]] ?? 7) - (DIAS_SEMANA_ORDEM[b.diasSemana[0]] ?? 7));
    const initialDays = new Set(treinosData.flatMap(t => t.diasSemana));
    setOriginalDays(initialDays);
    setCustomDays(Array.from(initialDays).sort((a, b) => DIAS_SEMANA_ORDEM[a] - DIAS_SEMANA_ORDEM[b]));
    setIsCustomizing(false); // Reseta o modo de customização ao abrir
    setTreinos(treinosData);
  } catch (error) {
    console.error("Erro ao buscar treinos da ficha:", error);
    Alert.alert("Erro", "Não foi possível carregar os detalhes desta ficha.");
  } finally {
    setLoadingTreinos(false);
  }
};

  const handleCopyFicha = async () => {
    if (!user || !selectedFicha || !treinos) return;
    setIsCopying(true);
    try {
      // Se a customização estiver permitida e ativa, envia os treinos com os dias alterados
      const treinosParaCopiar = isCustomizing
        ? treinos.map((treino, index) => ({
            ...treino,
            diasSemana: customDays[index] ? [customDays[index]] : [],
          }))
        : treinos;

      const newFichaId = await copyFichaModeloToUser(selectedFicha, user.uid, treinosParaCopiar);
      await setFichaAtiva(user.uid, newFichaId);
      setIsCopying(false);
      setModalVisible(false);
      router.replace('/(tabs)/treinoHoje');
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
    setIsCustomizing(false);
    setCustomDays([]);
    setIsCustomizationAllowed(true);
  };

  const handleResetCustomization = () => {
    setIsCustomizing(false);
    // Reseta para os dias originais, ordenados
    setCustomDays(Array.from(originalDays).sort((a, b) => DIAS_SEMANA_ORDEM[a] - DIAS_SEMANA_ORDEM[b]));
  };

  const handleDayPress = (day: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCustomDays(prev => {
      let newDays = new Set(prev);
      if (!isCustomizing) { // Primeira interação, reseta tudo
        newDays.clear();
        newDays.add(day);
      } else { // Interações subsequentes
        if (newDays.has(day)) {
          newDays.delete(day);
        } else if (newDays.size < treinos.length) { // Impede adicionar mais dias que o número de treinos
          newDays.add(day);
        }
      }
      setIsCustomizing(true);
      return Array.from(newDays).sort((a, b) => DIAS_SEMANA_ORDEM[a] - DIAS_SEMANA_ORDEM[b]);
    });
  };

  const handleUpdateStreakGoal = async () => {
    if (!user || !selectedFicha || !selectedFicha.totalDias) return;
    try {
      await updateUserProfile(user.uid, { streakGoal: selectedFicha.totalDias });
      // Atualiza o perfil localmente para refletir a mudança imediatamente na UI
      setProfile(prev => prev ? { ...prev, streakGoal: selectedFicha.totalDias } : null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Sucesso", "Sua meta semanal foi atualizada!");
    } catch (error) {
      console.error("Erro ao atualizar a meta de treinos:", error);
      Alert.alert("Erro", "Não foi possível atualizar sua meta de treinos.");
    }
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
          {/* CORREÇÃO APLICADA AQUI: Usa item.totalDias em vez de item.treinos.length */}
          <Image source={getStreakImage(item.totalDias || 0)} style={styles.carouselCardImage} />
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
  const otherFichas = fichasModelos;

  const renderTreinoDetailItem = ({ item }: { item: TreinoModelo }) => (
    <View style={styles.treinoContainer}>
      <Text style={styles.treinoTitle}>{item.nome}</Text>
      {isCustomizing ? (
        <Text style={styles.treinoDays}>
          {customDays[treinos.indexOf(item)] ? customDays[treinos.indexOf(item)].toUpperCase() : 'NÃO ATRIBUÍDO'}
        </Text>
      ) : (
        <Text style={styles.treinoDays}>{item.diasSemana.join(', ').toUpperCase()}</Text>
      )}
      {item.exercicios.map((ex, index) => {
        // CORREÇÃO: Em TreinoModelo, 'series' e 'repeticoes' são propriedades diretas do exercício.
        // A lógica anterior era para o modelo 'Treino', não 'TreinoModelo'.
        // A lógica anterior era para o modelo 'Treino', não 'TreinoModelo'.
        const seriesCount = (ex as any).series || 0;
        const reps = (ex as any).repeticoes || 'N/A';
        return (
          <View key={`${ex.modeloId}-${index}`} style={styles.exercicioContainer}>
            <Text style={styles.exercicioText}>{ex.modelo.nome}</Text>
            <Text style={styles.exercicioDetailText}>{seriesCount}x {reps}</Text>
          </View>
        );
      })}
    </View>
  );

  const renderCalendar = () => {
    return (
      <View>
        <View style={styles.calendarContainer}> 
          {DIAS_SEMANA_ARRAY.map((day) => {
            const isScheduled = originalDays.has(day);
            const isSelected = customDays.includes(day);
            const isDisabled = isCustomizing && !isSelected && customDays.length >= treinos.length;
            
            return (
              <TouchableOpacity
                key={day}
                style={[
                  styles.dayContainer,
                  // Estilo para dias agendados inicialmente (com opacidade)
                  isScheduled && !isCustomizing && styles.dayScheduledInitial,
                  // Estilo para dias selecionados na customização
                  isCustomizing && isSelected && styles.daySelected,
                ]}
                onPress={() => handleDayPress(day)}
              >
                <Text style={styles.dayText}>{day.toUpperCase()}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={styles.calendarSubText}>
          Configuração recomendada aplicada, você pode sobrescrever clicando nos dias que você quer treinar.
        </Text>
      </View>
    );
  };

  const renderCustomizationCard = () => {
    if (!isCustomizing) return null;

    return (
      <View style={styles.customizationCard}>
        <Text style={styles.customizationTitle}>Agende seus treinos</Text>
        <View style={styles.progressBarContainer}>
          <View style={[styles.progressBarFill, { width: `${(customDays.length / treinos.length) * 100}%` }]} />
        </View>
        <Text style={styles.progressText}>{customDays.length} de {treinos.length} treinos agendados</Text>
        {treinos.map((treino, index) => {
          const isAssigned = index < customDays.length;
          return (
            <View key={treino.id} style={styles.customizationItem}>
              <FontAwesome name={isAssigned ? "check-circle" : "circle-o"} size={20} color={isAssigned ? "#1cb0f6" : "#555"} />
              <Text style={[styles.customizationText, isAssigned && styles.customizationTextAssigned]}>
                {treino.nome}
              </Text>
            </View>
          );
        })}
      </View>
    );
  };

  const renderGoalDifferenceCard = () => {
    if (!selectedFicha || !profile || !selectedFicha.totalDias || selectedFicha.totalDias === (profile.streakGoal || 0)) {
      return null;
    }

    const userGoal = profile.streakGoal || 0;
    const workoutGoal = selectedFicha.totalDias;

    if (workoutGoal < userGoal) {
      // Cenário: Meta do treino é MAIOR que a do usuário
      return (
        <View style={[styles.goalDiffCard, styles.goalDiffConstructive]}>
          <Text style={styles.goalDiffTitle}>Este treino possui uma meta <Text style={{ fontStyle: 'italic' }}>Menor que a sua</Text></Text>
          <View style={styles.goalDiffImages}>
            <Image source={getStreakImage(userGoal)} style={styles.goalDiffImage} />
            <FontAwesome name="long-arrow-right" size={24} color="#fff" />
            <Image source={getStreakImage(workoutGoal)} style={styles.goalDiffImage} />
          </View>
          <Text style={styles.goalDiffInfo}>Você pode aderir à este treino <Text style={{ fontWeight: 'bold' }}>SEM COMPROMETER SUA SEQUÊNCIA</Text>.</Text>
          <TouchableOpacity style={styles.goalDiffButtonConstructive} onPress={handleUpdateStreakGoal}>
            <Text style={styles.goalDiffButtonText}>Diminuir meta para {workoutGoal} dias</Text>
          </TouchableOpacity>
        </View>
      );
    } else {
      // Cenário: Meta do treino é MENOR que a do usuário
      return (
        <View style={[styles.goalDiffCard, styles.goalDiffDestructive]}>
          <Text style={styles.goalDiffTitle}>Este treino possui uma meta <Text style={{ fontStyle: 'italic' }}>Maior que a sua</Text></Text>
          <View style={styles.goalDiffImages}>
            <Image source={getStreakImage(userGoal)} style={styles.goalDiffImage} />
            <FontAwesome name="long-arrow-right" size={24} color="#fff" />
            <Image source={getStreakImage(workoutGoal)} style={styles.goalDiffImage} />
          </View>
          <Text style={styles.goalDiffInfo}>Para aderir à este treino, sua sequência pode ser comprometida. Recomendamos que você <Text style={{ fontWeight: 'bold' }}>AUMENTE SUA META SEMANAL</Text>.</Text>
          <TouchableOpacity style={styles.goalDiffButtonDestructive} onPress={handleUpdateStreakGoal}>
            <Text style={styles.goalDiffButtonText}>Aumentar meta para {workoutGoal} dias</Text>
          </TouchableOpacity>
        </View>
      );
    }
  };


  const isButtonDisabled = isCustomizationAllowed && isCustomizing && customDays.length !== treinos.length;

  if (loading) {
    return <ActivityIndicator style={styles.centered} size="large" color="#fff" />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.container}>
        <FlatList
          data={otherFichas}
          renderItem={({ item }) => renderFichaItem({ item, isCarousel: false })}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          ListHeaderComponent={
            <>
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
            </>
          }
          ListEmptyComponent={<Text style={styles.emptyText}>Nenhum modelo de treino encontrado.</Text>}
        />

        <Modal
          visible={isModalVisible}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={closeModal}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selectedFicha?.nome}</Text>
              <View style={styles.modalHeaderActions}>
                {isCustomizationAllowed && isCustomizing && (
                  <TouchableOpacity onPress={handleResetCustomization} style={{ marginRight: 20 }}>
                    <FontAwesome name="undo" size={22} color="#ccc" />
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={closeModal}>
                  <FontAwesome name="close" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
            
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalList}>
              {renderGoalDifferenceCard()}
              {isCustomizationAllowed && (
                <>
                  {renderCalendar()}
                  {renderCustomizationCard()}
                </>
              )}

              {loadingTreinos ? (
                <ActivityIndicator style={{ marginTop: 40 }} size="large" color="#fff" />
              ) : treinos.length > 0 ? (
                  treinos.map(treino => <View key={treino.id}>{renderTreinoDetailItem({ item: treino })}</View>) ) : (
                  <Text style={styles.emptyText}>Nenhum treino nesta ficha.</Text>
                )
              }
            </ScrollView>

            <View style={styles.modalFooter}>
              {isButtonDisabled ? (
                <View style={styles.disabledButtonContainer}>
                  <Text style={styles.disabledButtonText}>
                    Selecione {treinos.length} {treinos.length === 1 ? 'dia' : 'dias'} da semana para utilizar este plano de treino
                  </Text>
                </View>
              ) : (
                <AnimatedGradientBorderButton onPress={handleCopyFicha} disabled={isCopying}>
                  {isCopying ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.copyButtonText}>Usar este plano de treino</Text>
                  )}
                </AnimatedGradientBorderButton>
              )}
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#030405',
  },
  listContainer: {
    paddingHorizontal: 15,
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
    alignItems: 'center',
        borderTopColor: '#ffffff2a',
        borderLeftColor: '#ffffff2a', 
        borderBottomColor: '#ffffff1a',
        borderRightColor: '#ffffff1a',
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
    width: 140,
    height: 140,
    marginRight: 40,
    resizeMode: 'contain',
    position: 'absolute',
    opacity: 0.4,
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
    flex: 1,
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  modalHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
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
        borderTopColor: '#ffffff2a',
        borderLeftColor: '#ffffff2a', 
        borderBottomColor: '#ffffff1a',
        borderRightColor: '#ffffff1a',
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
  exercicioContainer: {
    marginLeft: 10,
    marginTop: 12, // Aumenta o espaçamento entre os exercícios
  },
  exercicioText: {
    fontSize: 16, // Aumenta o tamanho do nome do exercício
    color: '#fff',
    fontWeight: '500',
  },
  exercicioDetailText: {
    fontSize: 14,
    color: '#aaa',
    marginTop: 4, // Adiciona espaço abaixo do nome do exercício
  },
    // Goal Difference Card
  goalDiffCard: {
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
    borderWidth: 1,
    alignItems: 'center',
  },
  goalDiffDestructive: {
    backgroundColor: 'rgba(255, 59, 48, 0.15)',
    borderColor: 'rgba(255, 59, 48, 0.5)',
  },
  goalDiffConstructive: {
    backgroundColor: 'rgba(28, 176, 246, 0.15)',
    borderColor: 'rgba(28, 176, 246, 0.5)',
  },
  goalDiffTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 15,
  },
  goalDiffImages: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 15,
  },
  goalDiffImage: {
    width: 50,
    height: 50,
    resizeMode: 'contain',
  },
  goalDiffInfo: {
    color: '#ccc',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 15,
  },
  goalDiffButtonDestructive: {
    backgroundColor: '#ff3b30',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  goalDiffButtonConstructive: {
    backgroundColor: '#1cb0f6',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  goalDiffButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },

  // Estilos do Calendário e Customização
  calendarContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingVertical: 10,
  },
  dayContainer: {
    flex: 1,
    paddingVertical: 10,
    marginHorizontal: 3,
    borderRadius: 8,
    backgroundColor: '#1f1f1f',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  dayScheduledInitial: { // Novo estilo para dias agendados inicialmente
    backgroundColor: 'rgba(28, 176, 246, 0.5)', // 50% opacidade do #1cb0f6
    borderColor: '#333',
  },
  daySelected: {
    backgroundColor: '#1cb0f6',
    borderColor: '#1cb0f6',
  },
  dayText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  calendarSubText: {
    color: '#888',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  customizationCard: {
    backgroundColor: '#141414',
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
  },
  customizationTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginBottom: 15 },
  customizationItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 10 },
  customizationText: { color: '#888', fontSize: 14 },
  customizationTextAssigned: { color: '#fff', textDecorationLine: 'line-through' },
  modalFooter: {
    marginTop: 20,
    marginBottom: 10,
    borderTopWidth: 1,
    borderTopColor: '#ffffff1a',
    padding: 10,
  },
  disabledButtonContainer: {
    backgroundColor: '#1f1f1f',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  disabledButtonText: {
    color: '#888',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: 22,
  },
  progressBarContainer: {
    height: 8,
    width: '100%',
    backgroundColor: '#333',
    borderRadius: 4,
    marginBottom: 5,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#1cb0f6',
    borderRadius: 4,
  },
  progressText: {
    color: '#ccc',
    fontSize: 12,
    textAlign: 'right',
    marginBottom: 15,
  },
  copyButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
