import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TextInput, Button, ActivityIndicator, Alert, Switch } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getFichaById, updateFicha, getFichaAtiva, setFichaAtiva } from '../../services/fichaService';
import { Ficha } from '../../models/ficha';
import { useAuth } from '../authprovider';

export default function CriarFichaScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { fichaId } = useLocalSearchParams<{ fichaId: string }>();
  
  const [ficha, setFicha] = useState<Partial<Ficha>>({ nome: '', ativa: false });
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

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

    if (!user) {
      Alert.alert("Erro", "Usuário não autenticado.");
      return;
    }

    setIsSaving(true);
    try {
      if (ficha.ativa) {
        // Se estamos ativando a ficha, primeiro atualizamos o nome
        // e depois usamos o serviço que a torna a única ativa.
        await updateFicha(fichaId, { nome: ficha.nome });
        await setFichaAtiva(user.uid, fichaId);
      } else {
        // Se estamos desativando, podemos atualizar nome e status de uma vez.
        await updateFicha(fichaId, { nome: ficha.nome, ativa: false });
      }

      Alert.alert("Sucesso", "Ficha salva com sucesso!");
      router.back();
    } catch (error) {
      console.error("Erro ao salvar ficha:", error);
      Alert.alert("Erro", "Não foi possível salvar as alterações.");
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#fff" />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      {/* Use Stack.Screen to configure the header for this screen */}
      <Stack.Screen
        options={{
          title: 'Editar Ficha',
          headerShown: true,
          headerStyle: { backgroundColor: 'rgba(255, 255, 255, 0.05)' },
          headerTintColor: '#fff',
        }}
      />
      
      <ThemedText style={styles.label}>Nome da Ficha</ThemedText>
      <TextInput
        style={styles.input}
        placeholder="Ex: Treino de Peito e Tríceps"
        placeholderTextColor="#ccc"
        value={ficha.nome}
        onChangeText={(text) => setFicha(prev => ({ ...prev, nome: text }))}
      />

      {/* Switch para definir como Ficha Ativa */}
      <View style={styles.switchContainer}>
        <ThemedText style={styles.labelSwitch}>Definir como Ficha Ativa</ThemedText>
        <Switch
          trackColor={{ false: "#767577", true: "#81b0ff" }}
          thumbColor={ficha.ativa ? "#4CAF50" : "#f4f3f4"}
          ios_backgroundColor="#3e3e3e"
          onValueChange={(value) => setFicha(prev => ({ ...prev, ativa: value }))}
          value={!!ficha.ativa} // Garante que o valor é sempre booleano
        />
      </View>

      <Button title={isSaving ? "Salvando..." : "Salvar Ficha"} onPress={handleSave} color="#4CAF50" disabled={isSaving} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    padding: 20,
    backgroundColor: "#0d181c",
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: "#0d181c",
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
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '90%',
    marginBottom: 30,
    backgroundColor: '#173F5F',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#4CAF50",
  },
  labelSwitch: {
    fontSize: 16,
    color: "#fff",
  },
});