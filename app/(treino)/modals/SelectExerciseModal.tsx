import { ExercicioModelo } from '@/models/exercicio';
import { getExerciciosModelos, getTodosGruposMusculares } from '@/services/exercicioService';
import { FontAwesome } from '@expo/vector-icons';
import { DocumentSnapshot } from 'firebase/firestore';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { VideoListItem } from '../../../components/VideoListItem';

interface SelectExerciseModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (exercicio: ExercicioModelo) => void;
}

const EXERCICIOS_PAGE_SIZE = 20;

export const SelectExerciseModal = ({ visible, onClose, onSelect }: SelectExerciseModalProps) => {
  const [exerciciosModelos, setExerciciosModelos] = useState<ExercicioModelo[]>([]);
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
      loadMoreExercicios(true); // Pass true to reset

      // Carrega todos os grupos musculares uma vez quando o modal se torna visível
      const fetchMuscleGroups = async () => {
        const groups = await getTodosGruposMusculares();
        setAllMuscleGroups(groups);
      };
      fetchMuscleGroups();
    }
  }, [activeSearchTerm, selectedGroup, visible]);

  const loadMoreExercicios = useCallback(async (isNewSearch = false) => {
    if (loadingMoreExercicios || (!isNewSearch && allExerciciosLoaded)) return;

    setLoadingMoreExercicios(true);
    try {
      const { exercicios: newExercicios, lastVisibleDoc: newLastVisibleDoc } = await getExerciciosModelos({
        lastVisibleDoc: isNewSearch ? null : lastVisibleDoc,
        limit: EXERCICIOS_PAGE_SIZE,
        searchTerm: activeSearchTerm,
        grupoMuscular: selectedGroup,
      });

      if (newExercicios && newExercicios.length > 0) {
        setExerciciosModelos(prev => isNewSearch ? newExercicios : [...prev, ...newExercicios]);
        setLastVisibleDoc(newLastVisibleDoc);
      } else {
        if (isNewSearch) setExerciciosModelos([]);
        setAllExerciciosLoaded(true);
      }
    } catch (error) {
      console.error("Erro ao carregar mais exercícios:", error);
    } finally {
      setLoadingMoreExercicios(false);
    }
  }, [loadingMoreExercicios, allExerciciosLoaded, lastVisibleDoc, activeSearchTerm, selectedGroup]);

  const handleClose = () => {
    setCurrentSearchInput('');
    setActiveSearchTerm('');
    setSelectedGroup(null);
    onClose();
  };

  const filteredExercicios = exerciciosModelos; // A filtragem agora é feita na query

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose} presentationStyle="pageSheet">
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Selecionar Exercício</Text>
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
          data={filteredExercicios}
          keyExtractor={item => item.id}
          onEndReached={() => loadMoreExercicios()}
          onEndReachedThreshold={0.5}
          ListFooterComponent={loadingMoreExercicios ? <ActivityIndicator style={{ marginVertical: 20 }} color="#fff" /> : null}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.modeloCard} onPress={() => onSelect(item)}>
              <VideoListItem style={styles.modeloVideo} uri={item.imagemUrl} />
              <Text style={styles.modeloName} numberOfLines={2}>{item.nome}</Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            !loadingMoreExercicios ? <Text style={styles.emptyListText}>Nenhum exercício encontrado.</Text> : null
          }
        />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: '#030405',
    paddingTop: 50,
    paddingHorizontal: 15,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    backgroundColor: '#222',
    borderRadius: 8,
    paddingRight: 10,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    padding: 12,
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
  groupButton: {
    height: 45,
    paddingHorizontal: 20,
    backgroundColor: '#141414',
    borderRadius: 12,
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ffffff1a',
  },
  groupSelected: { backgroundColor: '#1cb0f6' },
  groupText: { color: '#fff', fontWeight: 'bold', textAlign: 'center', fontSize: 14 },
  modeloCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#222', padding: 10, borderRadius: 8, marginBottom: 10 },
  modeloVideo: { width: 50, height: 50, borderRadius: 5, marginRight: 15, backgroundColor: '#333' },
  modeloName: { color: '#fff', fontSize: 16, flex: 1, flexWrap: 'wrap' },
  emptyListText: { color: '#aaa', textAlign: 'center', marginTop: 40 },
  closeButton: { backgroundColor: '#2c2c2e', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, alignItems: 'center' },
  closeButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});