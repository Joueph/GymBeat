import { Exercicio, Serie } from '@/models/exercicio';
import { FontAwesome } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { VideoView as Video, useVideoPlayer } from 'expo-video';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Log } from '../../models/log';
import { Treino } from '../../models/treino';
import { addLog } from '../../services/logService';
import { getTreinoById } from '../../services/treinoService';
import { useAuth } from '../authprovider';

// A new component to manage each video player instance
export function VideoListItem({ uri, style }: { uri: string; style: any }) {
  const player = useVideoPlayer(uri, (player) => {
    player.loop = true;
    player.muted = true;
    player.play();
  });

  // useEffect for player cleanup.
  useEffect(() => {
    // The pre-flight network request and diagnostic logs have been removed
    // to prepare the component for production.

    // Cleanup the player when the component unmounts or the URI changes.
    return () => {
      player.release();
    };
  }, [uri, player]);
  return <Video style={style} player={player} nativeControls={false} contentFit="cover" />;
}

export default function OngoingWorkoutScreen() {
  const router = useRouter();
  const { user } = useAuth();
  // We'll get the treinoId and fichaId from the navigation parameters
  const { treinoId, fichaId } = useLocalSearchParams();

  const [treino, setTreino] = useState<Treino | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [completedSets, setCompletedSets] = useState(0);
  const [horarioInicio, setHorarioInicio] = useState<Date | null>(null);

  const [isResting, setIsResting] = useState(false);
  const [restTime, setRestTime] = useState(0);

  // State for the exercise edit modal
  const [isEditExerciseModalVisible, setEditExerciseModalVisible] = useState(false);
  const [editingSeries, setEditingSeries] = useState<Serie[]>([]);

  const [isExerciseListVisible, setExerciseListVisible] = useState(false);
  const [isExerciseDetailModalVisible, setExerciseDetailModalVisible] = useState(false);

  // Memoize the max rest time to avoid recalculation
  const maxRestTime = useMemo(() => {
    if (!treino) return 0;
    return treino.intervalo.min * 60 + treino.intervalo.seg;
  }, [treino]);

  // Open modal to edit current exercise's sets, reps, and weight
  const handleEdit = useCallback(() => {
    if (!treino) return;
    const currentExercise = treino.exercicios[currentExerciseIndex];
    // Deep copy to avoid direct state mutation
    const seriesCopy = JSON.parse(JSON.stringify(currentExercise.series));
    setEditingSeries(seriesCopy);
    setEditExerciseModalVisible(true);
  }, [treino, currentExerciseIndex]);

  const handleShowList = useCallback(() => {
    setExerciseListVisible(true);
  }, []);

  // Fetch workout data when the component mounts
  useEffect(() => {
    setHorarioInicio(new Date());
    const fetchTreino = async () => {
      if (typeof treinoId !== 'string') {
        Alert.alert("Erro", "ID do treino inválido.");
        router.back();
        return;
      }
      try {
        const treinoData = await getTreinoById(treinoId);
        if (treinoData) {
          if (!treinoData.exercicios || treinoData.exercicios.length === 0 || !treinoData.exercicios[0].series || treinoData.exercicios[0].series.length === 0) {
            Alert.alert("Treino Vazio", "Este treino não possui exercícios. Adicione exercícios para poder iniciá-lo.", [{ text: "OK", onPress: () => router.back() }]);
            return;
          }
          setTreino(treinoData);
          setRestTime(treinoData.intervalo.min * 60 + treinoData.intervalo.seg);
        } else {
          Alert.alert("Erro", "Treino não encontrado.");
          router.back();
        }
      } catch (error) {
        console.error("Failed to fetch workout:", error);
        Alert.alert("Erro", "Não foi possível carregar o treino.");
        router.back();
      } finally {
        setLoading(false);
      }
    };

    fetchTreino();
  }, [treinoId]);

  // Handles the countdown timer logic
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isResting && restTime > 0) {
      interval = setInterval(() => {
        setRestTime(prevTime => prevTime - 1);
      }, 1000);
    } else if (isResting && restTime === 0) {
      setIsResting(false);
      // Reset timer for the next rest period
      setRestTime(maxRestTime);
    }
    return () => clearInterval(interval);
  }, [isResting, restTime, maxRestTime]);

  // Handles completing a set and moving to the next exercise or finishing the workout
  const handleCompleteSet = async () => {
    if (!treino || !user) return;

    const currentExercise = treino.exercicios[currentExerciseIndex];
    const newCompletedSets = completedSets + 1;

    // Check if the current exercise is finished
    if (newCompletedSets >= currentExercise.series.length) {
      // Check if it's the last exercise of the workout
      if (currentExerciseIndex < treino.exercicios.length - 1) {
        setCurrentExerciseIndex(prev => prev + 1);
        setCompletedSets(0);
      } else {
        // Workout finished!
        const horarioFim = new Date();
        const logData: Omit<Log, 'id'> = {
          usuarioId: user.uid,
          treino: { ...treino, id: treinoId as string }, // Ensure treino has an ID
          exercicios: treino.exercicios,
          exerciciosFeitos: treino.exercicios, // For simplicity, assumes all exercises were completed
          horarioInicio: horarioInicio!,
          horarioFim: horarioFim,
        };

        try {
          await addLog(logData);
          Alert.alert("Parabéns!", "Você concluiu o treino e seu progresso foi salvo!", [{ text: "OK", onPress: () => router.back() }]);
        } catch (error) {
          console.error("Failed to save workout log:", error);
          Alert.alert("Erro", "Não foi possível salvar seu progresso, mas parabéns por concluir!", [{ text: "OK", onPress: () => router.back() }]);
        }
        return;
      }
    } else {
      setCompletedSets(newCompletedSets);
    }

    // Start resting after a set is completed
    setIsResting(true);
  };

  const handleSaveExerciseChanges = () => {
    if (!treino) return;

    // Basic validation
    if (editingSeries.some(s => !s.repeticoes || s.repeticoes.trim() === '')) {
      Alert.alert("Erro", "Todas as séries devem ter repetições definidas.");
      return;
    }

    const updatedExercicios = [...treino.exercicios];
    const exerciseToUpdate = { ...updatedExercicios[currentExerciseIndex] };

    // Replace the series with the edited ones
    exerciseToUpdate.series = editingSeries;
    updatedExercicios[currentExerciseIndex] = exerciseToUpdate;

    setTreino(prevTreino => prevTreino ? { ...prevTreino, exercicios: updatedExercicios } : null);
    setEditExerciseModalVisible(false);
    setEditingSeries([]); // Clear editing state
  };

  // Formats seconds into a MM:SS string
  const formatTime = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  // Asks for confirmation before leaving the workout
  const handleBack = () => {
    Alert.alert(
      "Sair do Treino?",
      "Seu progresso não será salvo. Deseja continuar?",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Sair", style: "destructive", onPress: () => router.back() },
      ]
    );
  };

  if (loading || !treino) {
    return <ActivityIndicator style={styles.container} size="large" color="#fff" />;
  }

  const currentExercise = treino.exercicios[currentExerciseIndex];

  // REMOVED: All constants for the circular progress bar animation
  
  const renderExerciseProgressItem = ({ item, index }: { item: Exercicio, index: number }) => {
    const isCompleted = index < currentExerciseIndex;
    const isCurrent = index === currentExerciseIndex;
    const totalExercises = treino.exercicios.length;

    // The track is composed of two halves to allow for different colors
    const TopTrack = () => (
        <View style={{
            position: 'absolute',
            top: 0,
            bottom: '50%',
            width: 2,
            backgroundColor: (isCompleted || isCurrent) ? '#1cb0f6' : '#333',
            opacity: index === 0 ? 0 : 1,
        }} />
    );

    const BottomTrack = () => (
        <View style={{
            position: 'absolute',
            top: '50%',
            bottom: 0,
            width: 2,
            backgroundColor: isCompleted ? '#1cb0f6' : '#333',
            opacity: index === totalExercises - 1 ? 0 : 1,
        }} />
    );

    return (
        <View style={styles.progressListItem}>
            <View style={styles.timelineContainer}>
                <TopTrack />
                <BottomTrack />
                <View style={[
                    styles.timelineDot,
                    isCompleted && styles.completedDot,
                    isCurrent && styles.currentDot,
                ]} />
            </View>
            <View style={styles.exerciseContent}>
                <Text style={[styles.modalExerciseName, isCompleted && { textDecorationLine: 'line-through', opacity: 0.7 }]}>{item.modelo.nome}</Text>
                <Text style={styles.modalExerciseDetails}>{item.series.length} séries</Text>
            </View>
        </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <FontAwesome name="close" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Treino Rolando</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.content}>
        {/* MODIFIED: Removed the entire progress circle structure, leaving only the timer label and text */}
        <View style={styles.timerContainer}>
          <Text style={styles.timerLabel}>Tempo de Intervalo</Text>
          <Text style={styles.timerText}>
            {isResting ? formatTime(restTime) : formatTime(maxRestTime)}
          </Text>
        </View>

        <View style={styles.bottomSectionContainer}>
          <View style={styles.exerciseSectionContainer}>
            <TouchableOpacity style={styles.exerciseCard} onPress={() => setExerciseDetailModalVisible(true)}>
                {currentExercise.modelo.imagemUrl && (
                    <VideoListItem uri={currentExercise.modelo.imagemUrl} style={styles.exerciseVideo} />
                )}
                <View style={styles.exerciseInfoContainer}>
                    <Text style={styles.exerciseName}>{currentExercise.modelo.nome}</Text>
                    <Text style={styles.exerciseMuscleGroup}>{currentExercise.modelo.grupoMuscular}</Text>
                </View>
            </TouchableOpacity>

            <View style={styles.detailsContainer}>
                <View style={styles.detailItem}>
                    <FontAwesome name="clone" size={20} color="#ccc" />
                    <Text style={styles.detailValue}>{completedSets + 1}/{currentExercise.series.length}</Text>
                    <Text style={styles.detailLabel}>Séries</Text>
                </View>
                <View style={styles.detailItem}>
                    <FontAwesome name="repeat" size={20} color="#ccc" />
                    <Text style={styles.detailValue}>{currentExercise.series[completedSets].repeticoes}</Text>
                    <Text style={styles.detailLabel}>Repetições</Text>
                </View>
                <View style={styles.detailItem}>
                    <FontAwesome name="dashboard" size={20} color="#ccc" />
                    <Text style={styles.detailValue}>{currentExercise.series[completedSets].peso || 0} kg</Text>
                    <Text style={styles.detailLabel}>Peso</Text>
                </View>
            </View>
          </View>

          <View style={styles.actionsContainer}>
            <TouchableOpacity style={styles.actionButton} onPress={handleEdit}>
              <FontAwesome name="pencil" size={24} color="#fff" />
              <Text style={styles.actionButtonText}>Editar</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.mainActionButton} onPress={handleCompleteSet}>
              <FontAwesome name="check" size={40} color="#0d181c" />
              <Text style={styles.mainActionButtonText}>Concluir Série</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={handleShowList}>
              <FontAwesome name="list-ul" size={24} color="#fff" />
              <Text style={styles.actionButtonText}>Lista</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <Modal
        visible={isExerciseListVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setExerciseListVisible(false)}
      >
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Lista de Exercícios</Text>
            <TouchableOpacity onPress={() => setExerciseListVisible(false)}>
              <FontAwesome name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          <FlatList
            data={treino.exercicios}
            keyExtractor={(item, index) => `exercicio-lista-${index}`}
            renderItem={renderExerciseProgressItem}
            contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20 }}
          />
        </SafeAreaView>
      </Modal>

      <Modal
        animationType="fade"
        transparent={true}
        visible={isEditExerciseModalVisible}
        onRequestClose={() => setEditExerciseModalVisible(false)}
      >
        <View style={styles.centeredView}>
            <View style={styles.editExerciseModalView}>
                <Text style={styles.modalText}>Editar {currentExercise.modelo.nome}</Text>
                <FlatList
                    data={editingSeries}
                    style={{width: '100%', maxHeight: 250}}
                    keyExtractor={(item, index) => item.id || `serie-${index}`}
                    renderItem={({ item, index }) => (
                        <View style={styles.setRow}>
                            <Text style={styles.setText}>Série {index + 1}</Text>
                            <TextInput
                                style={styles.setInput}
                                placeholder="Reps"
                                placeholderTextColor="#888"
                                value={item.repeticoes}
                                onChangeText={(text) => {
                                    const newSeries = [...editingSeries];
                                    newSeries[index].repeticoes = text;
                                    setEditingSeries(newSeries);
                                }}
                            />
                            <TextInput
                                style={styles.setInput}
                                placeholder="kg"
                                placeholderTextColor="#888"
                                keyboardType="numeric"
                                value={String(item.peso || '')}
                                onChangeText={(text) => {
                                    const newSeries = [...editingSeries];
                                    newSeries[index].peso = parseFloat(text) || 0;
                                    setEditingSeries(newSeries);
                                }}
                            />
                        </View>
                    )}
                />
                <View style={styles.modalButtons}>
                    <TouchableOpacity style={[styles.button, styles.buttonClose]} onPress={() => {
                        setEditExerciseModalVisible(false);
                        setEditingSeries([]);
                    }}>
                        <Text style={styles.textStyle}>Cancelar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.button, styles.buttonAdd]} onPress={handleSaveExerciseChanges}>
                        <Text style={styles.textStyle}>Salvar</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
      </Modal>

      {/* Exercise Detail Modal */}
      <Modal
        visible={isExerciseDetailModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setExerciseDetailModalVisible(false)}
      >
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Detalhes do Exercício</Text>
            <TouchableOpacity onPress={() => setExerciseDetailModalVisible(false)}>
              <FontAwesome name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.detailModalContentWrapper}>
            <ScrollView>
              <View>
                {currentExercise.modelo.imagemUrl && (
                  <VideoListItem uri={currentExercise.modelo.imagemUrl} style={styles.detailModalVideo} />
                )}
                <Text style={styles.detailModalExerciseName}>{currentExercise.modelo.nome}</Text>
              </View>

              <View style={styles.detailModalSeriesContainer}>
                {currentExercise.series.map((item, index) => (
                  <View key={item.id || `serie-detail-${index}`} style={styles.detailModalSetRow}>
                    <Text style={styles.detailModalSetText}>Série {index + 1}</Text>
                    <View style={styles.detailModalSetInfoContainer}>
                      <Text style={styles.detailModalSetInfo}>{item.repeticoes}</Text>
                      <Text style={styles.detailModalSetInfo}>{item.peso || 0} kg</Text>
                    </View>
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#030405' },
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#030405' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, paddingVertical: 10 },
  backButton: {},
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  content: { flex: 1, justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingBottom: 40 },
  exerciseCard: {
    backgroundColor: '#141414',
    borderRadius: 15,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderWidth: 1,
    borderColor: '#ffffff1a',
  },
  exerciseVideo: {
    width: 80,
    height: 80,
    backgroundColor: '#000',
    borderRadius: 10,
    marginRight: 15,
  },
  exerciseInfoContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  exerciseName: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  exerciseMuscleGroup: { color: '#fff', fontWeight: '300', opacity: 0.65, marginTop: 4 },
  exerciseSectionContainer: {
    width: '100%',
    gap: 10,
  },
  bottomSectionContainer: {
    width: '100%',
    alignItems: 'center',
    gap: 15,
  },
  timerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  // REMOVED: All styles related to the progress circle
  // (progressCircleContainer, progressBackground, leftHalfWrapper, rightHalfWrapper, rightProgressLoader, leftProgressLoader, innerCircle)
  timerLabel: { color: '#aaa', fontSize: 18, marginBottom: 10 },
  timerText: { color: '#fff', fontSize: 60, fontWeight: 'bold', letterSpacing: 2 },
  detailsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    backgroundColor: 'transparent',
    paddingVertical: 15,
    borderRadius: 15,
  },
  detailItem: {
    alignItems: 'center',
    flex: 1,
  },
  detailValue: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 8,
  },
  detailLabel: {
    color: '#aaa',
    fontSize: 14,
    marginTop: 4,
  },
  actionsContainer: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', width: '100%' },
  actionButton: { alignItems: 'center', padding: 10, minWidth: 60 },
  actionButtonText: { color: '#fff', marginTop: 8, fontSize: 12 },
  mainActionButton: { backgroundColor: '#1cb0f6', width: 120, height: 120, borderRadius: 60, justifyContent: 'center', alignItems: 'center', elevation: 8, shadowColor: '#1cb0f6', shadowOpacity: 0.4, shadowRadius: 8 },
  mainActionButtonText: { color: '#0d181c', fontWeight: 'bold', marginTop: 5, fontSize: 12 },
  modalSafeArea: { flex: 1, backgroundColor: '#0d181c' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#222' },
  modalTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  progressListItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    minHeight: 80,
  },
  timelineContainer: {
    width: 30,
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#333',
    position: 'absolute',
    top: 24,
  },
  exerciseContent: {
    flex: 1,
    paddingLeft: 10,
    paddingTop: 20,
    paddingBottom: 20,
  },
  completedDot: {
    backgroundColor: '#1cb0f6',
  },
  currentDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#0d181c',
    borderWidth: 3,
    borderColor: '#1cb0f6',
    top: 21,
  },
  modalExerciseName: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  modalExerciseDetails: { color: '#aaa', fontSize: 14, marginTop: 4 },
  // Edit Exercise Modal Styles
  centeredView: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  editExerciseModalView: {
    margin: 20,
    backgroundColor: "#1a2a33",
    borderRadius: 20,
    padding: 35,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5
  },
  modalText: {
    marginBottom: 15,
    textAlign: "center",
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold'
  },
  modalInput: {
    backgroundColor: '#222',
    color: '#fff',
    padding: 10,
    borderRadius: 8,
    fontSize: 16,
    marginBottom: 15,
    width: 200,
    textAlign: 'center'
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 10,
  },
  button: {
    borderRadius: 10,
    padding: 10,
    elevation: 2,
    flex: 1,
    marginHorizontal: 5,
  },
  buttonClose: { backgroundColor: "#ff3b30" },
  buttonAdd: { backgroundColor: "#1cb0f6" },
  textStyle: { color: "white", fontWeight: "bold", textAlign: "center" },
  // Styles for set editing in modal
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
    width: '100%',
  },
  setText: {
    color: '#fff',
    fontWeight: 'bold',
    marginRight: 'auto',
  },
  setInput: {
    backgroundColor: '#333',
    color: '#fff',
    padding: 8,
    borderRadius: 5,
    width: 70,
    textAlign: 'center',
    marginHorizontal: 5,
  },
  // Styles for Exercise Detail Modal
  detailModalContentWrapper: {
    flex: 1,
    padding: 5,
  },
  detailModalVideo: {
    width: '100%',
    aspectRatio: 1, // Proporção 1:1 (quadrado)
    borderRadius: 15,
    backgroundColor: '#000',
    marginBottom: 10,
  },
  detailModalExerciseName: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    paddingVertical: 10,
  },
  detailModalSeriesContainer: {
    backgroundColor: 'transparent',
    marginTop: 15,
  },
  detailModalSetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1a2a33',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  detailModalSetText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  detailModalSetInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailModalSetInfo: {
    color: '#ccc',
    fontSize: 16,
    marginLeft: 20,
  },
});