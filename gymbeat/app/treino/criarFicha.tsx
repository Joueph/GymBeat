import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TextInput, Button, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getFichaById, updateFicha } from '../../services/fichaService';
import { Ficha } from '../../models/ficha';

export default function CriarFichaScreen() {
  const router = useRouter();
  const { fichaId } = useLocalSearchParams<{ fichaId: string }>();
  
  const [ficha, setFicha] = useState<Partial<Ficha>>({ nome: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!fichaId) {
      Alert.alert("Erro", "Nenhuma ficha selecionada.");
      router.back();
      return;
    }

    const fetchFicha = async () => {
      try {
        setLoading(true);
        const fetchedFicha = await getFichaById(fichaId);
        if (fetchedFicha) {
          setFicha(fetchedFicha);
        } else {
          Alert.alert("Erro", "Ficha não encontrada.");
          router.back();
        }
      } catch (error) {
        console.error("Erro ao buscar ficha:", error);
        Alert.alert("Erro", "Não foi possível carregar os dados da ficha.");
        router.back();
      } finally {
        setLoading(false);
      }
    };

    fetchFicha();
  }, [fichaId]);

  const handleSave = async () => {
    if (!fichaId || !ficha.nome?.trim()) {
      Alert.alert("Atenção", "O nome da ficha é obrigatório.");
      return;
    }

    try {
      await updateFicha(fichaId, {
        nome: ficha.nome,
      });
      Alert.alert("Sucesso", "Ficha salva com sucesso!");
      router.back(); // Go back to the previous screen
    } catch (error) {
      console.error("Erro ao salvar ficha:", error);
      Alert.alert("Erro", "Não foi possível salvar as alterações.");
    }
  };

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" color="#fff" />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.title}>Editar Ficha</ThemedText>
      
      <ThemedText style={styles.label}>Nome da Ficha</ThemedText>
      <TextInput
        style={styles.input}
        placeholder="Ex: Treino de Peito e Tríceps"
        placeholderTextColor="#ccc"
        value={ficha.nome}
        onChangeText={(text) => setFicha(prev => ({ ...prev, nome: text }))}
      />

      <Button title="Salvar Ficha" onPress={handleSave} color="#4CAF50" />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: "#0d181c",
  },
  title: {
    marginBottom: 30,
  },
  label: {
    fontSize: 16,
    color: "#fff",
    alignSelf: 'flex-start',
    marginLeft: '5%',
    marginBottom: 5,
  },
  input: {
    width: "90%",
    backgroundColor: "#173F5F",
    color: "#fff",
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#4CAF50",
  },
});