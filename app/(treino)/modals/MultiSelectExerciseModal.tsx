import { ExercicioModelo } from '@/models/exercicio';
import { getExerciciosModelos, getTodosGruposMusculares } from '@/services/exercicioService';
import { FontAwesome } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { DocumentSnapshot } from 'firebase/firestore';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { VideoListItem } from '../editarTreino';

interface MultiSelectExerciseModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (exercicios: ExercicioModelo[]) => void;
  existingExerciseIds: string[];
}

const EXERCICIOS_PAGE_SIZE = 20;

export const MultiSelectExerciseModal = ({
  visible,
  onClose,
  onConfirm,
  existingExerciseIds,
}: MultiSelectExerciseModalProps) => {
  const [exerciciosModelos, setExerciciosModelos] = useState<ExercicioModelo[]>([]);
  const [selectedExercises, setSelectedExercises] = useState<ExercicioModelo[]>([]);
  const [lastVisibleDoc, setLastVisibleDoc] = useState<DocumentSnapshot | null>(null);
  const [loadingMoreExercicios, setLoadingMoreExercicios] = useState(false);
  const [allExerciciosLoaded, setAllExerciciosLoaded] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [currentSearchInput, setCurrentSearchInput] = useState('');
  const [activeSearchTerm, setActiveSearchTerm] = useState('');
  const [allMuscleGroups, setAllMuscleGroups] = useState<string[]>([]);

  useEffect(() => {
    if (visible) {
      setExerciciosModelos([]);
      setLastVisibleDoc(null);
      setAllExerciciosLoaded(false);
      loadMoreExercicios(true);

      const fetchMuscleGroups = async () => {
        const groups = await getTodosGruposMusculares();
        setAllMuscleGroups(groups);
      };
      fetchMuscleGroups();
    } else {
      // Limpa a seleção quando o modal é fechado
      setSelectedExercises([]);
    }
  }, [activeSearchTerm, selectedGroup, visible]);

  const loadMoreExercicios = useCallback(
    async (isNewSearch = false) => {
      if (loadingMoreExercicios || (!isNewSearch && allExerciciosLoaded)) return;

      setLoadingMoreExercicios(true);
      try {
        const { exercicios: newExercicios, lastVisibleDoc: newLastVisibleDoc } =
          await getExerciciosModelos({
            lastVisibleDoc: isNewSearch ? null : lastVisibleDoc,
            limit: EXERCICIOS_PAGE_SIZE,
            searchTerm: activeSearchTerm,
            grupoMuscular: selectedGroup,
          });

        if (newExercicios && newExercicios.length > 0) {
          setExerciciosModelos((prev) =>
            isNewSearch ? newExercicios : [...prev, ...newExercicios]
          );
          setLastVisibleDoc(newLastVisibleDoc);
        } else {
          if (isNewSearch) setExerciciosModelos([]);
          setAllExerciciosLoaded(true);
        }
      } catch (error) {
        console.error('Erro ao carregar mais exercícios:', error);
      } finally {
        setLoadingMoreExercicios(false);
      }
    },
    [loadingMoreExercicios, allExerciciosLoaded, lastVisibleDoc, activeSearchTerm, selectedGroup]
  );

  const handleToggleExercise = (exercicio: ExercicioModelo) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); // Add haptic feedback
    setSelectedExercises((prev) => {
      const isSelected = prev.some((e) => e.id === exercicio.id);
      if (isSelected) {
        return prev.filter((e) => e.id !== exercicio.id);
      } else {
        return [...prev, exercicio];
      }
    });
  };

  const handleConfirm = () => {
    onConfirm(selectedExercises);
    onClose();
  };

  const handleClose = () => {
    setCurrentSearchInput('');
    setActiveSearchTerm('');
    setSelectedGroup(null);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose} presentationStyle="pageSheet">
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Selecionar Exercícios</Text>
          <TouchableOpacity onPress={handleClose}>
            <FontAwesome name="close" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar exercício..."
            value={currentSearchInput}
            onChangeText={setCurrentSearchInput}
            placeholderTextColor="#888"
            onSubmitEditing={() => setActiveSearchTerm(currentSearchInput)}
          />
        </View>

        <View style={{ minHeight: 60 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.groupSelector} contentContainerStyle={{ paddingRight: 15 }}>
            <TouchableOpacity style={[styles.groupButton, !selectedGroup && styles.groupSelected]} onPress={() => setSelectedGroup(null)}>
              <Text style={styles.groupText}>Todos</Text>
            </TouchableOpacity>
            {allMuscleGroups.map((group) => group && (
              <TouchableOpacity key={group} style={[styles.groupButton, selectedGroup === group && styles.groupSelected]} onPress={() => setSelectedGroup(group)}>
                <Text style={styles.groupText}>{group}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <FlatList
          data={exerciciosModelos}
          keyExtractor={(item) => item.id}
          onEndReached={() => loadMoreExercicios()}
          onEndReachedThreshold={0.5}
          ListFooterComponent={loadingMoreExercicios ? <ActivityIndicator style={{ marginVertical: 20 }} color="#fff" /> : null}
          renderItem={({ item }) => {
            if (existingExerciseIds.includes(item.id)) {
              return null;
            }
            const isSelected = selectedExercises.some((e) => e.id === item.id);
            return (
              <TouchableOpacity
                style={[styles.modeloCard, isSelected && styles.modeloCardSelected]}
                onPress={() => handleToggleExercise(item)}
              >
                <VideoListItem style={styles.modeloVideo} uri={item.imagemUrl} />
                <Text style={styles.modeloName} numberOfLines={2}>{item.nome}</Text>
                {isSelected && <FontAwesome name="check-circle" size={24} color="#1cb0f6" />}
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={!loadingMoreExercicios ? <Text style={styles.emptyListText}>Nenhum exercício encontrado.</Text> : null}
        />

        {selectedExercises.length > 0 && (
          <View style={styles.footer}>
            <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
              <Text style={styles.confirmButtonText}>Adicionar ({selectedExercises.length})</Text>
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: { flex: 1, backgroundColor: '#030405' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#222' },
  modalTitle: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', margin: 15, backgroundColor: '#222', borderRadius: 8 },
  searchInput: { flex: 1, color: '#fff', padding: 12, fontSize: 16 },
  groupSelector: { paddingLeft: 15, marginBottom: 15 },
  groupButton: { height: 45, paddingHorizontal: 20, backgroundColor: '#141414', borderRadius: 12, marginRight: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#ffffff1a' },
  groupSelected: { backgroundColor: '#1cb0f6' },
  groupText: { color: '#fff', fontWeight: 'bold', textAlign: 'center', fontSize: 14 },
  modeloCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#222', padding: 10, borderRadius: 8, marginBottom: 10, marginHorizontal: 15, borderWidth: 2, borderColor: 'transparent' },
  modeloCardSelected: { borderColor: '#1cb0f6' },
  modeloVideo: { width: 70, height: 70, borderRadius: 5, marginRight: 15, backgroundColor: '#333' },
  modeloName: { color: '#fff', fontSize: 16, flex: 1, flexWrap: 'wrap' },
  emptyListText: { color: '#aaa', textAlign: 'center', marginTop: 40 },
  footer: { padding: 15, borderTopWidth: 1, borderTopColor: '#222' },
  confirmButton: { backgroundColor: '#1cb0f6', padding: 15, borderRadius: 8, alignItems: 'center' },
  confirmButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});