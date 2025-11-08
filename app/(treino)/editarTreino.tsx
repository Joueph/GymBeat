import { Exercicio, ExercicioModelo, Serie } from '@/models/exercicio';
import { addTreino, deleteTreino, getTreinoById, updateTreino } from '@/services/treinoService';
import { FontAwesome, FontAwesome5, Ionicons } from '@expo/vector-icons';
import { ResizeMode, Video } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RepetitionsDrawer } from '../../components/RepetitionsDrawer';
import { RestTimeDrawer } from '../../components/RestTimeDrawer'; // Importa o novo componente
import { SetOptionsMenu } from '../../components/SetOptionsMenu';
import { Log } from '../../models/log';
import { Treino } from '../../models/treino';
import { getCachedActiveWorkoutLog } from '../../services/offlineCacheService';
import { useAuth } from '../authprovider';
import { MultiSelectExerciseModal } from './modals/MultiSelectExerciseModal';

const DIAS_SEMANA_ORDEM = { 'dom': 0, 'seg': 1, 'ter': 2, 'qua': 3, 'qui': 4, 'sex': 5, 'sab': 6 };
const DIAS_SEMANA_ARRAY = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'] as const;
type DiaSemana = typeof DIAS_SEMANA_ARRAY[number];

interface SerieEdit extends Serie {
  id: string;
  type: 'normal' | 'dropset';
}

export function VideoListItem({ uri, style }: { uri: string; style: any }) {
  const [localUri, setLocalUri] = useState<string | null>(null);
  const isWebP = uri?.toLowerCase().includes('.webp');

  useEffect(() => {
    const manageMedia = async () => {
      if (!uri) return;
      const fileName = uri.split('/').pop()?.split('?')[0];
      if (!fileName) return;

      const localFileUri = `${FileSystem.cacheDirectory}${fileName}`;
      const fileInfo = await FileSystem.getInfoAsync(localFileUri);

      if (fileInfo.exists) {
        setLocalUri(localFileUri);
      } else {
        try {
          await FileSystem.downloadAsync(uri, localFileUri);
          setLocalUri(localFileUri);
        } catch (e) {
          console.error("Erro ao baixar a mídia:", e);
          setLocalUri(uri);
        }
      }
    };

    manageMedia();
  }, [uri]);

  if (!localUri) {
    return <View style={[style, { backgroundColor: '#333', justifyContent: 'center', alignItems: 'center' }]}><ActivityIndicator color="#fff" /></View>;
  }

  if (isWebP) {
    return <Image source={{ uri: localUri || uri }} style={style} />;
  }

  return (
    <Video
      source={{ uri: localUri || uri }}
      isMuted={true}
      isLooping={true}
      shouldPlay={true}
      resizeMode={ResizeMode.COVER}
      style={style}
    />
  );
}

// Define uma interface para as props do componente para melhor tipagem
interface ExerciseItemProps {
  item: Exercicio;
  drag: () => void;
  isActive: boolean;
  onUpdateExercise: (ex: Exercicio) => void;
  onRemoveExercise: () => void;
  exerciseIndex: number;
  onOpenRepDrawer: (exerciseIndex: number, setIndex: number) => void;
  onOpenRestTimeModal: (exerciseIndex: number) => void;
  setIsEditing: (isEditing: boolean) => void;
}

const REST_TIME_OPTIONS = [
  { label: '30 seg', value: 30 },
  { label: '45 seg', value: 45 },
  { label: '1 min', value: 60 },
  { label: '1 min 30 seg', value: 90 },
  { label: '2 min', value: 120 },
  { label: '2 min 30 seg', value: 150 },
  { label: '3 min', value: 180 },
];

const formatRestTime = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes > 0 && remainingSeconds > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return minutes > 0 ? `${minutes} min` : `${remainingSeconds} seg`;
};

