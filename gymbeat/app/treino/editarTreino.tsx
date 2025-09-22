import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Modal, FlatList, Animated, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';
import { GestureHandlerRootView, Swipeable, RectButton } from 'react-native-gesture-handler';
import DraggableFlatList, { RenderItemParams } from 'react-native-draggable-flatlist';
// import AsyncStorage from '@react-native-async-storage/async-storage'; // Removed for pagination
import { useAuth } from '../authprovider';
import { getTreinoById, addTreinoToFicha, updateTreino } from '../../services/treinoService';
import { getExerciciosModelos } from '../../services/exercicioService';
import { VideoView as Video, useVideoPlayer } from 'expo-video';
import { Treino, DiaSemana } from '../../models/treino';

// NOTE: The Exercicio model needs to be updated to support per-set data.
// The 'series: number', 'repeticoes: string', and 'peso: number' should be replaced with 'series: Serie[]'
import { Exercicio, ExercicioModelo, Serie } from '../../models/exercicio'; // Keep this line as is
import { DocumentSnapshot } from 'firebase/firestore'; // Import DocumentSnapshot

// This interface should be in your `models/exercicio.ts` file
// export interface Serie {
//   id: string; // Unique ID for keys in draggable list
//   repeticoes: string;
//   peso?: number;
// }

const DIAS_SEMANA: DiaSemana[] = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
// const EXERCICIOS_CACHE_KEY = 'exerciciosModelosCache'; // Removed for pagination

