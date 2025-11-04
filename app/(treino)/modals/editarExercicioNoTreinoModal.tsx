import { RepetitionsDrawer } from '@/components/RepetitionsDrawer';
import { Exercicio, Serie } from '@/models/exercicio';
import { FontAwesome, FontAwesome5 } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Modal, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import DraggableFlatList, { RenderItemParams as DraggableRenderItemParams } from 'react-native-draggable-flatlist';
import { MenuProvider } from 'react-native-popup-menu';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SetOptionsMenu } from '../../../components/SetOptionsMenu';
import { VideoListItem } from '../ongoingWorkout'; // Assumindo que este é o caminho correto

interface SerieEdit extends Omit<Serie, 'id'> {
  peso: number;
  repeticoes: any;
  id: string;
  type: 'normal' | 'dropset';
  isTimeBased?: boolean;
}

interface EditExerciseModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (updatedSeries: SerieEdit[], pesoBarra?: number) => void;
  exercise: Exercicio | null;
}

export const EditarExercicioNoTreinoModal = ({ visible, onClose, onSave, exercise }: EditExerciseModalProps) => {
  const [editingSeries, setEditingSeries] = useState<SerieEdit[]>([]);
  const [pesoBarra, setPesoBarra] = useState<number>(0);
  // --- NOVOS ESTADOS PARA O DRAWER ---
  const [isRepDrawerVisible, setIsRepDrawerVisible] = useState(false);
  const [editingSetIndex, setEditingSetIndex] = useState<number | null>(null);

  useEffect(() => {
    if (exercise) {
      const seriesCopy = JSON.parse(JSON.stringify(exercise.series)).map((s: Serie, index: number) => ({
        ...s,
        id: s.id || `set-${Date.now()}-${index}`,
      }));
      setEditingSeries(seriesCopy);
      setPesoBarra(exercise.pesoBarra || 0);
    } else {
      setEditingSeries([]);
      setPesoBarra(0);
    }
  }, [exercise]);

  const handleSetOption = (option: 'addDropset' | 'copy' | 'delete' | 'toggleTime', index: number) => {
    // Adiciona um pequeno atraso para permitir que o menu pop-up feche antes de o estado ser atualizado.
    // Isso evita o erro "Cannot read property 'measure' of null" do react-native-popup-menu.
    setTimeout(() => {
      if (exercise?.isBiSet) {
        Alert.alert("Ação não permitida", "Para alterar a estrutura das séries, edite o exercício principal do bi-set.");
        return;
      }
      const newSets = [...editingSeries];
      if (option === 'toggleTime') {
        const currentSet = newSets[index];
        currentSet.isTimeBased = !currentSet.isTimeBased;
        currentSet.repeticoes = currentSet.isTimeBased ? '60' : '8-12';
        if (currentSet.isTimeBased) {
          currentSet.peso = 0;
        }
      } else if (option === 'delete') {
        newSets.splice(index, 1);
      } else if (option === 'copy') {
        newSets.splice(index + 1, 0, { ...newSets[index], id: `set-${Date.now()}` });
      } else if (option === 'addDropset') {
        const parentSet = newSets[index];
        newSets.splice(index + 1, 0, { id: `set-${Date.now()}`, repeticoes: parentSet.repeticoes, peso: (parentSet.peso ?? 10) * 0.7, type: 'dropset' });
      }
      setEditingSeries(newSets);
    }, 100);
  };

  // --- NOVAS FUNÇÕES PARA O DRAWER ---
  const handleRepetitionsSave = (newReps: string) => {
    if (editingSetIndex === null) return;
    
    const newSets = [...editingSeries];
    newSets[editingSetIndex].repeticoes = newReps;
    setEditingSeries(newSets);
    
    // Fecha o drawer e reseta o índice
    setIsRepDrawerVisible(false);
    setEditingSetIndex(null);
  };
  
  const getRepetitionsValue = () => {
    if (editingSetIndex === null || !editingSeries[editingSetIndex]) {
      return '8-12'; // Valor padrão
    }
    return editingSeries[editingSetIndex].repeticoes;
  };
  const handleSaveChanges = () => {
    if (editingSeries.some(s => !s.repeticoes || String(s.repeticoes).trim() === '')) {
      Alert.alert("Erro", "Todas as séries devem ter repetições definidas.");
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSave(editingSeries, pesoBarra);
  };

  return (
    <Modal animationType="slide" presentationStyle="pageSheet" visible={visible} onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"} 
        // Adicionado keyboardVerticalOffset para ajustar o padding no iOS
        keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0}
      >
        <MenuProvider>
          <SafeAreaView style={styles.modalSafeArea}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Editar Exercício</Text>
              <TouchableOpacity onPress={onClose}>
                <FontAwesome name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            {exercise && (
              <>
                <View style={styles.editingExercisePreview}>
                  {exercise.modelo.imagemUrl && (
                    <VideoListItem uri={exercise.modelo.imagemUrl} style={styles.editingExerciseVideo} />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.editingExerciseName}>{exercise.modelo.nome}</Text>
                    <Text style={styles.editingExerciseMuscleGroup}>{exercise.modelo.grupoMuscular}</Text>
                  </View>
                </View>
              </>
            )}
            <View style={{ flex: 1 }}>
              <DraggableFlatList
              data={editingSeries} 
              contentContainerStyle={styles.modalScrollViewContent}
              keyExtractor={(item) => item.id!}
              onDragEnd={({ data }) => { if (!exercise?.isBiSet) setEditingSeries(data); }}
              renderItem={({ item, drag, isActive, getIndex }: DraggableRenderItemParams<SerieEdit>) => {
                const itemIndex = getIndex();
                if (itemIndex === undefined) return null;
                const normalSeriesCount = editingSeries.slice(0, itemIndex + 1).filter(s => (s.type || 'normal') === 'normal').length;
                const isBiSetFollower = exercise?.isBiSet ?? false;
                const isTimeBased = item.isTimeBased;
                return (
                  <View style={{ marginLeft: item.type === 'dropset' ? 30 : 0, marginBottom: 10 }}>
                    <View style={[styles.setRow, { backgroundColor: isActive ? '#3a3a3a' : '#1f1f1f' }]}>
                      <TouchableOpacity onLongPress={!isBiSetFollower ? drag : undefined} style={{ paddingHorizontal: 10, opacity: isBiSetFollower ? 0.3 : 1 }} disabled={isActive || isBiSetFollower}>
                        <FontAwesome5 name={(item.type || 'normal') === 'normal' ? "dumbbell" : "arrow-down"} size={16} color="#888" />
                      </TouchableOpacity>
                      <Text style={styles.setText}>{(item.type || 'normal') === 'normal' ? `Série ${normalSeriesCount}` : 'Dropset'}</Text>
                      
                      {/* --- LÓGICA DE REPETIÇÕES ATUALIZADA --- */}
                      <View style={styles.inputContainer}>
                        <Text style={styles.inputLabel}>{isTimeBased ? "Tempo (s)" : "Repetições"}</Text>
                        {isTimeBased ? (
                          <TextInput style={styles.setInput} placeholder="Tempo (s)" placeholderTextColor="#888" value={String(item.repeticoes)} onChangeText={(text) => { const newSets = [...editingSeries]; newSets[itemIndex].repeticoes = text; setEditingSeries(newSets); }} keyboardType='number-pad' />
                        ) : (
                          <TouchableOpacity 
                            style={styles.repButton}
                            onPress={() => {
                              setEditingSetIndex(itemIndex);
                              setIsRepDrawerVisible(true);
                            }}
                          >
                            <Text style={styles.repButtonText}>{String(item.repeticoes)}</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                      {exercise?.modelo?.caracteristicas?.isPesoCorporal ? (
                        <View style={styles.bodyWeightContainer}><Text style={styles.bodyWeightText}>Corporal</Text></View>
                      ) : (
                        <TextInput 
                          style={styles.setInput} 
                          placeholder="kg" 
                          placeholderTextColor="#888" 
                          keyboardType="decimal-pad" 
                          editable={!isTimeBased}
                          value={String(item.peso || '')} 
                          onChangeText={(text) => { const newSets = [...editingSeries]; newSets[itemIndex].peso = text as any; setEditingSeries(newSets); }} 
                          onEndEditing={(e) => { const newSets = [...editingSeries]; newSets[itemIndex].peso = parseFloat(e.nativeEvent.text.replace(',', '.')) || 0; setEditingSeries(newSets); }}
                          // --- FIM DA ATUALIZAÇÃO ---

                          // --- FIM DA ATUALIZAÇÃO ---
                        />
                      )}
                      <SetOptionsMenu
                        isTimeBased={!!item.isTimeBased}
                        isNormalSet={(item.type || 'normal') === 'normal'}
                        onSelect={(action) => handleSetOption(action, itemIndex)}
                      />
                    </View>
                  </View>
                );
              }}
              ListFooterComponent={
                <>
                  {!exercise?.isBiSet && (
                    <TouchableOpacity style={styles.addSetButton} onPress={() => setEditingSeries([...editingSeries, { id: `set-${Date.now()}`, repeticoes: '8-12', peso: 10, type: 'normal' }])}>
                      <Text style={styles.addSetButtonText}>+ Adicionar Série</Text>
                    </TouchableOpacity>
                  )}
                </>
              }
            />
            </View>
            <View style={styles.modalFooter}>
              {exercise?.modelo?.caracteristicas?.usaBarra && (
                <View style={styles.barbellWeightCard}>
                  <Text style={styles.barbellWeightLabel}>Peso da Barra</Text>
                  <TextInput
                    style={styles.barbellWeightInput}
                    value={String(pesoBarra)}
                    onChangeText={(text) => setPesoBarra(text as any)}
                    onEndEditing={(e) => setPesoBarra(parseFloat(e.nativeEvent.text.replace(',', '.')) || 0)}
                    keyboardType="decimal-pad"
                    placeholder="kg"
                    placeholderTextColor="#888"
                  />
                </View>
              )}
              {exercise?.modelo?.caracteristicas?.isPesoBilateral &&
                !exercise?.modelo?.caracteristicas?.usaBarra &&
                editingSeries.length > 0 && (
                <View style={styles.bilateralInfoCard}>
                  <View style={styles.dumbbellIconContainer}>
                    <View style={styles.dumbbellWithWeight}>
                      <FontAwesome5 name="dumbbell" size={24} color="#ccc" style={{ transform: [{ rotate: '-45deg' }] }} />
                      <Text style={styles.dumbbellWeightText}>{editingSeries[0].peso || 0} kg</Text>
                    </View>
                    <View style={styles.dumbbellWithWeight}>
                      <FontAwesome5 name="dumbbell" size={24} color="#ccc" style={{ transform: [{ rotate: '-45deg' }] }} />
                      <Text style={styles.dumbbellWeightText}>{editingSeries[0].peso || 0} kg</Text>
                    </View>
                  </View>
                </View>
              )}
              {exercise?.modelo?.caracteristicas?.usaBarra && editingSeries.length > 0 && (
                <View style={styles.bilateralInfoCard}>
                  <View style={styles.barbellIconContainer}>
                    <Image
                      source={require('../../../assets/images/Exercicios/ilustracaoBarra.png')}
                      style={styles.barbellImage}
                      resizeMode="contain"
                    />
                  </View>
                  <View style={styles.barbellWeightDistribution}>
                    <Text style={styles.dumbbellWeightText}>{editingSeries[0].peso || 0} kg</Text>
                    <Text style={styles.barbellCenterWeightText}>{pesoBarra || 0} kg</Text>
                    <Text style={styles.dumbbellWeightText}>{editingSeries[0].peso || 0} kg</Text>
                  </View>
                </View>
              )}
              <TouchableOpacity style={styles.saveButton} onPress={handleSaveChanges}>
                <Text style={styles.saveButtonText}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </MenuProvider>
      </KeyboardAvoidingView>

      {/* --- ADIÇÃO DO COMPONENTE DRAWER --- */}
      <RepetitionsDrawer
        visible={isRepDrawerVisible}
        onClose={() => {
          setIsRepDrawerVisible(false);
          setEditingSetIndex(null);
        }}
        onSave={handleRepetitionsSave}
        initialValue={getRepetitionsValue()}
      />
    </Modal>
  );
};

const styles = StyleSheet.create({
    modalSafeArea: { flex: 1, backgroundColor: '#141414' }, // Removido paddingBottom
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#222' , marginBottom: 20 },
    modalTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
    modalScrollViewContent: { padding: 20, paddingBottom: 40 },
    setRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: 5, borderRadius: 8, borderBottomWidth: 1, borderBottomColor: '#2f2f2f', height: 65 }, // Mantido
    setText: { color: '#fff', fontWeight: 'bold', flex: 0.8 }, // Ajustado para dar espaço
    inputContainer: {
      flex: 1,
      marginHorizontal: 5,
    },
    inputLabel: {
      color: '#aaa',
      fontSize: 10,
      textAlign: 'center',
      marginBottom: 2,
    },
    setInput: { 
      backgroundColor: '#2c2c2e', 
      color: '#fff', padding: 8, 
      borderRadius: 5, textAlign: 'center' 
    },
    addSetButton: { padding: 10, marginTop: 10, backgroundColor: '#2c2c2e', borderRadius: 8, width: '100%', alignItems: 'center' },
    addSetButtonText: { color: '#1cb0f6', fontWeight: 'bold' },
    editingExercisePreview: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1f1f1f', borderRadius: 12, padding: 10, marginHorizontal: 20, marginBottom: 20, borderWidth: 1, borderColor: '#ffffff1a', },
    modalFooter: { padding: 20, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#222', backgroundColor: '#141414' },
    saveButton: { backgroundColor: '#1cb0f6', height: 60, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    saveButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
    bilateralInfoCard: { backgroundColor: '#1f1f1f', borderRadius: 12, padding: 15, alignItems: 'center', marginBottom: 15, borderWidth: 1, borderColor: '#ffffff1a' },
    dumbbellIconContainer: { flexDirection: 'row', gap: 40, marginBottom: 5 },
    dumbbellWithWeight: {
      alignItems: 'center',
      gap: 8,
    },
    dumbbellWeightText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
    editingExerciseVideo: { width: 60, height: 60, borderRadius: 8, marginRight: 15 },
    editingExerciseName: { color: '#fff', fontSize: 16, fontWeight: 'bold', },
    editingExerciseMuscleGroup: { color: '#ccc', fontSize: 14, marginTop: 4 },
    barbellWeightCard: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: '#1f1f1f',
      borderRadius: 12,
      padding: 15,
      marginBottom: 15,
      borderWidth: 1,
      borderColor: '#ffffff1a',
    },
    barbellWeightLabel: {
      color: '#ccc',
      fontSize: 16,
      fontWeight: '500',
    },
    barbellWeightInput: {
      backgroundColor: '#2c2c2e',
      color: '#fff',
      paddingVertical: 8, paddingHorizontal: 15, borderRadius: 8, fontSize: 16, textAlign: 'center', minWidth: 60,
    },    barbellIconContainer: { width: '100%', alignItems: 'center', marginBottom: 10 },
    barbellImage: {
      width: '100%',
      height: 80,
    },
    barbellWeightDistribution: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', paddingHorizontal: 10 },
    barbellCenterWeightText: { color: '#1cb0f6', fontSize: 14, fontWeight: 'bold' },
    // Estilos para os ícones de depuração
    debugContainer: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: '#1f1f1f', padding: 8, marginHorizontal: 20, marginBottom: 20, borderRadius: 8, marginTop: -10 },
    bodyWeightContainer: {
      flex: 1,
      backgroundColor: '#2c2c2e',
      padding: 8,
      borderRadius: 5,
      marginHorizontal: 5,
      justifyContent: 'center',
      alignItems: 'center',
    },
    bodyWeightText: {
      color: '#ccc',
      fontSize: 14,
    },
    debugItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    debugText: { color: '#aaa', fontSize: 10 },
    // --- NOVOS ESTILOS PARA O BOTÃO DE REPS ---
    repButton: {
      backgroundColor: '#2c2c2e',
      padding: 8,
      borderRadius: 5,
      height: 38, // Altura para bater com o TextInput
      justifyContent: 'center', // Centraliza o texto
    },
    repButtonText: {
      color: '#fff',
      textAlign: 'center',
      fontWeight: '500',
    },
});