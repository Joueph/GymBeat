import { FontAwesome, Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { FichaMenuAction, FichaOptionsMenu } from '../../components/FichaOptionsMenu';

import { OngoingWorkoutFooter } from '../../components/OngoingWorkoutFooter';
import { Ficha } from '../../models/ficha';
import { Treino } from '../../models/treino'; // CORREÇÃO: Importa a função com o nome correto
import { deleteFicha, getFichaAtiva, getFichasByUsuarioId, setFichaAtiva, updateFicha } from '../../services/fichaService';
import { getCachedFichaAtiva, getCachedUserFichas, getCachedUserTreinos } from '../../services/offlineCacheService';
import { getTreinosByUsuarioId, updateTreino, updateTreinosOrdem } from '../../services/treinoService';
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
  const [refreshing, setRefreshing] = useState(false); // For background refresh when data already exists
  const [loading, setLoading] = useState(true);

  // Estado para a pasta expandida
  const [expandedFolderId, setExpandedFolderId] = useState<string | null>(null);

  // Estado para a ficha ativa (para o tag "principal")
  const [activeFicha, setActiveFicha] = useState<Ficha | null>(null);
  const isInitialMount = useRef(true); // To track if it's the very first mount of the component

  // ... imports

  const fetchData = useCallback(async (isBackgroundRefresh = false) => {
    if (!user) {
      setLoading(false);
      return;
    }

    // 1. Initial Cache Load (Offline First) - Only run if initial mount or explicit non-background refresh
    if (isInitialMount.current && !isBackgroundRefresh) {
      try {
        console.log('[treinoHoje] Loading from cache first...');
        const [cachedFichas, cachedTreinos, cachedFichaAtiva] = await Promise.all([
          getCachedUserFichas(user.id),
          getCachedUserTreinos(user.id),
          getCachedFichaAtiva()
        ]);

        if (cachedFichas.length > 0 || cachedTreinos.length > 0) {
          processData(cachedFichas, cachedTreinos, cachedFichaAtiva);
          setLoading(false); // Show content immediately
        }
      } catch (e) {
        console.warn('[treinoHoje] Failed to load cache:', e);
      }
    }

    // Standard loading indicator only if we didn't load from cache yet and it's not a background refresh
    // Se isInitialMount (mount) E não mostramos cache (loading=true), mostramos spinner.
    // Se já mostramos cache (loading=false), mantemos false.
    // Se background refresh, loading é false, refreshing é true.

    if (loading && !isInitialMount.current) {
      // Already showed cache, keep loading false.
    } else if (isInitialMount.current) {
      // If we didn't find cache (folders empty), keep loading true.
      // If we found cache, we set loading false above.
    } else if (isBackgroundRefresh) {
      setRefreshing(true);
    }

    // 2. Network Fetch (Silent Update)
    try {
      const [todasAsFichasDoUsuario, todosOsTreinosDoUsuario, fichaAtivaDoUsuario] = await Promise.all([
        getFichasByUsuarioId(user.id),
        getTreinosByUsuarioId(user.id),
        getFichaAtiva(user.id),
      ]);

      processData(todasAsFichasDoUsuario, todosOsTreinosDoUsuario, fichaAtivaDoUsuario);

    } catch (err) {
      console.error("[treinoHoje] Erro ao carregar dados online:", err);
      // No alert needed, we are showing cached data or handling it gracefully
    } finally {
      setLoading(false);
      setRefreshing(false);
      isInitialMount.current = false;
    }
  }, [user, router, loading]); // Dependencies

  const processData = (fichas: Ficha[], treinos: Treino[], fichaAtiva: Ficha | null) => {
    setActiveFicha(fichaAtiva);

    if (isInitialMount.current) {
      if (fichaAtiva) {
        setExpandedFolderId(fichaAtiva.id);
      } else {
        setExpandedFolderId('unassigned');
      }
    }

    const treinosMap = new Map(treinos.map((t: Treino) => [t.id, t]));
    const fichaFolders: Folder[] = fichas.map((ficha: Ficha) => {
      const treinosDaFicha = (ficha.treinos || [])
        .map(treinoId => treinosMap.get(treinoId))
        .filter((t): t is Treino => !!t);
      return { id: ficha.id, type: 'ficha', nome: ficha.nome, treinos: treinosDaFicha };
    });

    const treinosAvulsos = treinos.filter((treino: Treino) => !treino.fichaId);
    fichaFolders.sort((a, b) => a.nome.localeCompare(b.nome));
    const pastaAvulsa: Folder = { id: 'unassigned', type: 'unassigned', nome: 'Meus Treinos', treinos: treinosAvulsos };
    const allFolders = [...fichaFolders, pastaAvulsa];

    setFolders(allFolders);
  };

  useFocusEffect(
    useCallback(() => {
      if (authInitialized) {
        fetchData(true); // Pass true to indicate a background refresh on focus
      }
    }, [authInitialized, fetchData])
  );

  const handleFichaAction = async (action: FichaMenuAction, folderId: string) => {
    if (!user) return;

    const ficha = folders.find(f => f.id === folderId);
    if (!ficha) return;

    switch (action) {
      case 'set-active':
        try {
          // Importa o módulo de rede para verificar a conexão
          const Network = await import('expo-network');
          const networkState = await Network.getNetworkStateAsync();
          const isOffline = !networkState.isConnected;

          if (isOffline) {
            Alert.alert("Offline", "Você precisa estar online para alterar a ficha principal.");
            return;
          }

          const fichaAtualizada = await setFichaAtiva(user.id, folderId);
          if (fichaAtualizada) {
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
              // Refresh data in the background to show the change
              fetchData(true);
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
            const treinoIds = ficha.treinos.map(t => t.id); // Get IDs of workouts in this ficha
            await deleteFicha(folderId, treinoIds);
            fetchData(true); // Refresh data in the background
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
    const draggedItem = displayItems[from];
    if (draggedItem.type !== 'workout' || !draggedItem.data) return;

    const originalParentFolderItem = displayItems.slice(0, from).reverse().find(d => d.type === 'folder');
    const newParentFolderItem = newDisplayItems.slice(0, to).reverse().find(d => d.type === 'folder');

    // 🚫 Caso o treino tenha sido solto fora de qualquer pasta
    if (!newParentFolderItem?.id || !originalParentFolderItem?.id) {
      // Retorna imediatamente o treino para o estado anterior (sem popup, sem reload)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setFolders(prev => [...prev]); // força re-render rápido
      return;
    }

    const isReorder = originalParentFolderItem.id === newParentFolderItem.id;
    const newFoldersState = JSON.parse(JSON.stringify(folders));

    const originalFolderIndex = newFoldersState.findIndex((f: Folder) => f.id === originalParentFolderItem.id);
    const targetFolderIndex = isReorder ? originalFolderIndex : newFoldersState.findIndex((f: Folder) => f.id === newParentFolderItem.id);

    if (originalFolderIndex === -1 || targetFolderIndex === -1) return;

    const workoutIndex = newFoldersState[originalFolderIndex].treinos.findIndex((t: Treino) => t.id === draggedItem.id);
    const [workout] = newFoldersState[originalFolderIndex].treinos.splice(workoutIndex, 1);

    if (isReorder) {
      const targetIndex = newDisplayItems
        .slice(0, to)
        .filter(item => item.type === 'workout' && (item.data as Treino).fichaId === originalParentFolderItem.id)
        .length;
      newFoldersState[targetFolderIndex].treinos.splice(targetIndex, 0, workout);
    } else {
      newFoldersState[targetFolderIndex].treinos.push(workout);
    }

    setFolders(newFoldersState);

    try {
      if (isReorder) {
        const reorderedWorkoutIds = newFoldersState[targetFolderIndex].treinos.map((t: Treino) => t.id);
        if (newFoldersState[targetFolderIndex].type === 'ficha') {
          await updateFicha(newFoldersState[targetFolderIndex].id, { treinos: reorderedWorkoutIds });
        } else {
          await updateTreinosOrdem(reorderedWorkoutIds);
        }
      } else {
        const treinoId = draggedItem.id;
        const newFichaId = newParentFolderItem.id === 'unassigned' ? null : newParentFolderItem.id;
        await updateTreino(treinoId, { fichaId: newFichaId ?? undefined });

        if ((originalParentFolderItem.data as Folder).type === 'ficha') {
          const originalTreinoIds = newFoldersState[originalFolderIndex].treinos.map((t: Treino) => t.id);
          await updateFicha(originalParentFolderItem.id, { treinos: originalTreinoIds });
        }

        if (newFoldersState[targetFolderIndex].type === 'ficha') {
          const targetTreinoIds = newFoldersState[targetFolderIndex].treinos.map((t: Treino) => t.id);
          await updateFicha(newFoldersState[targetFolderIndex].id, { treinos: targetTreinoIds });
        }
      }
    } catch (error) {
      console.error("Erro ao mover/reordenar treino:", error);
      setFolders(folders); // reverte visualmente sem quebrar
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

  return ( // Main render
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.container}>
        <View style={styles.headerContainer}>
          <Text style={styles.headerTitle}>Meus treinos</Text>
          <TouchableOpacity style={styles.addButton} onPress={() => router.push('/(treino)/modals/OpcoesTreino')}>
            <FontAwesome name="plus" size={18} color="#FBFBFB" />
          </TouchableOpacity>
        </View>

        {refreshing && ( // Show a small indicator for background refresh
          <ActivityIndicator size="small" color="#00A6FF" style={{ marginTop: 10, marginBottom: 10 }} />
        )}

        {folders.length === 0 && !loading && !refreshing ? ( // Show empty state if no folders and not loading/refreshing
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Nenhum treino encontrado.</Text>
            <Text style={styles.emptySubText}>Crie seu primeiro treino para começar!</Text>
            <TouchableOpacity style={styles.addWorkoutButton} onPress={() => router.push('/(treino)/modals/OpcoesTreino')}>
              <FontAwesome name="plus" size={18} color="#fff" />
              <Text style={styles.addWorkoutButtonText}>Criar Treino</Text>
            </TouchableOpacity>
          </View>
        ) : (
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
                        <Ionicons name={item.isExpanded ? "arrow-up" : "arrow-down"} size={16} color="#555" />
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
                const index = (displayItems.filter(i => i.type === 'workout' && i.id !== item.id && (i.data as Treino).fichaId === (item.data as Treino).fichaId).findIndex(i => i.id === item.id) + 1) || 0;
                return (
                  <Animated.View entering={FadeInUp.duration(300).delay(index * 50)}>
                    <ScaleDecorator key={`workout-decorator-${item.id}`}>
                      <TouchableOpacity
                        onLongPress={() => {
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
                  </Animated.View>
                );
              }

              return null;
            }}
            ListFooterComponent={<View style={{ height: 20 }} />}
          />
        )}
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
    paddingHorizontal: 16,
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
    marginTop: 8,
    backgroundColor: '#1A1D23',
    borderRadius: 25,
    paddingVertical: 15,
    height: 72,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 5,
    borderWidth: 0.5,
    borderColor: '#2A2E37',
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
    backgroundColor: '#0B0D10',
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