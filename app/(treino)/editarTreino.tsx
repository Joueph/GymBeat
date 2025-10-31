import { FontAwesome } from '@expo/vector-icons';
import { ResizeMode, Video } from 'expo-av'; // Changed from expo-video
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics'; // ADICIONADO Haptics
import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'; // ADICIONADO Image
import DraggableFlatList, { RenderItemParams, } from 'react-native-draggable-flatlist';
import { GestureHandlerRootView, RectButton, Swipeable } from 'react-native-gesture-handler';
import Animated, { FadeInLeft } from 'react-native-reanimated'; // ADICIONADO FadeInLeft
import { SafeAreaView } from 'react-native-safe-area-context';
import { Exercicio, ExercicioModelo, Serie } from '../../models/exercicio';
import { DiaSemana, Treino } from '../../models/treino';
import { addTreinoToFicha, deleteTreino, getTreinoById, updateTreino } from '../../services/treinoService';
import { useAuth } from '../authprovider';
import { EditarExercicioNoTreinoModal } from './modals/editarExercícioNoTreinoModal';
import { SelectExerciseModal } from './modals/SelectExerciseModal';


// A interface Serie agora inclui um tipo para diferenciar séries normais de dropsets.
interface SerieEdit extends Serie {
  id: string;
  type: 'normal' | 'dropset';
  isBiSet?: boolean;
  isTimeBased?: boolean;
  showMenu?: boolean;
}

const DIAS_SEMANA: DiaSemana[] = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
// const EXERCICIOS_CACHE_KEY = 'exerciciosModelosCache'; // Removed for pagination

export function VideoListItem({ uri, style }: { uri: string; style: any }) {
  const [localUri, setLocalUri] = useState<string | null>(null);
  const isWebP = uri?.toLowerCase().includes('.webp');

  useEffect(() => {
    const manageMedia = async () => {
      if (!uri) return;
      const fileName = uri.split('/').pop()?.split('?')[0]; // Ensure filename is clean
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
          setLocalUri(uri); // Fallback para a URL remota em caso de erro
        }
      }
    };

    manageMedia();
  }, [uri]);

  if (!localUri) {
    return <View style={[style, { backgroundColor: '#333', justifyContent: 'center', alignItems: 'center' }]}><ActivityIndicator color="#fff" /></View>;
  }

  if (isWebP) {
    return <Image source={{ uri: localUri }} style={style} />;
  }

  return (
    <Video
      source={{ uri: localUri }}
      isMuted={true}
      isLooping={true}
      shouldPlay={true}
      resizeMode={ResizeMode.COVER}
      style={style}
    />
  );
}

const LeftActions = ({ onPress }: { onPress: () => void }) => {
  // CORREÇÃO: O componente precisa retornar um elemento JSX.
  // Adicionado um RectButton para a ação de editar, similar ao RightActions.
  return (
    <RectButton style={styles.editBox} onPress={onPress}>
      <FontAwesome name="pencil" size={24} color="white" />
    </RectButton>
  );
};

// CORREÇÃO: Removida a declaração duplicada de 'RightActions'
const RightActions = ({ onPress }: { onPress: () => void }) => {
  return (
    <RectButton style={styles.deleteBox} onPress={onPress}>
      <FontAwesome name="trash" size={24} color="white" />
    </RectButton>
  );
};