const ExerciseItem = ({
  item,
  drag,
  isActive,
  onUpdateExercise,
  onRemoveExercise,
  exerciseIndex,
  onOpenRepDrawer,
  onOpenRestTimeModal,
  setIsEditing,
}: ExerciseItemProps) => {
  const [series, setSeries] = useState<SerieEdit[]>(
    item.series.map((s, i) => ({ ...s, id: s.id || `set-${Date.now()}-${i}`, type: s.type || 'normal' }))
  );

  // Sincroniza o estado interno 'series' com as props que vêm do componente pai.
  // Isso garante que a UI reflita as mudanças feitas no drawer de repetições.
  useEffect(() => {
    setSeries(item.series.map((s, i) => ({ ...s, id: s.id || `set-${Date.now()}-${i}`, type: s.type || 'normal' })));
  }, [item.series]);

  const handleSeriesUpdate = (newSeries: SerieEdit[]) => {
    setSeries(newSeries);
    onUpdateExercise({ ...item, series: newSeries });
    setIsEditing(true); // Ativa o modo de edição imediatamente
  };

  const handleSetOption = (option: 'addDropset' | 'copy' | 'delete' | 'toggleTime', index: number) => {
    setTimeout(() => {
      const newSets = [...series];
      if (option === 'delete') {
        newSets.splice(index, 1);
      } else if (option === 'copy') {
        newSets.splice(index + 1, 0, { ...newSets[index], id: `set-${Date.now()}` });
      } else if (option === 'addDropset') {
        const parentSet = newSets[index];
        newSets.splice(index + 1, 0, {
          id: `set-${Date.now()}`,
          repeticoes: parentSet.repeticoes,
          peso: (parentSet.peso ?? 10) * 0.7,
          type: 'dropset',
          concluido: false,
        });
      } else if (option === 'toggleTime') {
        newSets[index].isTimeBased = !newSets[index].isTimeBased;
      }
      handleSeriesUpdate(newSets);
    }, 100);
  };

  const renderSetItem = (setItem: SerieEdit, index: number) => {
    const normalSeriesCount = series.slice(0, index + 1).filter(s => s.type === 'normal').length;

    return (
      <View key={setItem.id} style={[styles.setRow, setItem.type === 'dropset' && styles.dropsetRow]}>
        {setItem.type === 'dropset' ? (
          <FontAwesome5 name="arrow-down" size={16} color="#888" style={styles.setIndicator} />
        ) : (
          <Text style={styles.setIndicator}>{normalSeriesCount}</Text>
        )}
        <View style={styles.inputGroup}>
          {/* Substituído TextInput por um botão que abre o RepetitionsDrawer */}
          <TouchableOpacity
            style={styles.repButton}
            onPress={() => {
              if (!setItem.isTimeBased) onOpenRepDrawer(exerciseIndex, index);
            }}
          >
            <Text style={styles.repButtonText}>{String(setItem.repeticoes)}</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.xText}>x</Text>
        <View style={styles.inputGroup}>
          {/* O rótulo de peso foi removido daqui */}
          <TextInput
            style={styles.setInput}
            value={String(setItem.peso || '')}
            onChangeText={text => {
              const newSets = series.map((s, i) => 
                i === index ? { ...s, peso: parseFloat(text.replace(',', '.')) || 0 } : s
              );
              handleSeriesUpdate(newSets);
            }}
            keyboardType="decimal-pad"
          />
        </View>
        <SetOptionsMenu
          isTimeBased={!!setItem.isTimeBased}
          isNormalSet={setItem.type === 'normal'}
          onSelect={action => handleSetOption(action, index)}
        />
      </View>
    );
  };

  const renderSeriesHeader = () => (
    <View style={styles.seriesHeader}>
      <View style={styles.setIndicator} />
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Reps</Text>
      </View>
      <View style={styles.xText} />
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Peso (kg)</Text>
      </View>
      {/* Espaço para alinhar com o botão de opções */}
      <View style={{ width: 40 }} />
    </View>
  );

  return (
    <ScaleDecorator>
      <View style={[styles.exercicioCard, isActive && styles.activeCard]}>
        <View style={styles.exercicioHeader}>
          {/* ADICIONADO: Verificação para evitar erro se o modelo não existir */}
          {item.modelo?.imagemUrl ? (
            <VideoListItem uri={item.modelo.imagemUrl} style={styles.exerciseVideo} />
          ) : (
            <View style={[styles.exerciseVideo, { backgroundColor: '#333' }]} />
          )}
          <View style={styles.exerciseInfo}>
            <Text style={styles.exercicioName}>{item.modelo?.nome}</Text>
            <Text style={styles.muscleGroup}>{item.modelo?.grupoMuscular}</Text>
          </View>
          <TouchableOpacity onLongPress={drag} disabled={isActive} style={styles.dragHandle}>
            <FontAwesome name="bars" size={20} color="#888" />
          </TouchableOpacity>
        </View>
        {item && (
          <View style={styles.notesContainer}>
            <FontAwesome name="pencil" size={12} color="#fff" />
            <TextInput
              style={styles.notesInput}
              placeholder="Anotações do exercício..."
              placeholderTextColor="#888"
              value={item.notes || ''}
              onChangeText={(text) => onUpdateExercise({ ...item, notes: text })}
              multiline
            />
          </View>
        )}
        <View style={styles.seriesContainer}>
          {series.length > 0 && renderSeriesHeader()}
          {series.map(renderSetItem)}
        </View>
        <TouchableOpacity
          style={styles.addSetButton}
          onPress={() => {
            const lastSet = series[series.length - 1];
            handleSeriesUpdate([
              ...series,
              {
                id: `set-${Date.now()}`,
                repeticoes: lastSet?.repeticoes || '10',
                peso: lastSet?.peso || 10,
                type: 'normal',
                concluido: false,
              },
            ]);
          }}
        >
          <FontAwesome name="plus" size={14} color="#1cb0f6" />
          <Text style={styles.addSetButtonText}>Adicionar Série</Text>
        </TouchableOpacity>
        <View style={styles.exerciseActions}>
          <TouchableOpacity style={styles.restTimerCard} onPress={() => onOpenRestTimeModal(exerciseIndex)}>
            <FontAwesome name="clock-o" size={18} color="#fff" />
            <Text style={styles.restTimerText}>{formatRestTime(item.restTime || 90)}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.removeExerciseButton} onPress={onRemoveExercise}>
            <FontAwesome name="trash" size={16} color="#ff3b30" />
          </TouchableOpacity>
        </View>
      </View>
    </ScaleDecorator>
  );
};

