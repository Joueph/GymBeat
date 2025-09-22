import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import DraggableFlatList, { RenderItemParams } from 'react-native-draggable-flatlist';
import { getFichaById, updateFicha } from '../../services/fichaService';
import { getTreinosByIds } from '../../services/treinoService';
import { Ficha } from '../../models/ficha';
import { Treino } from '../../models/treino';

export default function CriarFichaScreen() {
  const router = useRouter();
  const { fichaId } = useLocalSearchParams();
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [treinos, setTreinos] = useState<Treino[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (typeof fichaId !== 'string') {
      Alert.alert("Erro", "Nenhuma ficha selecionada para edição.");
      router.back();
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const fichaData = await getFichaById(fichaId);
      if (fichaData) {
        setFicha(fichaData);
        if (fichaData.treinos && fichaData.treinos.length > 0) {
          const treinosData = await getTreinosByIds(fichaData.treinos);
          setTreinos(treinosData);
        } else {
          setTreinos([]);
        }
      } else {
        Alert.alert("Erro", "Ficha não encontrada.");
        router.back();
      }
    } catch (error) {
      console.error("Erro ao carregar dados da ficha:", error);
      Alert.alert("Erro", "Não foi possível carregar os dados da ficha.");
    } finally {
      setLoading(false);
    }
  }, [fichaId]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const handleSaveChanges = async () => {
    if (!ficha) return;
    // Os IDs dos treinos já estão na ordem correta no estado 'ficha' devido ao onDragEnd
    try {
      await updateFicha(ficha.id, { nome: ficha.nome, treinos: ficha.treinos });
      Alert.alert("Sucesso", "Ficha salva com sucesso!");
      router.back();
    } catch (error) {
      Alert.alert("Erro", "Não foi possível salvar as alterações.");
    }
  };

  const handleDragEnd = ({ data }: { data: Treino[] }) => {
    setTreinos(data); // Atualiza a ordem visual
    const newTreinoIds = data.map(t => t.id);
    setFicha(prev => prev ? { ...prev, treinos: newTreinoIds } : null); // Atualiza a ordem dos IDs para salvar
  };

  if (loading) {
    return <ActivityIndicator style={styles.container} size="large" color="#fff" />;
  }

  if (!ficha) {
    return null; // Or a dedicated loading/error component
  }

  const renderTreinoItem = ({ item, drag, isActive }: RenderItemParams<Treino>) => (
    <TouchableOpacity
        onLongPress={drag}
        disabled={isActive}
        style={[styles.treinoCard, { opacity: isActive ? 0.5 : 1 }]}
        onPress={() => router.push(`/treino/editarTreino?fichaId=${ficha.id}&treinoId=${item.id}`)}
    >
        <Text style={styles.treinoName}>{item.nome}</Text>
        <Text style={styles.treinoInfo}>{item.exercicios.length} exercícios</Text>
    </TouchableOpacity>
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Editar Ficha</Text>
          <View style={{ width: 40 }} />
        </View>
        <DraggableFlatList
          containerStyle={{ flex: 1 }}
          contentContainerStyle={{ padding: 15, paddingBottom: 100 }}
          data={treinos}
          renderItem={renderTreinoItem}
          keyExtractor={(item) => item.id}
          onDragEnd={handleDragEnd}
          ListHeaderComponent={
            <>
              <TextInput
                style={styles.input}
                value={ficha.nome}
                onChangeText={(text) => setFicha(prev => prev ? { ...prev, nome: text } : null)}
                placeholder="Nome da Ficha"
                placeholderTextColor="#888"
              />
              <Text style={styles.sectionTitle}>Treinos</Text>
            </>
          }
          ListFooterComponent={
            <>
              <TouchableOpacity style={styles.addButton} onPress={() => router.push(`/treino/editarTreino?fichaId=${ficha.id}`)}>
                <Text style={styles.addButtonText}>+ Adicionar Novo Treino</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={handleSaveChanges}>
                <Text style={styles.saveButtonText}>Salvar Alterações na Ficha</Text>
              </TouchableOpacity>
            </>
          }
        />
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#0d181c' },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 15,
      paddingTop: 10,
      paddingBottom: 10,
    },
    backButton: {
      padding: 5,
    },
    backButtonText: {
      color: '#fff',
      fontSize: 30,
      fontWeight: 'bold',
    },
    container: { padding: 15 },
    title: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
    input: { backgroundColor: '#222', color: '#fff', padding: 15, borderRadius: 8, fontSize: 16, marginBottom: 20 },
    sectionTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff', marginTop: 10, marginBottom: 10 },
    treinoCard: { backgroundColor: '#173F5F', padding: 15, borderRadius: 8, marginBottom: 10 },
    treinoName: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
    treinoInfo: { color: '#ccc', fontSize: 14, marginTop: 5 },
    addButton: { backgroundColor: '#4CAF50', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 10 },
    addButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    saveButton: { backgroundColor: '#1cb0f6', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 30, marginBottom: 50 },
    saveButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});