// A new component to manage each video player instance
export function VideoListItem({ uri, style }: { uri: string; style: any }) {
  const player = useVideoPlayer(uri, (player) => {
    player.loop = true;
    player.muted = true;
    player.play();
  });

  // useEffect para verificar o status da URL do vídeo
  useEffect(() => {
    const verificarStatusDoVideo = async () => {
      if (!uri) return;

      console.log(`[LOG] Verificando URL: ${uri}`);

      try {
        // >>>>> AQUI É FEITO O FETCH <<<<<
        const response = await fetch(uri, { method: 'HEAD' }); 

        console.log(`[LOG] Resposta do Servidor - Status: ${response.status}`);
        // ... resto do código de log ...
        
      } catch (error) {
        console.error('[DIAGNÓSTICO] ❌ Erro de Rede: ...', error);
      }
    };

    verificarStatusDoVideo();

    // Cleanup do player
    return () => {
      player.release();
    };
  }, [uri, player]); // Adicionamos 'uri' à lista de dependências

  return <Video style={style} player={player} nativeControls={false} contentFit="cover" />;
}
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
  const [sets, setSets] = useState<Partial<Serie>[]>([]);
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
        await addTreinoToFicha(fichaId as string, treinoData, user.uid);
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
    const numValue = parseInt(value.replace(/[^0-9]/g, ''), 10);
    if (isNaN(numValue)) return;

    setTreino(prev => ({
        ...prev,
        intervalo: {
            min: prev?.intervalo?.min ?? 1,
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
    setSets([{ id: `set-${Date.now()}`, repeticoes: '8-12', peso: 10 }]);
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
      })),
    };

    if (editingExercicioIndex !== null) {
      // Editing existing exercise
      const updatedExercicios = [...(treino.exercicios || [])];
      updatedExercicios[editingExercicioIndex] = novoExercicio;
      setTreino(prev => ({ ...prev, exercicios: updatedExercicios }));
    } else {
      // Adding new exercise
      setTreino(prev => ({ ...prev, exercicios: [...(prev.exercicios || []), novoExercicio] }));
    }

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
      setSets(exercicio.series);
    } else {
      // Old structure: convert to new structure for editing
      const numberOfSets = (exercicio as any).series || 1;
      const newSets = Array.from({ length: numberOfSets }, (_, i) => ({
        id: `set-${Date.now()}-${i}`,
        repeticoes: (exercicio as any).repeticoes || '8-12',
        peso: (exercicio as any).peso || 0,
      }));
      setSets(newSets);
    }
    setEditingExercicioIndex(index);
    setExercicioModalVisible(true);
  };

  const totalSets = useMemo(() => {
    // @ts-ignore
    return (item: Exercicio) => (item.series && typeof item.series !== 'number') ? item.series.length : item.series;
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

    const renderRightActions = (progress: Animated.AnimatedInterpolation<number>) => {
      const trans = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [80, 0],
      });
      return (
        <RectButton style={styles.deleteBox} onPress={() => removeExercicio(index)}>
          <Animated.View style={{ transform: [{ translateX: trans }] }}>
            <FontAwesome name="trash-o" size={24} color="white" />
          </Animated.View>
        </RectButton>
      );
    };

    const renderLeftActions = (progress: Animated.AnimatedInterpolation<number>) => {
      const trans = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [-80, 0],
      });
      return (
        <RectButton style={styles.editBox} onPress={() => openEditExercicioModal(item, index)}>
          <Animated.View style={{ transform: [{ translateX: trans }] }}>
            <FontAwesome name="pencil" size={24} color="white" />
          </Animated.View>
        </RectButton>
      );
    };

    return (
      <Swipeable
        renderLeftActions={renderLeftActions}
        renderRightActions={renderRightActions}
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
              <Text style={styles.exercicioDetails}>{totalSets(item)} séries</Text>
          </View>
          <FontAwesome name="bars" size={20} color="#666" style={{ marginLeft: 15 }} />
        </TouchableOpacity>
      </Swipeable>
    );
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#0d181c' }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{treinoId ? 'Editar Treino' : 'Novo Treino'}</Text>
          <View style={{ width: 40 }} />
        </View>

        <DraggableFlatList
          containerStyle={{ flex: 1 }}
          contentContainerStyle={{ padding: 15, paddingBottom: 100 }}
          data={treino.exercicios || []}
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
          animationType="fade"
          transparent={true}
          visible={isExercicioModalVisible}
          onRequestClose={() => setExercicioModalVisible(false)}
        >
            <View style={styles.centeredView}>
                <View style={styles.addExercicioModalView}>
                    {selectedExercicioModelo?.imagemUrl && (
                        <VideoListItem
                            uri={selectedExercicioModelo.imagemUrl}
                            style={styles.addExercicioModalVideo}
                        />
                    )}
                    <Text style={styles.modalText}>
                        {editingExercicioIndex !== null ? 'Editar' : 'Adicionar'} {selectedExercicioModelo?.nome}
                    </Text>

                    <DraggableFlatList
                      data={sets}
                      containerStyle={{ maxHeight: 250, width: '100%' }}
                      keyExtractor={(item) => item.id!}
                      onDragEnd={({ data }) => setSets(data)}
                      renderItem={({ item, drag, isActive, getIndex }) => {
                        const index = getIndex();
                        if (index === undefined) return null;
                        return (
                          <View style={[styles.setRow, { backgroundColor: isActive ? '#3a3a3a' : '#222' }]}>
                            <TouchableOpacity onLongPress={drag}>
                               <FontAwesome name="bars" size={20} color="#666" style={{ marginRight: 10 }} />
                            </TouchableOpacity>
                            <Text style={styles.setText}>Série {index + 1}</Text>
                            <TextInput
                              style={styles.setInput}
                              placeholder="Reps"
                              placeholderTextColor="#888"
                              value={item.repeticoes}
                              onChangeText={(text) => {
                                const newSets = [...sets];
                                newSets[index].repeticoes = text;
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
                                newSets[index].peso = parseFloat(text) || 0;
                                setSets(newSets);
                              }}
                            />
                            <TouchableOpacity onPress={() => setSets(sets.filter((_, i) => i !== index))}>
                                <FontAwesome name="trash" size={20} color="#ff3b30" />
                            </TouchableOpacity>
                          </View>
                        )
                      }}
                    />

                    <TouchableOpacity style={styles.addSetButton} onPress={() => setSets([...sets, { id: `set-${Date.now()}`, repeticoes: '8-12', peso: 0 }])}>
                      <Text style={styles.addSetButtonText}>+ Adicionar Série</Text>
                    </TouchableOpacity>

                    <View style={styles.modalButtons}>
                        <TouchableOpacity style={[styles.button, styles.buttonClose]} onPress={() => {
                            setExercicioModalVisible(false);
                            setSets([]);
                            // Se estiver adicionando um novo exercício (não editando), reabra o modal de seleção.
                            if (editingExercicioIndex === null) {
                                setModalVisible(true);
                            }
                        }}>
                            <Text style={styles.textStyle}>Cancelar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.button, styles.buttonAdd]} onPress={handleSaveExercicio}>
                            <Text style={styles.textStyle}>{editingExercicioIndex !== null ? 'Salvar' : 'Adicionar'}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}
const styles = StyleSheet.create({
  container: { padding: 15 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: '#0d181c',
  },
  backButton: {
    padding: 5,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 30,
    fontWeight: 'bold',
  },
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
    backgroundColor: '#222',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  exercicioName: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  exercicioDetails: { color: '#aaa', fontSize: 14, marginTop: 4 },
  addButton: {
    borderWidth: 1,
    borderColor: '#4CAF50',
    borderStyle: 'dashed',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  addButtonText: { color: '#4CAF50', fontSize: 16, fontWeight: 'bold' },
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
  centeredView: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  addExercicioModalView: {
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
  addExercicioModalVideo: {
    width: 100,
    height: 100,
    borderRadius: 10,
    marginBottom: 15,
    backgroundColor: '#333',
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
  buttonClose: {
    backgroundColor: "#ff3b30",
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
    width: 60,
    textAlign: 'center',
    marginHorizontal: 5,
  },
  addSetButton: { padding: 10, marginTop: 10 },
  addSetButtonText: { color: '#1cb0f6', fontWeight: 'bold' },

});