export default function EditarTreinoScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams();
  const { treinoId, fichaId, fromConfig } = params as { treinoId?: string; fichaId: string, fromConfig?: string };

  const [treino, setTreino] = useState<Treino | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isModalVisible, setModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isDaySelectorVisible, setDaySelectorVisible] = useState(false);
  // Estados para controlar o RepetitionsDrawer
  const [isRepDrawerVisible, setIsRepDrawerVisible] = useState(false);
  const [isRestTimeModalVisible, setIsRestTimeModalVisible] = useState(false);
  const [editingIndices, setEditingIndices] = useState<{ exerciseIndex: number; setIndex: number } | null>(null);
  const [activeLog, setActiveLog] = useState<Log | null>(null);

  // Animation state
  const editingProgress = useSharedValue(0);

  useEffect(() => {
    editingProgress.value = withTiming(isEditing ? 1 : 0, { duration: 300 });
  }, [isEditing]);

  useFocusEffect(
    useCallback(() => {
      const checkActiveWorkout = async () => {
        const log = await getCachedActiveWorkoutLog();
        setActiveLog(log);
      };
      checkActiveWorkout();
    }, [])
  );

  useEffect(() => {
    // Se for um novo treino (sem ID), já começa em modo de edição.
    if (!treinoId) {
      setIsEditing(true);
    }
  }, [treinoId]);

  useEffect(() => {
    const loadTreino = async () => {
      // --- LOG ADICIONADO ---
      console.log('[editarTreino] Parâmetros recebidos:', JSON.stringify(params, null, 2));
      // --- FIM DO LOG ---
      if (treinoId) {
        const fetchedTreino = await getTreinoById(treinoId as string);
        // --- LOG ADICIONADO ---
        console.log('[editarTreino] Treino carregado:', JSON.stringify(fetchedTreino, null, 2));
        if (fetchedTreino && fetchedTreino.exercicios) {
          fetchedTreino.exercicios.forEach((ex, index) => {
            if (!ex.modelo) {
              console.error(`[editarTreino] ERRO: Exercício no índice ${index} (ID: ${ex.modeloId}) veio sem 'modelo'.`);
            }
          });
        }
        // --- FIM DO LOG ---
        setTreino(fetchedTreino ? { ...fetchedTreino, id: treinoId as string } : {
          id: treinoId as string,
          nome: 'Novo Treino',
          usuarioId: user?.id || '',
          fichaId: fichaId || undefined,
          exercicios: [],
          diasSemana: [],
          intervalo: { min: 1, seg: 30 },
          ordem: 0, // Add default order
        });
      } else {
        // Criando um novo treino
        setTreino({
          id: '',
          nome: 'Novo Treino',
          usuarioId: user?.id || '',
          fichaId: fichaId || undefined, // Ensure fichaId is undefined if not provided
          exercicios: [],
          diasSemana: [],
          intervalo: { min: 1, seg: 30 },
          ordem: 0, // Add default order
        });
      }
      setLoading(false);
    };
    loadTreino();
  }, [treinoId, fichaId, user]);

  const handleClose = () => {
    router.back();
  };

  const handleStartWorkout = () => {
    if (!treino || !treino.id) return;    
    const targetPath = user?.workoutScreenType === 'simplified' 
      ? '/(treino)/ongoingWorkout' 
      : '/(treino)/LoggingDuringWorkout';

    router.push({ 
        pathname: targetPath, 
        params: { treinoId: treino.id, fichaId: treino.fichaId } 
    });    
  };


  // Abre o drawer de repetições, guardando os índices do item a ser editado
  const handleOpenRepDrawer = (exerciseIndex: number, setIndex: number) => {
    setEditingIndices({ exerciseIndex, setIndex });
    setIsRepDrawerVisible(true);
  };

  // Salva o novo valor de repetições e fecha o drawer
  const handleRepetitionsSave = (newReps: string) => {
    if (!editingIndices || !treino) return;

    const { exerciseIndex, setIndex } = editingIndices;
    const updatedExercicios = [...treino.exercicios];
    const seriesToUpdate = [...updatedExercicios[exerciseIndex].series];

    // Atualiza a repetição da série específica
    seriesToUpdate[setIndex] = { ...seriesToUpdate[setIndex], repeticoes: newReps };
    updatedExercicios[exerciseIndex] = { ...updatedExercicios[exerciseIndex], series: seriesToUpdate };

    // Atualiza o estado do treino
    if (!isEditing) setIsEditing(true);
    setTreino({ ...treino, exercicios: updatedExercicios });

    // Fecha o drawer e reseta os índices
    setIsRepDrawerVisible(false);
    setEditingIndices(null);
  };

  const handleOpenRestTimeModal = (exerciseIndex: number) => {
    setEditingIndices({ exerciseIndex, setIndex: -1 }); // setIndex is not needed here
    setIsRestTimeModalVisible(true);
  };

  const handleRestTimeSave = (newRestTime: number) => {
    if (!editingIndices || !treino) return;
    const { exerciseIndex } = editingIndices;
    const updatedExercise = { ...treino.exercicios[exerciseIndex], restTime: newRestTime };
    handleUpdateExercise(updatedExercise, exerciseIndex);
    setIsRestTimeModalVisible(false);
  };

  // Obtém o valor inicial de repetições para passar ao drawer
  const getRepetitionsValue = () => {
    if (!editingIndices || !treino) return '10'; // Valor padrão

    const { exerciseIndex, setIndex } = editingIndices;
    const exercise = treino.exercicios[exerciseIndex];
    return exercise?.series[setIndex]?.repeticoes || '10';
  };

  // Obtém o valor inicial do tempo de descanso para passar ao drawer
  const getRestTimeValue = () => {
    if (!editingIndices || !treino) return 90; // Valor padrão em segundos

    const { exerciseIndex } = editingIndices;
    const exercise = treino.exercicios[exerciseIndex];
    return exercise?.restTime || 90;
  };

  const handleSave = async () => {
    if (!treino) return;
    setIsSaving(true);
    try {
      if (treino.id && treino.id !== '') { // Se o treino tem um ID existente, atualiza.
        await updateTreino(treino.id, treino);
      } else { // Senão, cria um novo treino.
        const newTreinoId = await addTreino(treino);
        setTreino(prev => prev ? { ...prev, id: newTreinoId } : null); // Atualiza o ID no estado local
      }
      // After saving, return to "viewing" mode.
      setIsEditing(false);
    } catch (error) {
      console.error("Erro ao salvar treino:", error);
      Alert.alert('Erro', 'Não foi possível salvar o treino.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddExercises = (exerciciosSelecionados: ExercicioModelo[]) => {
    if (!treino) return;

    const novosExercicios: Exercicio[] = exerciciosSelecionados.map(modelo => ({
      modeloId: modelo.id,
      modelo: modelo,
      series: [{ id: `set-${Date.now()}`, repeticoes: '10', peso: 10, type: 'normal', concluido: false }],
      isBiSet: false,
      notes: '', // Adiciona a propriedade 'notes' obrigatória
      restTime: 90, // Default rest time in seconds
    }));

    if (!isEditing) setIsEditing(true);
    setTreino(prev => prev ? { ...prev, exercicios: [...prev.exercicios, ...novosExercicios] } : null);
    setModalVisible(false);
  };

  const handleUpdateExercise = (updatedExercise: Exercicio, index: number) => {
    if (!treino) return;
    const newExercicios = [...treino.exercicios];
    if (!isEditing) setIsEditing(true);
    newExercicios[index] = updatedExercise;
    setTreino({ ...treino, exercicios: newExercicios });
  };

  const handleRemoveExercise = (index: number) => {
    if (!treino) return;
    const exerciseName = treino.exercicios[index]?.modelo?.nome || 'este exercício';
    Alert.alert(
      "Apagar Exercício",
      `Tem certeza que deseja apagar "${exerciseName}" do seu treino?`,
      [
        {
          text: "Cancelar",
          style: "cancel"
        },
        {
          text: "Apagar",
          style: "destructive",
          onPress: () => {
            if (!isEditing) setIsEditing(true);
            const newExercicios = [...treino.exercicios];
            newExercicios.splice(index, 1);
            setTreino({ ...treino, exercicios: newExercicios });
          }
        }
      ]
    );
  };

  const handleToggleDay = (day: DiaSemana) => {
    if (!treino) return;
    const currentDays = treino.diasSemana || [];
    const newDays = currentDays.includes(day)
      ? currentDays.filter(d => d !== day)
      : [...currentDays, day];

    // Sort the days
    newDays.sort((a, b) => DIAS_SEMANA_ORDEM[a] - DIAS_SEMANA_ORDEM[b]);

    if (!isEditing) setIsEditing(true);
    setTreino({ ...treino, diasSemana: newDays });
  };

  const handleDeleteTreino = async () => {
    if (!treino || !treino.id) {
      Alert.alert("Erro", "Este treino ainda não foi salvo e não pode ser deletado.");
      router.back(); // Apenas volta se for um treino novo e não salvo
      return;
    }

    Alert.alert(
      "Apagar Treino",
      `Tem certeza que deseja apagar permanentemente o treino "${treino.nome}"? Esta ação não pode ser desfeita.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Apagar", style: "destructive", onPress: async () => {
            try {
              await deleteTreino(treino.id, treino.fichaId);
              Alert.alert("Sucesso", "O treino foi apagado.");
              router.back();
            } catch (error) { console.error("Erro ao apagar treino:", error); Alert.alert('Erro', 'Não foi possível apagar o treino.'); }
          }
        }
      ]
    );
  };
  const renderItem = useCallback(({ item, drag, isActive, getIndex }: RenderItemParams<Exercicio>) => {
    const index = getIndex();
    if (typeof index !== 'number') {
      return null;
    }
    return (
      <ExerciseItem
        item={item}
        exerciseIndex={index} // Passa o índice do exercício
        onOpenRepDrawer={handleOpenRepDrawer} // Passa a função para abrir o drawer
        drag={drag}
        onOpenRestTimeModal={handleOpenRestTimeModal}
        isActive={isActive}
        onUpdateExercise={(ex) => handleUpdateExercise(ex, index)}
        onRemoveExercise={() => handleRemoveExercise(index)} setIsEditing={setIsEditing}      />
    );
  }, [treino]);

  const viewingStyle = useAnimatedStyle(() => {
    return {
      opacity: 1 - editingProgress.value,
      transform: [{ translateY: editingProgress.value * -20 }],
    };
  });

  const editingStyle = useAnimatedStyle(() => {
    return {
      opacity: editingProgress.value,
      transform: [{ translateY: (1 - editingProgress.value) * 20 }],
    };
  });

  const HeaderTitle = ({ text, style }: { text: string, style: any }) => (
    <Animated.View style={[styles.headerTitleContainer, style]}>
      <Text style={styles.headerTitle}>{text}</Text>
    </Animated.View>
  );

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#fff" /></View>;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={handleClose} style={styles.backButton}>
            <Ionicons name="chevron-back" size={28} color="#fff" />
          </TouchableOpacity>
          <View style={{ height: 30, justifyContent: 'center' }}>
            <Animated.View style={[styles.headerTitleContainer, viewingStyle]}>
              <Text style={styles.headerTitle}>Visualizar Treino</Text>
            </Animated.View>
            <Animated.View style={[styles.headerTitleContainer, editingStyle]}>
              <Text style={styles.headerTitle}>{treinoId ? 'Editar Treino' : 'Novo Treino'}</Text>
            </Animated.View>
          </View>
        </View>
        <View style={styles.headerRight}>
          {isEditing ? (
            // Botão de Edição
            <Animated.View style={[styles.headerButtonWrapper, editingStyle]}>
              <TouchableOpacity onPress={handleSave} disabled={isSaving}>
                {isSaving ? <ActivityIndicator color="#1cb0f6" /> : (
                  <Text style={styles.saveButtonText}>Salvar</Text>
                )}
              </TouchableOpacity>
            </Animated.View>
          ) : (
            // Botões de Visualização
            <Animated.View style={[styles.headerButtonWrapper, viewingStyle]}>
              <TouchableOpacity style={styles.configButton} onPress={() => setIsEditing(true)}>
                <FontAwesome name="cog" size={22} color="#ccc" />
              </TouchableOpacity>
              
              {/* Lógica do botão Iniciar/Continuar */}
              {!activeLog ? (
                // Se não há treino ativo, mostra "Iniciar"
                <TouchableOpacity style={styles.startButton} onPress={handleStartWorkout} disabled={isSaving}>
                  {isSaving ? <ActivityIndicator color="#000" /> : (
                    <>
                      <Text style={styles.startButtonText}>Iniciar</Text>
                      <FontAwesome name="arrow-right" size={14} color="#000" />
                    </>
                  )}
                </TouchableOpacity>
              ) : activeLog.treino?.id === treino?.id ? (
                // Se o treino ativo é o mesmo que está sendo editado, mostra "Continuar"
                <TouchableOpacity style={styles.startButton} onPress={handleStartWorkout} disabled={isSaving}>
                  {isSaving ? <ActivityIndicator color="#000" /> : (
                    <>
                      <Text style={styles.startButtonText}>Continuar</Text>
                      <FontAwesome name="play" size={14} color="#000" />
                    </>
                  )}
                </TouchableOpacity>
              ) : null /* Se há um treino ativo diferente, não mostra nada */}
            </Animated.View>
          )}
        </View>
      </View>

      {treino && (
        <DraggableFlatList
          data={treino.exercicios}
          onDragEnd={({ data }) => setTreino(prev => prev ? { ...prev, exercicios: data } : null)}
          keyExtractor={(item) => item.modeloId || `new-${Math.random()}`}
          renderItem={renderItem}
          ListHeaderComponent={
            <View style={styles.listHeaderContainer}>
              <TextInput
                style={styles.titleInput}
                value={treino.nome}
                onChangeText={text => {
                  if (!isEditing) setIsEditing(true);
                  if (!isEditing) setIsEditing(true);
                  setTreino(prev => prev ? { ...prev, nome: text } : null);
                }}
                placeholder="Nome do Treino"
                placeholderTextColor="#888"
              />
              <TouchableOpacity
                style={styles.daySelectorContainer}
                onPress={() => setDaySelectorVisible(true)}
              >
                <Text style={styles.daySelectorText} numberOfLines={1}>
                  {treino.diasSemana.length > 0
                    ? treino.diasSemana.join(', ').toUpperCase() : 'Dias da semana'}
                </Text>
                <FontAwesome name={treino.diasSemana.length > 0 ? "calendar" : "chevron-down"} size={16} color="#ccc" />
              </TouchableOpacity>
            </View>
          }
          ListFooterComponent={
            <>
              <TouchableOpacity style={styles.addExerciseButton} onPress={() => setModalVisible(true)}>
                <FontAwesome name="plus" size={16} color="#fff" />
                <Text style={styles.addExerciseButtonText}>Adicionar Exercício</Text>
              </TouchableOpacity>

              {/* Botão para apagar o treino, só aparece se o treino já existir */}
              {treinoId && (
                <TouchableOpacity style={styles.deleteWorkoutButton} onPress={handleDeleteTreino}>
                  <FontAwesome name="trash" size={16} color="#ff3b30" />
                  <Text style={styles.deleteWorkoutButtonText}>Apagar Treino</Text>
                </TouchableOpacity>
              )}
            </>
          }
          contentContainerStyle={{ paddingBottom: 130 }}
        />
      )}

      <MultiSelectExerciseModal
        visible={isModalVisible}
        onClose={() => setModalVisible(false)}
        onConfirm={handleAddExercises}
        // Se veio da config, não filtra exercícios. Senão, filtra os já existentes.
        existingExerciseIds={fromConfig === 'true' ? [] : (treino?.exercicios.map(e => e.modeloId) || [])}
      />

      <RepetitionsDrawer
        visible={isRepDrawerVisible}
        onClose={() => setIsRepDrawerVisible(false)}
        onSave={handleRepetitionsSave}
        initialValue={getRepetitionsValue()}
      />

      <Modal
        transparent={true}
        visible={isDaySelectorVisible}
        animationType="fade"
        onRequestClose={() => setDaySelectorVisible(false)}
      >
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setDaySelectorVisible(false)}>
          <View style={styles.daySelectorModal}>
            <Text style={styles.daySelectorTitle}>Selecione os dias</Text>
            <View style={styles.daysContainer}>
              {DIAS_SEMANA_ARRAY.map(day => {
                const isSelected = treino?.diasSemana.includes(day);
                return (
                  <TouchableOpacity
                    key={day}
                    style={[styles.dayButton, isSelected && styles.dayButtonSelected]}
                    onPress={() => handleToggleDay(day)}
                  >
                    <Text style={styles.dayButtonText}>{day.toUpperCase()}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity style={styles.daySelectorCloseButton} onPress={() => setDaySelectorVisible(false)}><Text style={styles.daySelectorCloseButtonText}>Fechar</Text></TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* NOVO DRAWER DE TEMPO DE DESCANSO */}
      <RestTimeDrawer
        visible={isRestTimeModalVisible}
        onClose={() => {
          setIsRestTimeModalVisible(false);
          setEditingIndices(null);
        }}
        onSave={handleRestTimeSave}
        initialValue={getRestTimeValue()}
      />

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#030405', // Dark background
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10, // Mantido
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 4,
  },
  headerButtonWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 22, // Aumentado
    fontWeight: 'bold',
  },
  headerTitleContainer: {
    position: 'absolute',
  },
  saveButtonText: {
    color: '#1cb0f6',
    fontSize: 16,
    fontWeight: 'bold',
  },
  startButton: {
    backgroundColor: '#fff',
    borderRadius: 25,
    paddingVertical: 5,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  startButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#030405',
  },
  listHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,

    borderBottomColor: '#222',
  },
  titleInput: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
    flex: 1, // Allows the input to take available space
    borderBottomWidth: 1,
    borderColor: '#222',
    paddingRight: 10,
    paddingBottom: 5,
  },
  exercicioCard: {
    backgroundColor: '#141414',
    borderRadius: 12,
    marginHorizontal: 15,
    marginVertical: 8,
    padding: 15,
    borderWidth: 1,
    borderColor: '#222',
  },
  activeCard: {
    borderColor: '#1cb0f6',
    shadowColor: '#1cb0f6',
    shadowOpacity: 0.5,
    shadowRadius: 5,
    elevation: 10,
  },
  exercicioHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  exerciseVideo: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 15,
    backgroundColor: '#333',
  },
  exerciseInfo: {
    flex: 1,
  },
  exercicioName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  muscleGroup: {
    color: '#aaa',
    fontSize: 14,
    marginTop: 4,
  },
  dragHandle: {
    padding: 10,
  },
  seriesContainer: {
    marginTop: 10,
  },
  seriesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
    paddingHorizontal: 5, // Alinha com o padding do setRow
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    paddingVertical: 5,
  },
  dropsetRow: {
    marginLeft: 20,
    borderLeftWidth: 2,
    borderLeftColor: '#444',
    paddingLeft: 10,
  },
  setIndicator: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    width: 40, // Aumentado para alinhar com o dragHandle
    textAlign: 'center',
  },
  inputGroup: {
    alignItems: 'center',
    flex: 1, // Adicionado para que o grupo ocupe o espaço disponível
  },
  inputLabel: {
    color: '#aaa',
    fontSize: 10,
    marginBottom: 4,
  },
  setInput: {
    backgroundColor: '#2c2c2e',
    color: '#fff',
    padding: 10,
    borderRadius: 5,
    textAlign: 'center',
    fontSize: 16,
    minWidth: 80,
  },
  repButton: {
    backgroundColor: '#2c2c2e',
    padding: 10,
    borderRadius: 5,
    minWidth: 80,
    height: 42, // Para alinhar com o TextInput
    justifyContent: 'center',
    alignItems: 'center',
  },
  repButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  xText: {
    color: '#888',
    fontSize: 14,
    alignSelf: 'flex-end',
    paddingBottom: 10,
  },
  exerciseActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#222',
  },
  addSetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 15,
    marginTop: 10,
    backgroundColor: '#1f1f1f',
    borderRadius: 8,
    alignSelf: 'center',
    width: '100%',
    justifyContent: 'center',
  },
  addSetButtonText: {
    color: '#1cb0f6',
    fontWeight: 'bold',
    fontSize: 14,
  },
  configButton: {
    padding: 10, // Aumenta a área de toque
    marginLeft: 15,
  },
  removeExerciseButton: {
    padding: 10,
  },
  restTimerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2c2c2e',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    gap: 8,
  },
  restTimerText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  addExerciseButton: {
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: '#222',
    borderRadius: 12,
    padding: 15,
    margin: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  addExerciseButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  deleteWorkoutButton: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.5)',
    borderRadius: 12,
    padding: 15,
    marginHorizontal: 15,
    marginTop: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  deleteWorkoutButtonText: {
    color: '#ff3b30',
    fontSize: 16,
    fontWeight: 'bold',
  },
  notesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  notesInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    paddingVertical: 5,
    paddingHorizontal: 10,
    backgroundColor: 'transparent',
  },
  // Day Selector Styles
  daySelectorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 8,
  },
  daySelectorText: {
    color: '#fff',
    fontWeight: 'bold',
    maxWidth: 100, // Prevents the text from pushing the icon too far
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  daySelectorModal: {
    backgroundColor: '#1f1f1f',
    borderRadius: 15,
    padding: 20,
    width: '90%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  daySelectorTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  daysContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 20,
  },
  dayButton: {
    backgroundColor: '#333',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 20,
  },
  dayButtonSelected: {
    backgroundColor: '#1cb0f6',
  },
  dayButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  daySelectorCloseButton: { padding: 10 },
  daySelectorCloseButtonText: { color: '#1cb0f6', fontSize: 16 },
  // Rest Time Modal
  restTimeOptionsContainer: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 20,
  },
  restTimeOptionButton: {
    backgroundColor: '#333',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 8,
  },
  restTimeOptionText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  customRestTimeButton: { backgroundColor: '#555' },
});