export default function EditarTreinoScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { user } = useAuth();
  const { fichaId, treinoId } = useLocalSearchParams();

  const [treino, setTreino] = useState<Partial<Treino>>({ nome: '', diasSemana: [], intervalo: { min: 1, seg: 0 }, exercicios: [] });
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [isSelectExerciseModalVisible, setSelectExerciseModalVisible] = useState(false);
  const [isExercicioModalVisible, setExercicioModalVisible] = useState(false);
  const [exercicioSendoEditado, setExercicioSendoEditado] = useState<Exercicio | null>(null);
  const [editingExercicioIndex, setEditingExercicioIndex] = useState<number | null>(null);

  const fetchTreinoData = useCallback(async () => {
    if (!treinoId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const treinoData = await getTreinoById(treinoId as string);
      if (treinoData) {
        setTreino(treinoData);
      }
    } catch (error) {
      Alert.alert("Erro", "Não foi possível carregar os dados do treino.");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [treinoId]);

  useFocusEffect(
    useCallback(() => {
      fetchTreinoData();
        }
    , [fetchTreinoData])
  );

  const handleDelete = async () => {
    if (!treinoId || typeof treinoId !== 'string' || !fichaId || typeof fichaId !== 'string') return;

    Alert.alert(
      "Apagar Treino",
      "Você tem certeza que deseja apagar este treino? Esta ação não pode ser desfeita.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Apagar",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteTreino(treinoId, fichaId);
              Alert.alert("Sucesso", "Treino apagado.");
              router.back();
            } catch (error) { Alert.alert("Erro", "Não foi possível apagar o treino."); }
          },
        },
      ]
    );
  };
  const handleSave = async () => {
    if (!user || !fichaId || !treino.nome) {
      Alert.alert("Erro", "O nome do treino é obrigatório.");
      return;
    }
    setIsSaving(true);
    try {
      const treinoData = {
        nome: treino.nome,
        diasSemana: treino.diasSemana || [],
        intervalo: treino.intervalo || { min: 1, seg: 0 },
        exercicios: treino.exercicios || [],
      };

      if (treinoId) {
        await updateTreino(treinoId as string, treinoData);
      } else {
        const newTreinoId = await addTreinoToFicha(fichaId as string, treinoData, user.uid);
        // The new ID is not used here, but this fixes the potential type error if we were to set it to state.
      }
      Alert.alert("Sucesso", "Treino salvo com sucesso!");
      router.back();
    } catch (error) {
      Alert.alert("Erro", "Não foi possível salvar o treino.");
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  useLayoutEffect(() => {
    // Só mostra o botão de apagar se estiver editando um treino existente
    if (treinoId) {
      navigation.setOptions({
        headerRight: () => (
          <TouchableOpacity onPress={handleDelete} style={{ marginRight: 15 }}><FontAwesome name="trash" size={24} color="#ff3b30" /></TouchableOpacity>
        ),
      });
    }
  }, [navigation, treinoId, handleDelete]);
  const toggleDiaSemana = (dia: DiaSemana) => {
    const currentDias = treino.diasSemana || [];
    const newDias = currentDias.includes(dia)
      ? currentDias.filter(d => d !== dia)
      : [...currentDias, dia];
    setTreino(prev => ({ ...prev, diasSemana: newDias }));
  };

  const handleIntervalChange = (unit: 'min' | 'seg', value: string) => {
    const numValue = value === '' ? 0 : parseInt(value.replace(/[^0-9]/g, ''), 10);
    if (isNaN(numValue) || numValue < 0) return; // Ensure non-negative numbers

    setTreino(prev => ({
        ...prev,
        intervalo: {
            min: prev?.intervalo?.min ?? 1, // Default to 1 if undefined
            seg: prev?.intervalo?.seg ?? 0,
            [unit]: numValue
        }
    }));
  };

  const openAddExercicioModal = () => {
    setSelectExerciseModalVisible(true);
    // The useEffect for activeSearchTerm and isModalVisible will handle the initial load
    setSelectExerciseModalVisible(true);
  };

  const openExercicioModal = (modelo: ExercicioModelo) => {
    setSelectExerciseModalVisible(false);
    const newExercise: Exercicio = {
      modelo: modelo,
      modeloId: modelo.id,
      series: [{ id: `set-${Date.now()}`, repeticoes: '8-12', peso: 10, type: 'normal', isTimeBased: false }],
      isBiSet: false,
    };
    setExercicioSendoEditado(newExercise);
    setEditingExercicioIndex(null); // Ensure we are in "add" mode
    setExercicioModalVisible(true);
  };

const handleSaveExercicio = (newSeries: SerieEdit[], pesoBarra?: number) => {
    if (!exercicioSendoEditado || newSeries.length === 0 || newSeries.some(s => !s.repeticoes)) {
      Alert.alert("Erro", "O exercício deve ter pelo menos uma série e todas as séries devem ter repetições definidas.");
      return;
    }

    const updatedExercise: Exercicio = {
      ...exercicioSendoEditado,
      series: newSeries,
      pesoBarra: pesoBarra,
    };

    const updatedExercicios = [...(treino.exercicios || [])];

    if (editingExercicioIndex !== null) {
      updatedExercicios[editingExercicioIndex] = updatedExercise;

      const nextExercicio = updatedExercicios[editingExercicioIndex + 1];
      const isLeaderOfBiSet = !updatedExercise.isBiSet && nextExercicio?.isBiSet;

      if (isLeaderOfBiSet) {
        const targetSeriesCount = updatedExercise.series.length;
        let partnerSeries = [...nextExercicio.series];

        while (partnerSeries.length < targetSeriesCount) {
          const lastSerie = partnerSeries.length > 0 ? partnerSeries[partnerSeries.length - 1] : { id: `set-sync-${Date.now()}`, repeticoes: '8-12', peso: 10, type: 'normal' as const };
          partnerSeries.push({ ...lastSerie, id: `set-sync-${Date.now()}-${partnerSeries.length}`, isTimeBased: lastSerie.isTimeBased });
        }
        if (partnerSeries.length > targetSeriesCount) {
          partnerSeries = partnerSeries.slice(0, targetSeriesCount);
        }
        updatedExercicios[editingExercicioIndex + 1] = { ...nextExercicio, series: partnerSeries };
      }
    } else {
      updatedExercicios.push(updatedExercise);
    }

    setTreino(prev => ({ ...prev, exercicios: updatedExercicios }));

    setExercicioModalVisible(false);
    setExercicioSendoEditado(null);
    setEditingExercicioIndex(null);
  };
  
  const removeExercicio = (index: number) => {
    setTreino(prev => ({ ...prev, exercicios: prev.exercicios?.filter((_, i) => i !== index) }));
  };

  const openEditExercicioModal = (exercicio: Exercicio, index: number) => {
    setSelectExerciseModalVisible(false); // Close selection modal if open
    setExercicioSendoEditado(exercicio);
    setEditingExercicioIndex(index);
    setExercicioModalVisible(true);
  };

  const handleToggleBiSet = (index: number) => {
    if (index === 0) return; // Não pode ser bi-set com um exercício inexistente
  
    const updatedExercicios = [...(treino.exercicios || [])];
    const currentExercicio = { ...updatedExercicios[index] }; // Exercício que está sendo marcado como bi-set
    const previousExercicio = updatedExercicios[index - 1]; // Exercício principal do bi-set
  
    // Alterna o estado do bi-set
    currentExercicio.isBiSet = !currentExercicio.isBiSet;
  
    // Se o exercício foi MARCADO como bi-set, sincroniza as séries
    if (currentExercicio.isBiSet && previousExercicio) {
      const targetSeriesCount = previousExercicio.series.length;
      let currentSeries = [...currentExercicio.series];
  
      if (currentSeries.length > targetSeriesCount) {
        // Se tem mais séries, corta as excedentes
        currentSeries = currentSeries.slice(0, targetSeriesCount);
      } else if (currentSeries.length < targetSeriesCount) {
        // Se tem menos séries, adiciona as que faltam
        const seriesToAdd = targetSeriesCount - currentSeries.length;
        const lastSerie = currentSeries.length > 0 
          ? currentSeries[currentSeries.length - 1] 
          : { id: `set-new-${Date.now()}`, repeticoes: '8-12', peso: 10, type: 'normal' as const };
        
        for (let i = 0; i < seriesToAdd; i++) {
          currentSeries.push({ ...lastSerie, id: `set-new-${Date.now()}-${i}`, isTimeBased: lastSerie.isTimeBased });
        }
      }
      currentExercicio.series = currentSeries;
    }
  
    updatedExercicios[index] = currentExercicio;
    setTreino(prev => ({ ...prev, exercicios: updatedExercicios }));
    // CORRIGIDO: Usa a importação de Haptics
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const totalSets = useMemo(() => {
    return (item: Exercicio) => {
      if (Array.isArray(item.series)) {
        // New structure: count only 'normal' series for the main display
        return item.series.filter(s => (s.type || 'normal') === 'normal').length;
      }
      // Old structure or fallback
      return (item as any).series || 0;
    };
  }, []);

  if (loading) {
    return <ActivityIndicator style={styles.container} size="large" color="#fff" />;
  }

  const renderExercicioItem = ({ item, drag, isActive, getIndex }: RenderItemParams<Exercicio>) => {
    const index = getIndex();
    if (index === undefined) return null;

    const isPartOfBiSet = item.isBiSet;
    const isPreviousBiSet = index > 0 && treino.exercicios?.[index - 1]?.isBiSet;

    return (
      <View>
        {index > 0 && (
          <TouchableOpacity
            style={[styles.biSetLinker, isPreviousBiSet && { opacity: 0.5 }]}
            onPress={() => handleToggleBiSet(index)}
            disabled={isPreviousBiSet}
          >
            <FontAwesome name="link" size={20} color={isPartOfBiSet ? '#1cb0f6' : '#666'} />
            {isPartOfBiSet && (
              // CORRIGIDO: Usa a importação de FadeInLeft
              <Animated.View entering={FadeInLeft.duration(400)}>
                <Text style={styles.biSetLabel}>Bi-set</Text>
              </Animated.View>
            )}
          </TouchableOpacity>
        )}
        <Swipeable
          renderLeftActions={() => <LeftActions onPress={() => openEditExercicioModal(item, index)} />}
          renderRightActions={() => <RightActions onPress={() => removeExercicio(index)} />}
          overshootRight={false}
          overshootLeft={false}
        >
          <TouchableOpacity
            onLongPress={drag}
            disabled={isActive}
            style={[styles.exercicioCard, { backgroundColor: isActive ? '#3a3a3a' : '#222' }]}
          >
            <View style={{flex: 1}}>
                <Text style={styles.exercicioName}>{item.modelo.nome}</Text>
                <Text style={styles.exercicioDetails} numberOfLines={1}>
                  {totalSets(item)}x{' '}
                  {item.series[0]?.isTimeBased 
                    ? `${item.series[0]?.repeticoes}s` 
                    : `${item.series[0]?.repeticoes} reps`
                  }
                  {item.series.filter(s => s.type === 'dropset').length > 0 &&
                    ` + ${item.series.filter(s => s.type === 'dropset').length} drop`
                  }
                </Text>
            </View>
            {/* Oculta o ícone de reordenação se for o último item de um bi-set */}
            <TouchableOpacity disabled={isPartOfBiSet}>
              <FontAwesome 
                name="bars" 
                size={20} 
                color="#666" 
                style={{ marginLeft: 15, opacity: isPartOfBiSet ? 0.5 : 1 }} />
            </TouchableOpacity>
          </TouchableOpacity>
        </Swipeable>
      </View>
    );
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#030405' }}>
        <DraggableFlatList
          containerStyle={{ flex: 1 }}
          contentContainerStyle={{ padding: 15, paddingBottom: 100 }}
          data={treino.exercicios || []} // Adicionado o tipo aqui
          renderItem={renderExercicioItem}
          keyExtractor={(item, index) => `exercicio-${index}`}
          onDragEnd={({ data }) => setTreino(prev => ({ ...prev, exercicios: data }))}
          ListHeaderComponent={
            <>
              <TextInput style={styles.input} value={treino.nome} onChangeText={text => setTreino(p => ({ ...p, nome: text }))} placeholder="Nome do Treino (Ex: Treino A - Peito e Tríceps)" placeholderTextColor="#888" />

              <Text style={styles.label}>Dias da Semana</Text>
              <View style={styles.diasContainer}>
                {DIAS_SEMANA.map(dia => (
                  <TouchableOpacity key={dia} style={[styles.diaButton, treino.diasSemana?.includes(dia) && styles.diaSelected]} onPress={() => toggleDiaSemana(dia)}>
                    <Text style={styles.diaText}>{dia.charAt(0).toUpperCase() + dia.slice(1)}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Intervalo de Descanso</Text>
              <View style={styles.intervaloContainer}>
                  <TextInput style={styles.intervaloInput} value={String(treino.intervalo?.min ?? 1)} onChangeText={text => handleIntervalChange('min', text)} keyboardType="number-pad" maxLength={2} />
                  <Text style={styles.intervaloLabel}>min</Text>
                  <TextInput style={styles.intervaloInput} value={String(treino.intervalo?.seg ?? 0)} onChangeText={text => handleIntervalChange('seg', text)} keyboardType="number-pad" maxLength={2} />
                  <Text style={styles.intervaloLabel}>seg</Text>
              </View>

              <Text style={styles.sectionTitle}>Exercícios</Text>
            </>
          }
          ListFooterComponent={
            <>
              <TouchableOpacity style={styles.addButton} onPress={openAddExercicioModal}>
                <Text style={styles.addButtonText}>+ Adicionar Exercício</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={isSaving}>
                {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Salvar Treino</Text>}
              </TouchableOpacity>
            </>
          }
        />

        <SelectExerciseModal
          visible={isSelectExerciseModalVisible}
          onClose={() => setSelectExerciseModalVisible(false)}
          onSelect={openExercicioModal}
        />

        <EditarExercicioNoTreinoModal
          visible={isExercicioModalVisible}
          onClose={() => {
            setExercicioModalVisible(false);
            setExercicioSendoEditado(null);
            setEditingExercicioIndex(null);
          }}
          exercise={exercicioSendoEditado}
          onSave={handleSaveExercicio}
        />
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}
const styles = StyleSheet.create({
  container: { padding: 15, backgroundColor: '#030405',},
  title: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  label: { fontSize: 16, color: '#ccc', marginBottom: 10, marginTop: 10 },
  input: { backgroundColor: '#222', color: '#fff', padding: 15, borderRadius: 8, fontSize: 16, marginBottom: 20 },
  diasContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  diaButton: { paddingVertical: 10, paddingHorizontal: 12, backgroundColor: '#222', borderRadius: 8 , flexGrow: 1, alignItems: 'center', marginHorizontal: 2},
  diaSelected: { backgroundColor: '#1cb0f6' },
  diaText: { color: '#fff', fontWeight: 'bold' },
  intervaloContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  intervaloInput: {
    backgroundColor: '#222',
    color: '#fff',
    padding: 15,
    borderRadius: 8,
    fontSize: 16,
    width: 60,
    textAlign: 'center',
  },
  intervaloLabel: {
    color: '#ccc',
    fontSize: 16,
    marginHorizontal: 10,
  },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff', marginTop: 10, marginBottom: 10 },
  exercicioCard: {
    backgroundColor: '#141414',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#ffffff1a',
  },
  biSetLinker: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 10,
    paddingLeft: 15, // Alinha com o conteúdo do card
  },
  biSetLabel: {
    color: '#1cb0f6',
    fontWeight: 'bold',
    fontSize: 14,
  },
  exercicioName: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  exercicioDetails: { color: '#aaa', fontSize: 14, marginTop: 4 },
  addButton: {
    borderWidth: 1,
    borderColor: '#ffffffee',
    borderStyle: 'dashed',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
    backgroundColor: '#121212',
  },
  addButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  saveButton: { backgroundColor: '#1cb0f6', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 30, marginBottom: 50 },
  saveButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  deleteBox: {
    backgroundColor: '#ff3b30',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    borderRadius: 8,
  },
  
  editBox: {
    backgroundColor: '#1cb0f6',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    borderRadius: 8,
  },

  // Modal Styles

  // Add Exercicio Modal
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#ffffff1a',
  },
  modalHeaderText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  exerciseInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalSafeArea: {
    flex: 1,
    backgroundColor: '#141414',
  },
  bottomSheetContainer: {
    flex: 1,
    justifyContent: "flex-end", // Alinha o modal na parte de baixo
    alignItems: "center",
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalScrollViewContent: {
    padding: 20,
    paddingBottom: 40, // Espaço extra no final do scroll
  },
  addExercicioModalView: {
    margin: 0,
    backgroundColor: "#141414",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    width: '100%',
    height: '100%', // Ocupa a altura total
  },
  addExercicioModalVideo: {
    width: 100,
    height: 100,
    borderRadius: 10,
    marginBottom: 15,
    backgroundColor: '#333',
  },
  modalText: {
    textAlign: "center",
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold'
  },
  modalExerciseName: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalMuscleGroup: {
    color: '#ccc',
    fontSize: 16,
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
    flexDirection: 'column-reverse', // Empilha os botões, com o principal (Salvar) embaixo
    justifyContent: 'flex-start',
    width: '100%',
    marginTop: 20,
  },
  button: {
    borderRadius: 10,
    padding: 10,
    elevation: 2,
    flex: 1,
    marginHorizontal: 5,
    marginVertical: 5, // Adiciona espaçamento vertical entre os botões
  },
  buttonClose: {
    backgroundColor: "transparent",
  },
  buttonAdd: {
    backgroundColor: "#1cb0f6",
  },
  textStyle: {
    color: "white",
    fontWeight: "bold",
    textAlign: "center"
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 5,
    borderRadius: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2f2f2f',
    height: 65,
  },

});