import { FontAwesome, FontAwesome5 } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import DraggableFlatList, { RenderItemParams, } from 'react-native-draggable-flatlist';
import { GestureHandlerRootView, RectButton, Swipeable } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
// import AsyncStorage from '@react-native-async-storage/async-storage'; // Removed for pagination
import { VideoView as Video, useVideoPlayer } from 'expo-video';
import { DiaSemana, Treino } from '../../models/treino';
import { getExerciciosModelos } from '../../services/exercicioService';
import { addTreinoToFicha, getTreinoById, updateTreino } from '../../services/treinoService';
import { useAuth } from '../authprovider';

// NOTE: The Exercicio model needs to be updated to support per-set data. 
// The 'series: number', 'repeticoes: string', and 'peso: number' should be replaced with 'series: Serie[]'
import { DocumentSnapshot } from 'firebase/firestore'; // Import DocumentSnapshot
import Animated, { SlideInUp, SlideOutDown } from 'react-native-reanimated';
import { Exercicio, ExercicioModelo, Serie } from '../../models/exercicio';



// A interface Serie agora inclui um tipo para diferenciar séries normais de dropsets.
interface SerieEdit extends Serie {
  id: string;
  type: 'normal' | 'dropset';
  isBiSet?: boolean;
  showMenu?: boolean;
}

const DIAS_SEMANA: DiaSemana[] = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
// const EXERCICIOS_CACHE_KEY = 'exerciciosModelosCache'; // Removed for pagination

// A new component to manage each video player instance, now with WebP support
export function VideoListItem({ uri, style }: { uri: string; style: any }) {
  const isWebP = uri?.toLowerCase().endsWith('.webp');

  const player = useVideoPlayer(isWebP ? null : uri, (player) => {
    player.loop = true;
    player.muted = true;
    player.play();
  });

  // useEffect for player cleanup.
  useEffect(() => {
    // Cleanup the player when the component unmounts or the URI changes.
    return () => {
      // Only release the player if it was actually used (i.e., not a WebP image)
      if (!isWebP) {
        player.release();
      }
    };
  }, [uri, player, isWebP]);

  // If the URI points to a WebP image, render an Image component instead.
  if (isWebP) {
    // We need to import the Image component from 'react-native' for this to work.
    // Assuming the import is added at the top of the file.
    const { Image } = require('react-native');
    return <Image source={{ uri }} style={style} />;
  }

  return <Video style={style} player={player} nativeControls={false} contentFit="cover" />;
}

const LeftActions = ({ onPress }: { onPress: () => void }) => {
  return (
    <RectButton style={styles.editBox} onPress={onPress}>
      <FontAwesome name="pencil" size={24} color="white" />
    </RectButton>
  );
};

const RightActions = ({ onPress }: { onPress: () => void }) => {
  return (
    <RectButton style={styles.deleteBox} onPress={onPress}>
      <FontAwesome name="trash-o" size={24} color="white" />
    </RectButton>
  );
};

