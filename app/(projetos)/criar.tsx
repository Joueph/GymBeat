import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFeedback } from '../../components/providers/FeedbackProvider';
import { usePremiumStatus } from '../../hooks/usePremiumStatus';
import { MetaProjeto } from '../../models/projeto';
import { createProjeto, getProjetosByUsuarioId } from '../../services/projetoService';
import { useAuth } from '../authprovider';

/**
 * Renders the project creation form and persists new projects for the current user.
 * @returns Project creation screen.
 */
export default function CriarProjetoScreen() {
  const { user } = useAuth();
  const router = useRouter();

  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [loading, setLoading] = useState(false);
  const { isPremium, navigateToPaywall } = usePremiumStatus();
  const { showFeedback } = useFeedback();

  const handleSubmit = async () => {
    if (!user) {
      Alert.alert("Erro", "Você precisa estar logado.");
      return;
    }
    if (!titulo.trim()) {
      Alert.alert("Campo Obrigatório", "Por favor, dê um título ao seu projeto.");
      return;
    }

    setLoading(true);
    try {
      // PREMIUM CHECK
      // PREMIUM CHECK - FICHAS (Projetos are treated as Fichas here or logically related)
      // The user asked to limit "Ficha". "criar.tsx" seems to create "Projetos" but the variable name in original logic was about preventing multiple custom projects.
      // Wait, 'criar.tsx' creates 'MetaProjeto'? No, it creates a 'Projeto'.
      // Let's assume the user meant "Projetos" or "Fichas" in the general sense of "Workout Programs".
      // Given the file path `app/(projetos)/criar.tsx`, this creates a Project/Ficha.

      if (!isPremium) {
        // Free user: Limit to 1 custom project/ficha
        const projetos = await getProjetosByUsuarioId(user.id);
        // If they already have >= 1, they cannot create more.
        if (projetos.length >= 1) {
          showFeedback('failure', 'Limite Atingido', 'Usuários gratuitos podem criar apenas 1 ficha. Assine o Premium!', 4000);
          setTimeout(() => navigateToPaywall(), 1500); // Wait a bit for toast then redirect
          return;
        }
      }

      // Definimos uma meta padrão simples, já que o formulário foi simplificado
      const metaPadrao: MetaProjeto = { tipo: 'diasPorSemana', valor: 3 };

      const novoProjetoId = await createProjeto({
        criadorId: user.id,
        titulo: titulo.trim(),
        descricao: descricao.trim(),
        dataCriacao: new Date(),
        participantes: [user.id],
        meta: metaPadrao,
        semanasSeguidas: 0, // Simplificado: sem foto na criação. Pode ser adicionada na edição.
        galeriaFotos: [],
        logsTreinos: [],
      });

      showFeedback('success', 'Sucesso!', 'Seu projeto foi criado.', 3000);

      // Substituímos a rota do modal pela nova tela do projeto
      router.replace({ pathname: '/(projetos)/[id]', params: { id: novoProjetoId } });

    } catch (error: any) {
      console.error("ERRO NO HANDLESUBMIT:", error.message);
      showFeedback('failure', 'Erro', 'Não foi possível salvar o projeto.', 4000);
    } finally {
      setLoading(false);
    }
  };

  return (
    // Backdrop escuro que fecha o modal ao ser tocado
    <TouchableOpacity
      style={styles.modalBackdrop}
      activeOpacity={1}
      onPress={() => router.back()}
    >
      {/* Container do modal que impede o clique de fechar (onPress={() => {}}) */}
      <TouchableOpacity style={styles.modalView} activeOpacity={1} onPress={(e) => e.stopPropagation()}>
        <Text style={styles.modalTitle}>Novo Projeto</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Título do Projeto</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: Foco Total 30 Dias"
            placeholderTextColor="#888"
            value={titulo}
            onChangeText={setTitulo}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Descrição (Opcional)</Text>
          <TextInput
            style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
            placeholder="Qual o objetivo deste projeto?"
            placeholderTextColor="#888"
            value={descricao}
            onChangeText={setDescricao}
            multiline
          />
        </View>

        <TouchableOpacity style={[styles.actionButton, loading && styles.actionButtonDisabled]} onPress={handleSubmit} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.actionButtonText}>Criar Projeto</Text>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

// Estilos inspirados nos seus modais de 'amigos.tsx' e campos de 'criar.tsx'
const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  modalView: {
    margin: 20,
    backgroundColor: '#141414',
    borderRadius: 20,
    padding: 25,
    alignItems: 'stretch', // Alinha itens horizontalmente
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    width: '90%',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 20,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 15,
  },
  label: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#030405',
    color: '#fff',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 8,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#222',
  },
  actionButton: {
    backgroundColor: '#1cb0f6',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  actionButtonDisabled: {
    backgroundColor: '#555',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
