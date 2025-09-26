import { FontAwesome } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import React, { useCallback, useLayoutEffect, useState } from 'react';
import { ActivityIndicator, Alert, Animated, FlatList, ImageBackground, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { GestureHandlerRootView, RectButton, Swipeable } from 'react-native-gesture-handler';
import { Exercicio } from '../../models/exercicio';
import { Ficha } from '../../models/ficha';
import { Log } from '../../models/log';
import { Treino } from '../../models/treino';
import { addFicha, getFichaAtiva, getFichasByUsuarioId, setFichaAtiva as setFichaAtivaService } from '../../services/fichaService';
import { getLogsByUsuarioId } from '../../services/logService';
import { DiaSemana, getTreinosByIds } from '../../services/treinoService';
import { useAuth } from '../authprovider';


const DIAS_SEMANA_ORDEM: { [key: string]: number } = {
  'dom': 0, 'seg': 1, 'ter': 2, 'qua': 3, 'qui': 4, 'sex': 5, 'sab': 6
};

const DIAS_SEMANA_MAP: { [key: number]: string } = {
  0: 'dom', 1: 'seg', 2: 'ter', 3: 'qua', 4: 'qui', 5: 'sex', 6: 'sab'
};

const AnimatedIcon = Animated.createAnimatedComponent(FontAwesome);

// Helper para converter Timestamps do Firestore e outros formatos para um objeto Date.
const toDate = (date: any): Date | null => {
  if (!date) return null;
  if (typeof date.toDate === 'function') return date.toDate();
  const d = new Date(date);
  return isNaN(d.getTime()) ? null : d;
};

const LogItem = ({ log }: { log: Log }) => {
  const [expanded, setExpanded] = useState(false);

  const getMaxWeight = (exercicio: Exercicio) => {
    if (!exercicio.series || exercicio.series.length === 0) {
      return 0;
    }
    // @ts-ignore - Lida com a estrutura antiga de dados para compatibilidade
    if (typeof exercicio.series === 'number') {
        return (exercicio as any).peso || 0;
    }
    return Math.max(...exercicio.series.map(s => s.peso || 0));
  };

  const logDate = toDate(log.horarioFim) || new Date();
  const startTime = toDate(log.horarioInicio);
  const endTime = toDate(log.horarioFim);
  let durationText = '';
  if (startTime && endTime) {
    const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000);
    durationText = ` • ${durationMinutes} min`;
  }

  return (
    <View style={styles.logCard}>
      <TouchableOpacity onPress={() => setExpanded(!expanded)} style={styles.logHeader}>
        <View>
          <Text style={styles.logTitle}>{log.treino.nome}</Text>
          <Text style={styles.logDate}>
            {logDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}{durationText}
          </Text>
        </View>
        <FontAwesome name={expanded ? "chevron-up" : "chevron-down"} size={16} color="#ccc" />
      </TouchableOpacity>
      {expanded && (
        <View style={styles.logDetails}>
          {log.exerciciosFeitos.map((ex, index) => (
            <View key={index} style={styles.logExercicio}>
              <Text style={styles.logExercicioName}>{ex.modelo.nome}</Text>
              <Text style={styles.logExercicioInfo}>Carga Máx: {getMaxWeight(ex)} kg</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

export default function MeusTreinosScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const navigation = useNavigation();
  const [fichaAtiva, setFichaAtiva] = useState<Ficha | null>(null);
  const [userFichas, setUserFichas] = useState<Ficha[]>([]);
  const [treinoDeHoje, setTreinoDeHoje] = useState<Treino | null>(null);
  const [outrosTreinos, setOutrosTreinos] = useState<Treino[]>([]);
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<Log[]>([]);

  const handleCreateNewFicha = async () => {
    if (!user) return;
    try {
      const expirationDate = new Date();
      expirationDate.setMonth(expirationDate.getMonth() + 2);
      const newFichaId = await addFicha({
        usuarioId: user.uid,
        nome: 'Nova Ficha (Edite)',
        treinos: [],
        dataExpiracao: expirationDate,
        opcoes: 'Programa de treinamento',
        ativa: false
      });

      if (newFichaId) {
        router.push({ pathname: '/treino/criatFicha', params: { fichaId: newFichaId } });
      }
    } catch (error) {
      console.error("Erro ao criar nova ficha:", error);
    }
  };

  useLayoutEffect(() => {
    navigation.setOptions({
        headerRight: () => (
            <TouchableOpacity onPress={handleCreateNewFicha} style={{ marginRight: 20, padding: 5 }}>
                <FontAwesome name="plus" size={15} color="#fff" />
            </TouchableOpacity>
        ),
    });
  }, [navigation, user]);

  useFocusEffect(
    useCallback(() => {
      const fetchData = async () => {
        if (!user) {
          setLoading(false);
          return;
        }
        setLoading(true);
        try {
          const [ativa, minhasFichas, userLogs] = await Promise.all([
            getFichaAtiva(user.uid),
            getFichasByUsuarioId(user.uid),
            getLogsByUsuarioId(user.uid)
          ]);

          setFichaAtiva(ativa);
          setUserFichas(minhasFichas.sort((a, b) => (a.ativa === b.ativa) ? 0 : (a.ativa ? -1 : 1)));
          setLogs(userLogs.sort((a, b) => (toDate(b.horarioFim)?.getTime() || 0) - (toDate(a.horarioFim)?.getTime() || 0)));

          setTreinoDeHoje(null);
          setOutrosTreinos([]);

          if (ativa && ativa.treinos.length > 0) {
            const treinosData = await getTreinosByIds(ativa.treinos);

            // Ordena os treinos por dia da semana
            treinosData.sort((a, b) => {
                const diaA = a.diasSemana[0];
                const diaB = b.diasSemana[0];
                return (DIAS_SEMANA_ORDEM[diaA] ?? 7) - (DIAS_SEMANA_ORDEM[diaB] ?? 7);
            });

            // Encontra o treino de hoje
            const hoje = new Date().getDay();
            const diaString = DIAS_SEMANA_MAP[hoje] as DiaSemana;
            const treinoDoDia = treinosData.find(t => t.diasSemana.includes(diaString));

            setTreinoDeHoje(treinoDoDia || null);
            // Define os outros treinos, excluindo o de hoje
            setOutrosTreinos(treinosData.filter(t => t.id !== treinoDoDia?.id));
          }
        } catch (err) {
          console.error("Erro ao carregar dados do treino:", err);
          Alert.alert("Erro", "Não foi possível carregar os dados de treino.");
        } finally {
          setLoading(false);
        }
      };
      fetchData();
    }, [user])
  );

  const handleSetFichaAtiva = async (fichaId: string) => {
    if (!user) return;
    const originalFichas = [...userFichas];
    // Atualização otimista da UI
    const newFichas = userFichas.map(f => ({ ...f, ativa: f.id === fichaId }));
    setUserFichas(newFichas.sort((a, b) => (a.ativa === b.ativa) ? 0 : (a.ativa ? -1 : 1)));

    try {
      await setFichaAtivaService(user.uid, fichaId);
      const novaFichaAtiva = newFichas.find(f => f.id === fichaId) || null;
      setFichaAtiva(novaFichaAtiva);

      // Atualiza os treinos da semana com base na nova ficha ativa
      if (novaFichaAtiva && novaFichaAtiva.treinos.length > 0) {
        const treinosData = await getTreinosByIds(novaFichaAtiva.treinos);
        treinosData.sort((a, b) => {
            const diaA = a.diasSemana[0];
            const diaB = b.diasSemana[0];
            return (DIAS_SEMANA_ORDEM[diaA] ?? 7) - (DIAS_SEMANA_ORDEM[diaB] ?? 7);
        });
        const hoje = new Date().getDay();
        const diaString = DIAS_SEMANA_MAP[hoje] as DiaSemana;
        const treinoDoDia = treinosData.find(t => t.diasSemana.includes(diaString));
        setTreinoDeHoje(treinoDoDia || null);
        setOutrosTreinos(treinosData.filter(t => t.id !== treinoDoDia?.id));
      } else {
        setTreinoDeHoje(null);
        setOutrosTreinos([]);
      }
    } catch (error) {
      console.error("Erro ao ativar ficha:", error);
      Alert.alert("Erro", "Não foi possível ativar a ficha.");
      // Reverte em caso de erro
      setUserFichas(originalFichas);
    }
  };

  const handleEditFicha = (fichaId: string) => {
    router.push({ pathname: '/treino/criatFicha', params: { fichaId: fichaId } });
  };

  const renderEditAction = (progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>, fichaId: string) => {
    const scale = dragX.interpolate({
      inputRange: [0, 80],
      outputRange: [0, 1],
      extrapolate: 'clamp',
    });

    return (
      <RectButton style={styles.editBox} onPress={() => handleEditFicha(fichaId)}>
        <AnimatedIcon name="pencil" size={28} color="white" style={{ transform: [{ scale }] }} />
      </RectButton>
    );
  };

  const renderActivateAction = (progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>, ficha: Ficha) => {
    if (ficha.ativa) {
      return null;
    }
    const scale = dragX.interpolate({
      inputRange: [0, 80],
      outputRange: [0, 1],
      extrapolate: 'clamp',
    });

    return (
      <RectButton style={styles.activateBox} onPress={() => handleSetFichaAtiva(ficha.id)}>
        <AnimatedIcon name="check" size={28} color="white" style={{ transform: [{ scale }] }} />
      </RectButton>
    );
  };

  const renderUserFichaItem = ({ item }: { item: Ficha }) => (
    <Swipeable
      renderLeftActions={(progress, dragX) => renderActivateAction(progress, dragX, item)}
      overshootLeft={false}
      enabled={!item.ativa}
    >
      <TouchableOpacity style={styles.card} onPress={() => router.push({ pathname: '/treino/criatFicha', params: { fichaId: item.id } })}>
        {item.ativa && <View style={styles.activeIndicator} />}
        <View style={styles.cardContent}>
          <View>
            <Text style={styles.cardTitle}>{item.nome}</Text>
            <Text style={styles.cardDetailText}>{item.treinos.length} {item.treinos.length === 1 ? 'treino' : 'treinos'}</Text>
          </View>
          {!item.ativa && (
            <View style={styles.swipeIndicator}>
              <FontAwesome name="hand-o-left" size={16} color="#ccc" />
              <Text style={styles.swipeIndicatorText}>Ativar</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    </Swipeable>
  );

  if (loading) {
    return <ActivityIndicator style={styles.container} size="large" color="#fff" />;
  }

  const totalTreinos = outrosTreinos.length + (treinoDeHoje ? 1 : 0);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ScrollView style={styles.container}>
        <Text style={styles.sectionTitle}>Meus Planos</Text>
        {userFichas.length > 0 ? (
          <FlatList
            data={userFichas}
            renderItem={renderUserFichaItem}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            extraData={userFichas}
            style={{ marginBottom: 20 }}
          />
        ) : ( // Changed from styles.emptyContainer to styles.emptyTreinoContainer
          <View style={styles.emptyTreinoContainer}>
            <Text style={styles.emptyText}>Você ainda não possui fichas.</Text>
            <Text style={styles.emptySubText}>Copie um modelo da aba 'Treinos' ou crie uma do zero na tela Home.</Text>
          </View>
        )}

        {fichaAtiva ? (
          <>
            <View style={{ marginBottom: 20 }}>
              <TouchableOpacity
                onPress={() => handleEditFicha(fichaAtiva.id)}
              >
                <ImageBackground 
                  source={{ uri: fichaAtiva.imagemUrl || undefined }} 
                  style={styles.cardFichaAtiva} 
                  imageStyle={{ borderRadius: 12 }}
                >
                  <View style={styles.editIconContainer}>
                    <FontAwesome name="pencil" size={22} color="#fff" />
                  </View>
                  <View style={styles.cardOverlay}>
                    <Text style={styles.fichaAtivaLabel}>PLANO ATIVO</Text>
                    <Text style={styles.fichaAtivaTitle}>{fichaAtiva.nome}</Text>
                    <Text style={styles.fichaAtivaSubtitle}>
                      {totalTreinos} {totalTreinos === 1 ? 'treino' : 'treinos'}
                    </Text>
                  </View>
                </ImageBackground>
              </TouchableOpacity>
            </View>

            {treinoDeHoje && (
              <View style={{ marginBottom: 30 }}>
                <Text style={styles.sectionTitle}>🔥 Treino de Hoje</Text>
                <TouchableOpacity onPress={() => router.push(`/treino/ongoingWorkout?fichaId=${fichaAtiva.id}&treinoId=${treinoDeHoje.id}`)}>
                  <View style={styles.cardTreinoHoje}>
                    <View>
                      <Text style={styles.treinoHojeTitle}>{treinoDeHoje.nome}</Text>
                      <Text style={styles.treinoHojeInfo}>{treinoDeHoje.exercicios.length} {treinoDeHoje.exercicios.length === 1 ? 'exercício' : 'exercícios'}</Text>
                    </View>
                    <FontAwesome name="chevron-right" size={20} color="#fff" />
                  </View>
                </TouchableOpacity>
              </View>
            )}

            {outrosTreinos.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Outros Treinos da Semana</Text>
                {outrosTreinos.map(treino => (
                  <TouchableOpacity key={treino.id} onPress={() => router.push(`/treino/ongoingWorkout?fichaId=${fichaAtiva.id}&treinoId=${treino.id}`)}>
                    <View style={styles.otherWorkoutCard}>
                      <View>
                        <Text style={styles.otherWorkoutTitle}>{treino.nome}</Text>
                        <Text style={styles.otherWorkoutInfo}>{treino.exercicios.length} {treino.exercicios.length === 1 ? 'exercício' : 'exercícios'}</Text>
                      </View>
                      <Text style={styles.otherWorkoutDays}>{treino.diasSemana.join(', ').toUpperCase()}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </>
            )}

            {!treinoDeHoje && outrosTreinos.length === 0 && (
              <View style={styles.emptyTreinoContainer}>
                <Text style={styles.emptyText}>Nenhum treino nesta ficha.</Text>
                <TouchableOpacity onPress={() => handleEditFicha(fichaAtiva.id)}>
                    <Text style={styles.linkText}>Edite a ficha para adicionar treinos.</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        ) : (
          <View style={styles.centeredEmpty}>
            <Text style={styles.emptyText}>Nenhuma ficha ativa.</Text>
            <Text style={styles.emptySubText}>Deslize um plano para a direita para ativá-lo.</Text>
          </View>
        )}

        <Text style={[styles.sectionTitle, { marginTop: 30 }]}>Histórico de Sessões</Text>
        {logs.length > 0 ? (
          <FlatList
            data={logs}
            renderItem={({ item }) => <LogItem log={item} />}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
          />
        ) : (
          <View style={styles.emptyTreinoContainer}>
            <Text style={styles.emptyText}>Você ainda não completou nenhum treino.</Text>
          </View>
        )}
      </ScrollView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0d181c', padding: 15 },
    card: {
      backgroundColor: '#1a2a33',
      borderRadius: 12,
      marginBottom: 10,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: '#2a3b42',
    },
    cardContent: {
      padding: 15,
    },
    cardTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#fff',
    },
    cardDetailText: {
      fontSize: 14,
      color: '#ccc',
      marginTop: 5,
    },
    cardFichaAtiva: { 
      backgroundColor: '#1a2a33', 
      borderRadius: 12, 
      borderWidth: 1, 
      borderColor: '#2a3b42', 
      overflow: 'hidden', 
      justifyContent: 'center', 
      flexShrink: 1
    },
    editIconContainer: {
      position: 'absolute',
      right: 15,
      top: 0,
      bottom: 0,
      justifyContent: 'center',
      alignItems: 'center',
    },
    cardOverlay: {
      backgroundColor: 'rgba(0,0,0,0.5)',
      padding: 12,
      borderBottomLeftRadius: 12,
      borderBottomRightRadius: 12,
    },
    swipeIndicator: { alignItems: 'center', opacity: 0.6 },
    swipeIndicatorText: { color: '#ccc', fontSize: 12, marginTop: 4 },


    fichaAtivaLabel: {
      fontSize: 10,
      fontWeight: 'bold',
      color: '#1cb0f6',
      letterSpacing: 1,
      marginBottom: 4,
    },
    fichaAtivaTitle: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
    fichaAtivaSubtitle: { fontSize: 14, color: '#ccc' },
    cardTreinoHoje: {
      backgroundColor: '#323a7212',
      borderWidth: 1,
      borderColor: '#ffffff4a',
      borderRadius: 12,
      padding: 20,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    treinoHojeTitle: {
      color: '#fff',
      fontSize: 18,
      fontWeight: 'bold',
    },
    treinoHojeInfo: {
      color: '#e0e0e0',
      fontSize: 14,
      marginTop: 5,
    },
    sectionTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff', marginBottom: 15 },
    emptyText: { color: '#aaa', textAlign: 'center', fontSize: 16, },
    emptySubText: {
      color: '#888',
      textAlign: 'center',
      marginTop: 5,
    },
    emptyTreinoContainer: {
      paddingVertical: 20,
      alignItems: 'center',
    },
    centeredEmpty: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 40,
    },
    otherWorkoutCard: {
      backgroundColor: '#1a2a33',
      borderRadius: 8,
      padding: 15,
      marginBottom: 10,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    otherWorkoutTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    otherWorkoutInfo: { color: '#aaa', fontSize: 14, marginTop: 4, textTransform: 'capitalize' },
    otherWorkoutDays: { color: '#1cb0f6', fontSize: 12, fontWeight: 'bold' },
    editBox: {
      backgroundColor: '#1cb0f6',
      justifyContent: 'center',
      alignItems: 'center',
      width: 80,
      borderRadius: 12,
      height: '100%',
    },
    activateBox: {
      backgroundColor: '#4CAF50',
      justifyContent: 'center',
      alignItems: 'center',
      width: 80,
    },
    activeIndicator: {
      position: 'absolute',
      left: 0, top: 0, bottom: 0,
      width: 5,
      backgroundColor: '#1cb0f6',
    },
    linkText: {
      color: '#1cb0f6',
      marginTop: 10,
      fontWeight: 'bold',
    },
    // Log Styles
    logCard: {
      backgroundColor: '#1a2a33',
      borderRadius: 8,
      marginBottom: 10,
      padding: 15,
    },
    logHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    logTitle: {
      color: '#fff',
      fontSize: 16,
      fontWeight: 'bold',
    },
    logDate: {
      color: '#aaa',
      fontSize: 12,
      marginTop: 4,
    },
    logDetails: {
      marginTop: 15,
      borderTopWidth: 1,
      borderTopColor: '#2a3b42',
      paddingTop: 10,
    },
    logExercicio: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 5,
    },
    logExercicioName: { color: '#ccc', fontSize: 14 },
    logExercicioInfo: { color: '#fff', fontSize: 14, fontWeight: '500' },
});