export default function EditarTreinoScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { fichaId, treinoId } = useLocalSearchParams();

  const [treino, setTreino] = useState<Partial<Treino>>({ nome: '', diasSemana: [], intervalo: { min: 1, seg: 0 }, exercicios: [] });
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // State for exercise models, now with pagination and caching
  const [exerciciosModelos, setExerciciosModelos] = useState<ExercicioModelo[]>([]);
  const [lastVisibleDoc, setLastVisibleDoc] = useState<DocumentSnapshot | null>(null); // For Firestore pagination
  const [loadingMoreExercicios, setLoadingMoreExercicios] = useState(false);
  const [allExerciciosLoaded, setAllExerciciosLoaded] = useState(false);
  const EXERCICIOS_PAGE_SIZE = 20; // Define page size

  const [isModalVisible, setModalVisible] = useState(false);
  const [isExercicioModalVisible, setExercicioModalVisible] = useState(false);
  const [selectedExercicioModelo, setSelectedExercicioModelo] = useState<ExercicioModelo | null>(null);
  const [editingExercicioIndex, setEditingExercicioIndex] = useState<number | null>(null);
  // New state to manage the list of sets for an exercise
  const [sets, setSets] = useState<SerieEdit[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [currentSearchInput, setCurrentSearchInput] = useState(''); // What the user types
  const [activeSearchTerm, setActiveSearchTerm] = useState('');     // What is actively being searched for
  // This useEffect now only loads the Treino being edited
  useEffect(() => {
    const fetchTreinoData = async () => {
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
    };
    fetchTreinoData();
  }, [treinoId]);

  // Effect to handle loading exercises when modal opens or search term changes
  useEffect(() => {
    if (isModalVisible) {
      // Reset pagination state if a new search term is active or if we need to load initially
      // This ensures that when a search term changes, we start from the first page of results
      // or when the modal opens for the first time, we load the initial page.
      setExerciciosModelos([]);
      setLastVisibleDoc(null);
      setAllExerciciosLoaded(false);
      loadMoreExercicios();
    }
  }, [activeSearchTerm, isModalVisible]); // Depend on activeSearchTerm and isModalVisible

  const loadMoreExercicios = useCallback(async () => {
    if (loadingMoreExercicios || allExerciciosLoaded) return;

    setLoadingMoreExercicios(true);
    try {
      const { exercicios: newExercicios, lastVisibleDoc: newLastVisibleDoc } = await getExerciciosModelos({
        lastVisibleDoc: lastVisibleDoc,
        limit: EXERCICIOS_PAGE_SIZE,
        searchTerm: activeSearchTerm // Pass the active search term to the service
      });

      if (newExercicios && newExercicios.length > 0) {
        setExerciciosModelos(prev => [...prev, ...newExercicios]);
        setLastVisibleDoc(newLastVisibleDoc);
      } else {
        setAllExerciciosLoaded(true); // No more exercises to load
      }
    } catch (error) {
      console.error("Erro ao carregar mais exercícios:", error);
      Alert.alert("Erro", "Não foi possível carregar mais exercícios.");
    } finally { // Dependencies for useCallback
      setLoadingMoreExercicios(false);
    }
  }, [loadingMoreExercicios, allExerciciosLoaded, lastVisibleDoc, activeSearchTerm]);

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
    setModalVisible(true);
    // The useEffect for activeSearchTerm and isModalVisible will handle the initial load
    setModalVisible(true);
  };

  const openExercicioModal = (modelo: ExercicioModelo) => {
    setModalVisible(false);
    setSelectedExercicioModelo(modelo);
    setEditingExercicioIndex(null); // Ensure we are in "add" mode
    // Reset search and pagination states when moving to add/edit exercise modal
    setCurrentSearchInput('');
    setActiveSearchTerm('');
    setSelectedGroup(null);
    setExerciciosModelos([]);
    setLastVisibleDoc(null);
    // Initialize with one default set when adding a new exercise
    setSets([{ id: `set-${Date.now()}`, repeticoes: '8-12', peso: 10, type: 'normal' }]);
    setExercicioModalVisible(true);
  };

