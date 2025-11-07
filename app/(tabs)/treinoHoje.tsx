import { FontAwesome } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { FichaMenuAction, FichaOptionsMenu } from '../../components/FichaOptionsMenu';

import { OngoingWorkoutFooter } from '../../components/OngoingWorkoutFooter';
import { Ficha } from '../../models/ficha';
import { Treino } from '../../models/treino';
import { deleteFicha, getFichaAtiva, getFichasByUsuarioId, setFichaAtiva, updateFicha } from '../../services/fichaService';
import { getTreinosByUsuarioId, updateTreino } from '../../services/treinoService';
import { useAuth } from '../authprovider';

const DIAS_SEMANA_ORDEM: { [key: string]: number } = {
  'dom': 0, 'seg': 1, 'ter': 2, 'qua': 3, 'qui': 4, 'sex': 5, 'sab': 6
};

interface Folder {
  id: string;
  type: 'ficha' | 'unassigned';
  nome: string;
  treinos: Treino[];
  fichaId?: string;
}

interface DisplayItem {
  type: 'folder' | 'workout' | 'add_unassigned_workout_button';
  id: string;
  data: Folder | Treino | null;
  isExpanded?: boolean;
  isPrincipal?: boolean;
}

export default function MeusTreinosScreen() {
  const { user, initialized: authInitialized } = useAuth();
  const router = useRouter();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);

  // Estado para a pasta expandida
  const [expandedFolderId, setExpandedFolderId] = useState<string | null>(null);

  // Estado para a ficha ativa (para o tag "principal")
  const [activeFicha, setActiveFicha] = useState<Ficha | null>(null);


  useFocusEffect(
    useCallback(() => {
      const fetchData = async () => {
        if (!authInitialized) {
          return;
        }
  
        if (!user) { setLoading(false); return; }
  
        setLoading(true);
        try {
          const [todasAsFichasDoUsuario, todosOsTreinosDoUsuario, fichaAtivaDoUsuario] = await Promise.all([
            getFichasByUsuarioId(user.id),
            getTreinosByUsuarioId(user.id),
            getFichaAtiva(user.id),
          ]);
  
          // Se o usuário não tiver nenhum treino, redireciona para a tela de criação.
          if (todosOsTreinosDoUsuario.length === 0) {
            router.push('/(treino)/modals/OpcoesTreino');
            return; // Interrompe a execução para evitar setar estados desnecessários
          }

          // Set active ficha
          setActiveFicha(fichaAtivaDoUsuario);

          // Define a pasta expandida padrão
          if (fichaAtivaDoUsuario) {
            setExpandedFolderId(fichaAtivaDoUsuario.id);
          } else {
            setExpandedFolderId('unassigned'); // Se não houver ficha principal, expande "Meus Treinos"
          }

          // Cria as pastas baseadas nas fichas do usuário
          const fichaFolders: Folder[] = todasAsFichasDoUsuario.map((ficha: Ficha) => {
            // Filtra os treinos que pertencem a esta ficha
            const treinosDaFicha = todosOsTreinosDoUsuario.filter(
              (treino) => treino.fichaId === ficha.id
            );
            return { id: ficha.id, type: 'ficha', nome: ficha.nome, treinos: treinosDaFicha };
          });
  
          // Filtra todos os treinos que não têm um fichaId para a pasta de avulsos.
          const treinosAvulsos = todosOsTreinosDoUsuario.filter(
            (treino) => !treino.fichaId
          );
  
          // Cria a pasta "Meus Treinos" (avulsos) e garante que ela sempre exista.
          const pastaAvulsa: Folder = { id: 'unassigned', type: 'unassigned', nome: 'Meus Treinos', treinos: treinosAvulsos };
  
          setFolders([...fichaFolders, pastaAvulsa]);
        } catch (err) {
          console.error("Erro ao carregar dados dos treinos:", err);
        } finally {
          setLoading(false);
        }
      };
  
      fetchData();
    }, [user, authInitialized])
  );

  const handleFichaAction = async (action: FichaMenuAction, folderId: string) => {
    if (!user) return;

    const ficha = folders.find(f => f.id === folderId);
    if (!ficha) return;

    switch (action) {
      case 'set-active':
        try {
          // A função setFichaAtiva já retorna a ficha atualizada.
          const fichaAtualizada = await setFichaAtiva(user.id, folderId);
          if (fichaAtualizada) {
            // Usamos o retorno da função para garantir que o tipo está correto.
            setActiveFicha(fichaAtualizada);
          }
          Alert.alert("Sucesso", `"${ficha.nome}" é agora sua ficha principal.`);
        } catch (error) {
          console.error("Erro ao definir ficha ativa:", error);
          Alert.alert("Erro", "Não foi possível definir a ficha como principal.");
        }
        break;

      case 'rename':
        // Lógica para renomear (ex: abrir um modal com input)
        Alert.prompt(
          "Alterar Nome",
          "Digite o novo nome para a ficha:",
          async (newName) => {
            if (newName && newName.trim() !== "") {
              await updateFicha(folderId, { nome: newName.trim() });
              // Forçar recarregamento para ver a mudança
              setFolders([]); 
            }
          },
          'plain-text',
          ficha.nome
        );
        break;

      case 'share':
        Share.share({ message: `Confira minha ficha de treino "${ficha.nome}" no GymBeat!` });
        break;

      case 'delete':
        Alert.alert("Deletar Ficha", `Tem certeza que deseja deletar a ficha "${ficha.nome}"? Todos os treinos nela serão movidos para "Meus Treinos".`, [{ text: "Cancelar", style: "cancel" }, {
          text: "Deletar", style: "destructive", onPress: async () => {
            const treinoIds = ficha.treinos.map(t => t.id);
            await deleteFicha(folderId, treinoIds); setFolders([]);
          }
        }]);
        break;
    }
  };

  const handleFolderPress = (folderId: string) => {
    // Adiciona feedback tátil ao expandir/recolher
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Toggle expansion
    setExpandedFolderId(expandedFolderId === folderId ? null : folderId);
  };

  const handleEditWorkout = (treinoId: string, fichaId?: string) => {
    router.push({
      pathname: '/(treino)/editarTreino',
      params: { treinoId, isModal: 'true' }
    });
  };

  const handleAddNewUnassignedWorkout = () => {
    router.push({
      pathname: '/(treino)/editarTreino',
      params: { isModal: 'true' }
    });
  };

  const handleDragEnd = async ({ data: newDisplayItems, from, to }: { data: DisplayItem[], from: number, to: number }) => {
    // Encontra o item que foi arrastado a partir do estado original
    const draggedItem = displayItems[from];
    if (draggedItem.type !== 'workout') {
      // Se não for um treino, não faz nada (não deveria acontecer)
      return;
    }
  
    // Encontra a nova pasta de destino
    const newParentFolderItem = newDisplayItems.slice(0, to).reverse().find(d => d.type === 'folder');
  
    // 1. Impede que o treino seja solto fora de uma pasta
    if (!newParentFolderItem) {
      Alert.alert("Movimento Inválido", "Um treino deve sempre pertencer a uma pasta.");
      // Não atualiza o estado, revertendo visualmente a ação.
      return;
    }
  
    // 2. Atualiza a UI otimistamente para a mudança ser instantânea
    setFolders(prevFolders => {
      const newFoldersState = JSON.parse(JSON.stringify(prevFolders)); // Deep copy para evitar mutação
  
      const originalParentFolder = newFoldersState.find((f: Folder) => f.treinos.some((t: Treino) => t.id === draggedItem.id)) as Folder | undefined;
  
      if (originalParentFolder) {
        // Remove o treino da pasta original
        originalParentFolder.treinos = originalParentFolder.treinos.filter((t: Treino) => t.id !== draggedItem.id);
      }
  
      // Adiciona o treino à nova pasta
      const targetFolder = newFoldersState.find((f: Folder) => f.id === newParentFolderItem.id) as Folder | undefined;
      if (targetFolder) {
        targetFolder.treinos.push(draggedItem.data as Treino);
      }
      
      return newFoldersState;
    });
  
    const treinoId = draggedItem.id;
    // CORREÇÃO: Garante que o valor seja `null` para 'unassigned', e não `undefined`.
    const targetFichaId = newParentFolderItem.id === 'unassigned' ? null : newParentFolderItem.id;
  
    try {
      // 3. Atualiza o backend
      // Primeiro, atualiza o documento do treino para refletir a nova ficha
      await updateTreino(treinoId, { fichaId: targetFichaId ?? undefined });

      // Encontra as fichas (documentos) originais para atualizar seus arrays de treinos
      const originalParentFolderDoc = folders.find(f => f.treinos.some(t => t.id === draggedItem.id));

      // Remove o treino da ficha antiga no Firestore
      if (originalParentFolderDoc && originalParentFolderDoc.type === 'ficha') {
        const treinosAtualizados = originalParentFolderDoc.treinos.filter(t => t.id !== treinoId).map(t => t.id);
        await updateFicha(originalParentFolderDoc.id, { treinos: treinosAtualizados });
      }

      // Adiciona o treino à nova ficha no Firestore
      if (targetFichaId) {
        const targetFichaDoc = folders.find(f => f.id === targetFichaId);
        if (targetFichaDoc) {
          const treinosAtualizados = [...targetFichaDoc.treinos.map(t => t.id), treinoId];
          await updateFicha(targetFichaId, { treinos: treinosAtualizados });
        }
      }
  
      // A UI já foi atualizada otimistamente. Apenas confirmamos.
      // Se a operação falhar, o bloco catch irá lidar com isso.
  
    } catch (error) {
      console.error("Erro ao mover o treino:", error);
      Alert.alert("Erro", "Não foi possível mover o treino. Tente novamente.");
      // Em caso de erro, força o recarregamento para buscar o estado real do banco de dados.
      setFolders([]);
    }
  };

  const displayItems = useMemo(() => {
    const items: DisplayItem[] = [];
    folders.forEach(folder => {
      const isExpanded = folder.id === expandedFolderId;
      const isPrincipal = folder.type === 'ficha' && activeFicha?.id === folder.id;
      items.push({ type: 'folder', id: folder.id, data: folder, isExpanded, isPrincipal });

      if (isExpanded) {
        folder.treinos.forEach(treino => {
          items.push({ type: 'workout', id: treino.id, data: treino });
        });
      }
    });
    return items;
  }, [folders, expandedFolderId, activeFicha]);

  const handleFolderOptions = (folderId: string) => {
    console.log("Opções da pasta:", folderId);
  };

  if (loading) {
    return <View style={styles.centeredContainer}><ActivityIndicator size="large" color="#00A6FF" /></View>;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.container}>
        <View style={styles.headerContainer}>
          <Text style={styles.headerTitle}>Meus treinos</Text>
          <TouchableOpacity style={styles.addButton} onPress={() => router.push('/(treino)/modals/OpcoesTreino')}>
            <FontAwesome name="plus" size={18} color="#FBFBFB" />
          </TouchableOpacity>
        </View>

        <DraggableFlatList
          data={displayItems}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 15, paddingTop: 10 }}
          onDragEnd={handleDragEnd}
          renderItem={({ item, drag, isActive }: RenderItemParams<DisplayItem>) => {
            if (item.type === 'folder') {
              return (
                <View
                  // Adiciona uma key única para o wrapper para ajudar o React a identificar o item
                  key={`folder-wrapper-${item.id}`}
                  style={styles.folderWrapper}
                >
                  <TouchableOpacity style={styles.folderCard} onPress={() => handleFolderPress(item.id)}>
                    <View style={styles.folderInfo}>
                      <FontAwesome name={item.isExpanded ? "arrow-up" : "arrow-down"} size={16} color="#555" />
                      <Text style={styles.folderName}>{(item.data as Folder).nome}</Text>
                      {item.isPrincipal && <Text style={styles.principalTag}>principal</Text>}
                    </View>
                    {(item.data as Folder).type === 'ficha' && (
                      <FichaOptionsMenu
                        isPrincipal={!!item.isPrincipal}
                        onSelect={(action) => handleFichaAction(action, item.id)}
                      />
                    )}
                  </TouchableOpacity>
                </View>
              );
            }

            if (item.type === 'workout') {
              return (
                <ScaleDecorator key={`workout-decorator-${item.id}`}>
                  <TouchableOpacity
                    onLongPress={() => {
                      // Adiciona o feedback tátil ao iniciar o arrasto
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      drag();
                    }}
                    disabled={isActive}
                    style={[styles.workoutCard, { opacity: isActive ? 0.5 : 1 }]}
                    onPress={() => router.push({ pathname: '/(treino)/editarTreino', params: { treinoId: item.id, fichaId: (item.data as Treino).fichaId, isModal: 'true', fromConfig: 'true' } })}
                  >
                    <View style={styles.workoutCardContent}>
                      <Text style={styles.workoutCardTitle}>{(item.data as Treino).nome}</Text>
                      <Text style={styles.workoutCardSubtitle}>
                        {(item.data as Treino).diasSemana.length > 0
                          ? (item.data as Treino).diasSemana.join(', ').toUpperCase()
                          : 'Sem dia definido'}
                      </Text>
                    </View>
                    <FontAwesome name="chevron-right" size={18} color="#555" />
                  </TouchableOpacity>
                </ScaleDecorator>
              );
            }

            return null;
          }}
          ListFooterComponent={<View style={{ height: 20 }} />}
        />
        <OngoingWorkoutFooter />
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
    headerContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 15,
      paddingTop: '15%',
      marginBottom: 10,
    },
    headerTitle: {
      color: '#FBFBFB',
      fontSize: 40,
      fontWeight: 'bold',
    },
    folderWrapper: {
      marginBottom: 0,
    },
    
    folderCard: {
      backgroundColor: 'transparent',
      paddingTop: 20,
      paddingBottom: 20,
      flexDirection: 'row',
      alignItems: 'center',
      borderBottomWidth: 0.5,
      borderBottomColor: '#ffffff1a',
    },
    folderOptionsButton: {
    },
    folderInfo: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center', // Alinha os itens verticalmente
      gap: 15, // Adiciona espaço entre a seta e o nome
    },
    folderName: {
      color: '#fff',
      fontSize: 16,
      fontWeight: 'bold', // O nome da pasta
    },
    principalTag: {
      color: '#aaa',
      fontSize: 10,
      fontWeight: '300',
      marginLeft: 8,
      textTransform: 'lowercase',
    },
    folderDetail: {
      color: '#aaa',
      fontSize: 12,
      marginTop: 4,
    },
    workoutWrapper: {},
    workoutCard: {
      marginTop:8,
      backgroundColor: '#141414',
      borderRadius: 25,
      paddingVertical: 15,
      height:72,
      paddingHorizontal: 20,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginVertical: 5,
      borderWidth: 0.5,
      borderColor: '#ffffff1a',
    },
    workoutCardContent: {
      flex: 1,
    },
    workoutCardTitle: {
      color: '#FBFBFB',
      fontSize: 16,
      fontWeight: '600',
    },
    workoutCardSubtitle: {
      color: '#FBFBFB',
      fontSize: 10,
      fontWeight: '300',
      opacity: 0.7,
      marginTop: 4,
    },
    container: {
        flex: 1,
        backgroundColor: '#030405',
    },
    mainTitle: {
      fontSize: 40,
      fontWeight: 'bold',
      color: '#fff',
      paddingHorizontal: 15,
      marginBottom: 20,
    },
    centeredContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#030405',
    },
    addButton: {
      backgroundColor: '#141414',
      borderRadius: 110,
      borderColor: '#ffffff1a',
      borderWidth: 0.5,
      width: 36,
      height: 36,
      justifyContent: 'center',
      alignItems: 'center',
    },
    emptyContainer: {
        paddingVertical: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#141414',
        borderRadius: 12,
    },
    emptyText: {
        color: '#aaa',
        textAlign: 'center',
        fontSize: 16,
    },
    emptySubText: {
        color: '#888',
        textAlign: 'center',
        marginTop: 8,
        paddingHorizontal: 20,
    },
    addWorkoutButton: {
      backgroundColor: 'transparent',
      borderRadius: 12,
      padding: 15,
      marginTop: 20,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      borderWidth: 1,
      borderColor: '#ffffff1a',
    },
    addWorkoutButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: 'bold',
    },
    configButton: {
      padding: 10,
    },
});