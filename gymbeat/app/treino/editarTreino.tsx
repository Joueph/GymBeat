import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Modal, FlatList, Animated, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';
import { GestureHandlerRootView, Swipeable, RectButton } from 'react-native-gesture-handler';
import DraggableFlatList, { RenderItemParams } from 'react-native-draggable-flatlist';
import { useAuth } from '../authprovider';
import { getTreinoById, addTreinoToFicha, updateTreino } from '../../services/treinoService';
import { getExerciciosModelos } from '../../services/exercicioService';
import { Video } from 'expo-av';
import { Treino, DiaSemana } from '../../models/treino';
import { Exercicio, ExercicioModelo } from '../../models/exercicio';

const DIAS_SEMANA: DiaSemana[] = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];

export default function EditarTreinoScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { fichaId, treinoId } = useLocalSearchParams();

  const [treino, setTreino] = useState<Partial<Treino>>({ nome: '', diasSemana: [], intervalo: { min: 1, seg: 0 }, exercicios: [] });
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [exerciciosModelos, setExerciciosModelos] = useState<ExercicioModelo[]>([]);
  const [isModalVisible, setModalVisible] = useState(false);
  const [isExercicioModalVisible, setExercicioModalVisible] = useState(false);
  const [selectedExercicioModelo, setSelectedExercicioModelo] = useState<ExercicioModelo | null>(null);
  const [editingExercicioIndex, setEditingExercicioIndex] = useState<number | null>(null);
  const [series, setSeries] = useState('');
  const [repeticoes, setRepeticoes] = useState('');
  const [peso, setPeso] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [modelos, treinoData] = await Promise.all([
          getExerciciosModelos(),
          treinoId ? getTreinoById(treinoId as string) : Promise.resolve(null)
        ]);
        setExerciciosModelos(modelos);
        if (treinoData) {
          setTreino(treinoData);
        }
      } catch (error) {
        Alert.alert("Erro", "Não foi possível carregar os dados.");
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [treinoId]);

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

  const openExercicioModal = (modelo: ExercicioModelo) => {
    setModalVisible(false);
    setSelectedExercicioModelo(modelo);
    setEditingExercicioIndex(null); // Ensure we are in "add" mode
    setExercicioModalVisible(true);
  };

  const handleSaveExercicio = () => {
    if (!selectedExercicioModelo || !series || !repeticoes) {
      Alert.alert("Erro", "Séries e repetições são obrigatórios.");
      return;
    }

    const novoExercicio: Exercicio = {
      modelo: selectedExercicioModelo,
      modeloId: selectedExercicioModelo.id,
      series: parseInt(series, 10),
      repeticoes: repeticoes,
      peso: peso ? parseFloat(peso) : 0,
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
    setSeries('');
    setRepeticoes('');
    setPeso('');
  };

  const removeExercicio = (index: number) => {
    setTreino(prev => ({ ...prev, exercicios: prev.exercicios?.filter((_, i) => i !== index) }));
  };

  const openEditExercicioModal = (exercicio: Exercicio, index: number) => {
    setModalVisible(false); // Close selection modal if open
    setSelectedExercicioModelo(exercicio.modelo);
    setSeries(String(exercicio.series));
    setRepeticoes(exercicio.repeticoes);
    setPeso(String(exercicio.peso || ''));
    setEditingExercicioIndex(index);
    setExercicioModalVisible(true);
  };

  const filteredExercicios = useMemo(() => {
    return exerciciosModelos
      .filter(ex => selectedGroup ? ex.grupoMuscular === selectedGroup : true)
      .filter(ex => ex.nome.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [exerciciosModelos, searchTerm, selectedGroup]);

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
              <Text style={styles.exercicioDetails}>{item.series}x {item.repeticoes} {item.peso ? `| ${item.peso}kg` : ''}</Text>
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
              <TouchableOpacity style={styles.addButton} onPress={() => setModalVisible(true)}>
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
              <TextInput style={styles.searchInput} placeholder="Buscar exercício..." value={searchTerm} onChangeText={setSearchTerm} placeholderTextColor="#888" />

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
                  renderItem={({ item }) => (
                      <TouchableOpacity style={styles.modeloCard} onPress={() => openExercicioModal(item)}>
                          <Video
                              source={{ uri: `https://firebasestorage.googleapis.com/v0/b/gymbeat-153s.appspot.com/o/exercicios%2F${encodeURIComponent(item.grupoMuscular)}%2F${encodeURIComponent(item.nome)}.webm?alt=media` }}
                              style={styles.modeloImage}
                              shouldPlay
                              isLooping
                              isMuted />
                          <Text style={styles.modeloName} numberOfLines={2}>{item.nome}</Text>
                      </TouchableOpacity>
                  )}
                  ListEmptyComponent={<Text style={styles.emptyListText}>Nenhum exercício encontrado.</Text>} />
              <TouchableOpacity style={styles.closeButton} onPress={() => setModalVisible(false)}>
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
                    <Text style={styles.modalText}>Adicionar {selectedExercicioModelo?.nome}</Text>

                    <TextInput
                        style={styles.modalInput}
                        placeholder="Séries"
                        placeholderTextColor="#888"
                        keyboardType="number-pad"
                        value={series}
                        onChangeText={setSeries} />
                    <TextInput
                        style={styles.modalInput}
                        placeholder="Repetições (ex: 8-12)"
                        placeholderTextColor="#888"
                        value={repeticoes}
                        onChangeText={setRepeticoes} />
                    <TextInput
                        style={styles.modalInput}
                        placeholder="Peso (kg, opcional)"
                        placeholderTextColor="#888"
                        keyboardType="numeric"
                        value={peso}
                        onChangeText={setPeso} />

                    <View style={styles.modalButtons}>
                        <TouchableOpacity style={[styles.button, styles.buttonClose]} onPress={() => setExercicioModalVisible(false)}>
                            <Text style={styles.textStyle}>Cancelar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.button, styles.buttonAdd]} onPress={handleSaveExercicio}>
                            <Text style={styles.textStyle}>Adicionar</Text>
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
  diaButton: { paddingVertical: 10, paddingHorizontal: 12, backgroundColor: '#222', borderRadius: 8 },
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
  searchInput: {
    backgroundColor: '#222',
    color: '#fff',
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
    marginBottom: 15,
  },
  groupSelector: { marginBottom: 15 },
  groupButton: { paddingVertical: 10, paddingHorizontal: 16, backgroundColor: '#222', borderRadius: 20, marginRight: 10, justifyContent: 'center' },
  groupSelected: { backgroundColor: '#1cb0f6' },
  groupText: { color: '#fff', fontWeight: '500', textAlign: 'center' },
  modeloCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#222', padding: 10, borderRadius: 8, marginBottom: 10 },
  modeloImage: { width: 50, height: 50, borderRadius: 5, marginRight: 15, backgroundColor: '#333', resizeMode: 'cover' },
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
});