const handleSaveExercicio = () => {
    if (!selectedExercicioModelo || sets.length === 0 || sets.some(s => !s.repeticoes)) {
      Alert.alert("Erro", "O exercício deve ter pelo menos uma série e todas as séries devem ter repetições definidas.");
      return;
    }

    const novoExercicio: Exercicio = {
      modelo: selectedExercicioModelo,
      modeloId: selectedExercicioModelo.id,
      series: sets.map((s, index) => ({
        id: s.id || `set-${Date.now()}-${index}`,
        repeticoes: s.repeticoes || '',
        peso: s.peso || 0,
        type: s.type || 'normal',
      })),
      // Mantém o estado 'isBiSet' se já existir no exercício que está sendo editado
      isBiSet: editingExercicioIndex !== null ? treino.exercicios?.[editingExercicioIndex]?.isBiSet : false,
    };

    // 1. Criar uma cópia mutável da lista de exercícios
    const updatedExercicios = [...(treino.exercicios || [])];

    if (editingExercicioIndex !== null) {
      // 2. Atualizar o exercício principal na cópia
      updatedExercicios[editingExercicioIndex] = novoExercicio;

      // 3. Verificar se este exercício é a primeira parte de um bi-set
      const nextExercicio = updatedExercicios[editingExercicioIndex + 1];
      if (nextExercicio && nextExercicio.isBiSet) {
        const targetSeriesCount = novoExercicio.series.length;
        let partnerSeries = [...nextExercicio.series];

        // Sincroniza (adiciona ou remove séries) para igualar a contagem
        while (partnerSeries.length < targetSeriesCount) {
          const lastSerie = partnerSeries.length > 0 ? partnerSeries[partnerSeries.length - 1] : { id: `set-sync-${Date.now()}`, repeticoes: '8-12', peso: 10, type: 'normal' as const };
          partnerSeries.push({ ...lastSerie, id: `set-sync-${Date.now()}-${partnerSeries.length}` });
        }
        if (partnerSeries.length > targetSeriesCount) {
          partnerSeries = partnerSeries.slice(0, targetSeriesCount);
        }

        // 4. Atualizar o exercício parceiro do bi-set na cópia
        updatedExercicios[editingExercicioIndex + 1] = { ...nextExercicio, series: partnerSeries };
      }
    } else {
      // Adicionando um novo exercício
      updatedExercicios.push(novoExercicio);
    }

    // 5. Atualizar o estado do treino UMA VEZ com a lista completamente modificada
    setTreino(prev => ({ ...prev, exercicios: updatedExercicios }));

    // Limpar e fechar o modal
    setExercicioModalVisible(false);
    setSelectedExercicioModelo(null);
    setEditingExercicioIndex(null);
    setSets([]);
  };

  
  const removeExercicio = (index: number) => {
    setTreino(prev => ({ ...prev, exercicios: prev.exercicios?.filter((_, i) => i !== index) }));
  };

  const openEditExercicioModal = (exercicio: Exercicio, index: number) => {
    setModalVisible(false); // Close selection modal if open
    // Reset search and pagination states when moving to add/edit exercise modal
    setCurrentSearchInput('');
    setActiveSearchTerm('');
    setSelectedGroup(null);
    setExerciciosModelos([]);
    setLastVisibleDoc(null);
    setAllExerciciosLoaded(false);

    setSelectedExercicioModelo(exercicio.modelo);
    // @ts-ignore - Assuming old and new structures might coexist during transition
    if (exercicio.series && typeof exercicio.series !== 'number') {
      // New structure
      setSets(exercicio.series.map(s => ({ ...s, id: s.id || `set-${Date.now()}`, type: s.type || 'normal' })));
    } else {
      // Old structure: convert to new structure for editing
      const numberOfSets = (exercicio as any).series || 1;
      const newSets = Array.from({ length: numberOfSets }, (_, i) => ({
        id: `set-${Date.now()}-${i}`,
        repeticoes: (exercicio as any).repeticoes || '8-12',
        peso: (exercicio as any).peso || 10,
        type: 'normal' as 'normal' | 'dropset',
      }));
      setSets(newSets);
    }
    setEditingExercicioIndex(index);
    setExercicioModalVisible(true);
  };

  const handleSetOption = (option: 'addDropset' | 'copy' | 'delete', index: number) => {
    const newSets = [...sets];
    // Fecha todos os outros menus
    newSets.forEach((set, i) => { if (i !== index) set.showMenu = false; });

    // Impede a exclusão de séries se for o segundo exercício de um bi-set
    if (option === 'delete' && editingExercicioIndex !== null && treino.exercicios?.[editingExercicioIndex]?.isBiSet) {
      Alert.alert("Ação não permitida", "Não é possível remover séries do segundo exercício de um bi-set. Altere o exercício principal.");
      return;
    }

    if (option === 'delete') {
      newSets.splice(index, 1);
    } else if (option === 'copy') {
      const originalSet = newSets[index];
      const newSet: SerieEdit = {
        ...originalSet,
        id: `set-${Date.now()}`,
        showMenu: false,
      };
      newSets.splice(index + 1, 0, newSet);
    } else if (option === 'addDropset') {
      const parentSet = newSets[index];
      const newDropset: SerieEdit = {
        id: `set-${Date.now()}`,
        repeticoes: parentSet.repeticoes,
        peso: (parentSet.peso || 10) * 0.7, // Sugestão de peso para o dropset
        type: 'dropset',
        showMenu: false,
      };
      newSets.splice(index + 1, 0, newDropset);
    }

    // Fecha o menu que foi clicado
    if (newSets[index]) {
      newSets[index].showMenu = false;
    }

    setSets(newSets);
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
          currentSeries.push({ ...lastSerie, id: `set-new-${Date.now()}-${i}` });
        }
      }
      currentExercicio.series = currentSeries;
    }
  
    updatedExercicios[index] = currentExercicio;
    setTreino(prev => ({ ...prev, exercicios: updatedExercicios }));
    require('expo-haptics').impactAsync(require('expo-haptics').ImpactFeedbackStyle.Medium);
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

  const filteredExercicios = useMemo(() => { // Filtered exercises now only filters by group, as search is handled by the backend
    return exerciciosModelos.filter(ex => selectedGroup ? ex.grupoMuscular === selectedGroup : true);
  }, [exerciciosModelos, selectedGroup]);

  const muscleGroups = useMemo(() => [...new Set(exerciciosModelos.map(e => e.grupoMuscular))], [exerciciosModelos]);

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
              <Animated.Text entering={require('react-native-reanimated').FadeInLeft.duration(400)} style={styles.biSetLabel}>
                Bi-set
              </Animated.Text>
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
                <Text style={styles.exercicioDetails}>
                  {totalSets(item)} séries
                  {item.series?.filter(s => s.type === 'dropset').length > 0 &&
                    ` + ${item.series.filter(s => s.type === 'dropset').length} dropsets`
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

        <Modal visible={isModalVisible} animationType="slide" onRequestClose={() => setModalVisible(false)} presentationStyle="pageSheet">
          <View style={styles.modalContainer}>
              <Text style={styles.modalTitle}>Selecionar Exercício</Text>
              <View style={styles.searchContainer}>
                  <TextInput
                      style={styles.searchInput}
                      placeholder="Buscar exercício..."
                      value={currentSearchInput}
                      onChangeText={setCurrentSearchInput}
                      placeholderTextColor="#888"
                      onSubmitEditing={() => setActiveSearchTerm(currentSearchInput)} // Trigger search on submit
                  />
                  {currentSearchInput.length > 0 && (
                      <TouchableOpacity
                          style={styles.clearSearchButton}
                          onPress={() => {
                              setCurrentSearchInput('');
                              setActiveSearchTerm('');
                          }}
                      >
                          <FontAwesome name="times-circle" size={20} color="#888" />
                      </TouchableOpacity>
                  )}
                  {currentSearchInput.length > 0 && (
                      <TouchableOpacity style={styles.searchIconButton} onPress={() => setActiveSearchTerm(currentSearchInput)}>
                          <FontAwesome name="search" size={20} color="#1cb0f6" />
                      </TouchableOpacity>
                  )}
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.groupSelector} contentContainerStyle={{ paddingRight: 15 }}>
                  <TouchableOpacity style={[styles.groupButton, !selectedGroup && styles.groupSelected]} onPress={() => setSelectedGroup(null)}>
                      <Text style={styles.groupText}>Todos</Text>
                  </TouchableOpacity>
                  {muscleGroups.map((group: string | null) => group && (
                      <TouchableOpacity key={group} style={[styles.groupButton, selectedGroup === group && styles.groupSelected]} onPress={() => setSelectedGroup(group)}>
                          <Text style={styles.groupText}>{group}</Text>
                      </TouchableOpacity>
                  ))}
              </ScrollView>

              <FlatList
                  data={filteredExercicios}
                  keyExtractor={item => item.id}
                  onEndReached={loadMoreExercicios} // Call loadMoreExercicios when scrolling to end
                  onEndReachedThreshold={0.5} // Adjust as needed
                  ListFooterComponent={loadingMoreExercicios ? <ActivityIndicator style={{ marginVertical: 20 }} color="#fff" /> : null}
                  renderItem={({ item }) => {
                    // ALTERAÇÃO: A URL agora vem diretamente do campo 'imagemUrl' do modelo.
                    const videoUri = item.imagemUrl;
                    
                    // Opcional: manter o log para depuração
                    console.log("URL do vídeo do modelo:", videoUri); 
                    
                    return (
                        <TouchableOpacity style={styles.modeloCard} onPress={() => openExercicioModal(item)}>
                            {/* O componente VideoListItem recebe a nova URI sem precisar de outras mudanças */}
                            <VideoListItem style={styles.modeloVideo} uri={videoUri} />
                            <Text style={styles.modeloName} numberOfLines={2}>{item.nome}</Text>
                        </TouchableOpacity>
                    );
                  }}
                  ListEmptyComponent={
                    loadingMoreExercicios ? // Use loadingMoreExercicios for initial and subsequent loads
                    <ActivityIndicator style={{ marginTop: 40 }} size="large" color="#fff" /> :
                    <Text style={styles.emptyListText}>Nenhum exercício encontrado.</Text>
                  }
              />

              <TouchableOpacity style={styles.closeButton} onPress={() => {
                  setModalVisible(false);
                  // Reset search and pagination states when modal closes
                  setCurrentSearchInput('');
                  setActiveSearchTerm('');
                  setSelectedGroup(null);
                  setExerciciosModelos([]);
                  setLastVisibleDoc(null);
                  setAllExerciciosLoaded(false);
              }}>
                  <Text style={styles.closeButtonText}>Fechar</Text>
              </TouchableOpacity>
          </View>
        </Modal>
        <Modal
          animationType="slide"
          presentationStyle="pageSheet"
          visible={isExercicioModalVisible} // Use the correct state variable
          onRequestClose={() => setExercicioModalVisible(false)}
        >
          <SafeAreaView style={styles.modalSafeArea}>
                    <View style={styles.modalHeader}>
                      <Text style={styles.modalHeaderText}>Editando exercício</Text>
                      <TouchableOpacity onPress={() => {
                          setExercicioModalVisible(false);
                          setSelectedExercicioModelo(null);
                          setEditingExercicioIndex(null);
                          setSets([]);
                      }}><FontAwesome name="chevron-down" size={22} color="#fff" /></TouchableOpacity>
                    </View>
                    <DraggableFlatList
                      data={sets}
                      style={{ width: '100%' }}
                      contentContainerStyle={styles.modalScrollViewContent}
                      keyExtractor={(item) => item.id!}
                      onDragEnd={({ data }) => setSets(data)}
                      renderItem={({ item, drag, isActive, getIndex }) => {
                        const itemIndex = getIndex();
                        if (itemIndex === undefined) return null;

                        // Contagem de séries normais para exibição
                        const normalSeriesCount = sets.slice(0, itemIndex + 1).filter(s => s.type === 'normal').length;

                        return (
                          <View style={{ marginLeft: item.type === 'dropset' ? 30 : 0, marginBottom: 10 }}>
                            <View style={[styles.setRow, { backgroundColor: isActive ? '#3a3a3a' : '#1f1f1f'}]}>
                              <TouchableOpacity onLongPress={drag} style={{ paddingHorizontal: 10 }} disabled={isActive}>
                                 <FontAwesome5 name={item.type === 'normal' ? "dumbbell" : "arrow-down"} size={16} color="#888" /> 
                              </TouchableOpacity>
                              <Text style={styles.setText}>{item.type === 'normal' ? `Série ${normalSeriesCount}` : 'Dropset'}</Text>
                              <TextInput
                                style={styles.setInput}
                                placeholder="Reps"
                                placeholderTextColor="#888"
                                value={item.repeticoes}
                                onChangeText={(text) => {
                                  const newSets = [...sets];
                                  newSets[itemIndex].repeticoes = text;
                                  setSets(newSets);
                                }}
                              />
                              <TextInput
                                style={styles.setInput}
                                placeholder="kg"
                                placeholderTextColor="#888"
                                keyboardType="numeric"
                                value={String(item.peso || '')}
                                onChangeText={(text) => {
                                  const newSets = [...sets];
                                  newSets[itemIndex].peso = parseFloat(text) || 0;
                                  setSets(newSets);
                                }}
                              />
                              <TouchableOpacity style={{ padding: 10 }} onPress={() => {
                                const newSets = [...sets];
                                newSets.forEach((s, i) => s.showMenu = i === itemIndex ? !s.showMenu : false);
                                setSets(newSets);
                              }}>
                                  <FontAwesome name="ellipsis-v" size={20} color="#ccc" />
                              </TouchableOpacity>
                            </View>
                            {item.showMenu && (
                              <Animated.View entering={SlideInUp.duration(200)} exiting={SlideOutDown.duration(200)}>
                                <View style={styles.setMenu}>
                                  {item.type === 'normal' && (
                                    <TouchableOpacity style={styles.setMenuButton} onPress={() => handleSetOption('addDropset', itemIndex)}>
                                      <Text style={styles.setMenuText}>Adicionar Dropset</Text>
                                    </TouchableOpacity>
                                  )}
                                  <TouchableOpacity style={styles.setMenuButton} onPress={() => handleSetOption('copy', itemIndex)}>
                                    <Text style={styles.setMenuText}>Copiar Série</Text>
                                  </TouchableOpacity>
                                  <TouchableOpacity style={[styles.setMenuButton, { borderBottomWidth: 0 }]} onPress={() => handleSetOption('delete', itemIndex)}>
                                    <Text style={[styles.setMenuText, { color: '#ff3b30' }]}>Deletar</Text>
                                  </TouchableOpacity>
                                </View>
                              </Animated.View>
                            )}
                          </View>
                        )
                      }}
                      ListHeaderComponent={
                        <>
                          <View style={styles.exerciseInfoCard}>
                            {selectedExercicioModelo?.imagemUrl && (
                                <VideoListItem
                                    uri={selectedExercicioModelo.imagemUrl}
                                    style={styles.addExercicioModalVideo}
                                />
                            )}
                            <View style={{ flex: 1, marginLeft: 15 }}>
                              <Text style={styles.modalExerciseName}>{selectedExercicioModelo?.nome}</Text>
                              <Text style={styles.modalMuscleGroup}>{selectedExercicioModelo?.grupoMuscular}</Text>
                            </View>
                          </View>
                        </>
                      }
                      ListFooterComponent={
                        <>
                          {/* Oculta o botão de adicionar série se for o segundo exercício de um bi-set */}
                          {!(editingExercicioIndex !== null && treino.exercicios?.[editingExercicioIndex]?.isBiSet) && (
                            <TouchableOpacity style={styles.addSetButton} onPress={() => setSets([...sets, { id: `set-${Date.now()}`, repeticoes: '8-12', peso: 10, type: 'normal' }])}>
                              <Text style={styles.addSetButtonText}>+ Adicionar Série</Text>
                            </TouchableOpacity>
                          )}

                          <View style={styles.modalButtons}>
                              <TouchableOpacity style={[styles.button, styles.buttonClose]} onPress={() => {
                                  setExercicioModalVisible(false);
                                  setSelectedExercicioModelo(null);
                                  setEditingExercicioIndex(null);
                                  setSets([]);
                                  // Se estiver adicionando um novo exercício (não editando), reabra o modal de seleção.
                                  if (editingExercicioIndex === null) {
                                      setModalVisible(true);
                                  }
                              }}>
                                  <Text style={[styles.textStyle, {color: '#ff3b30'}]}>Cancelar</Text>
                              </TouchableOpacity>
                              <TouchableOpacity style={[styles.button, styles.buttonAdd]} onPress={handleSaveExercicio}>
                                  <Text style={styles.textStyle}>{editingExercicioIndex !== null ? 'Salvar' : 'Adicionar'}</Text>
                              </TouchableOpacity>
                          </View>
                        </>
                      }
                    />
          </SafeAreaView>
        </Modal>
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
  modalContainer: {
    flex: 1,
    backgroundColor: '#0d181c',
    paddingTop: 50,
    paddingHorizontal: 15,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
    textAlign: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    backgroundColor: '#222',
    borderRadius: 8,
    paddingRight: 10, // Space for icons
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    padding: 12, // Padding inside the text input
    fontSize: 16,
  },
  clearSearchButton: {
    padding: 5,
    marginRight: 5,
  },
  searchIconButton: {
    padding: 5,
  },
  groupSelector: { marginBottom: 15 },
  groupButton: { height: 40, paddingHorizontal: 16, backgroundColor: '#222', borderRadius: 20, marginRight: 10, justifyContent: 'center', paddingBottom: 2 },
  groupSelected: { backgroundColor: '#1cb0f6' },
  groupText: { color: '#fff', fontWeight: '500', textAlign: 'center' },
  modeloCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#222', padding: 10, borderRadius: 8, marginBottom: 10 },
  modeloVideo: { width: 50, height: 50, borderRadius: 5, marginRight: 15, backgroundColor: '#333' },
  modeloName: { color: '#fff', fontSize: 16, flex: 1, flexWrap: 'wrap' },
  emptyListText: { color: '#aaa', textAlign: 'center', marginTop: 40 },
  closeButton: { backgroundColor: '#ff3b30', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 15, marginBottom: 20 },
  closeButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

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
  setText: {
    color: '#fff',
    fontWeight: 'bold',
    flex: 1,
  },
  setInput: {
    backgroundColor: '#2c2c2e',
    flex: 1,
    color: '#fff',
    padding: 8,
    borderRadius: 5,
    textAlign: 'center',
    marginHorizontal: 5,
  },
  addSetButton: { padding: 10, marginTop: 10, backgroundColor: '#2c2c2e', borderRadius: 8, width: '100%', alignItems: 'center', flexGrow: 1 },
  addSetButtonText: { color: '#1cb0f6', fontWeight: 'bold' },
  setMenu: {
    backgroundColor: '#2c2c2e',
    borderRadius: 8,
    marginTop: -5,
    marginBottom: 5,
    zIndex: -1,
    paddingTop: 5,
  },
  setMenuButton: {
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#444',
  },
  setMenuText: {
    color: '#fff',
    fontSize: 14,
  },
});