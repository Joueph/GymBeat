import { FontAwesome } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import React, { useCallback, useLayoutEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
// GestureHandlerRootView não é mais necessário aqui se a FlatList de fichas foi removida
// mas é uma boa prática mantê-lo no topo da árvore de componentes
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';

import { Exercicio } from '../../models/exercicio';
import { Ficha } from '../../models/ficha';
import { Log } from '../../models/log';
import { Treino } from '../../models/treino';
import { addFicha, getFichaAtiva, getFichasByUsuarioId, setFichaAtiva as setFichaAtivaService } from '../../services/fichaService';
import { getLogsByUsuarioId } from '../../services/logService';
import { DiaSemana, getTreinosByIds } from '../../services/treinoService';
import { useAuth } from '../authprovider';

// Constantes e Helpers permanecem os mesmos
const DIAS_SEMANA_ORDEM: { [key: string]: number } = {
  'dom': 0, 'seg': 1, 'ter': 2, 'qua': 3, 'qui': 4, 'sex': 5, 'sab': 6
};

const DIAS_SEMANA_MAP: { [key: number]: string } = {
  0: 'dom', 1: 'seg', 2: 'ter', 3: 'qua', 4: 'qui', 5: 'sex', 6: 'sab'
};

const toDate = (date: any): Date | null => {
  if (!date) return null;
  if (typeof date.toDate === 'function') return date.toDate();
  const d = new Date(date);
  return isNaN(d.getTime()) ? null : d;
};

// --- Funções de Cálculo de Volume ---
const parseReps = (reps: any): number => {
  if (typeof reps === 'number') return reps;
  if (typeof reps === 'string') {
    const numbers = reps.match(/\d+/g);
    if (numbers && numbers.length > 0) {
      if (numbers.length >= 2) {
        const num1 = Number(numbers[0]);
        const num2 = Number(numbers[1]);
        return Math.round((num1 + num2) / 2);
      }
      return Number(numbers[0]);
    }
  }
  return 0;
};

const calculateVolume = (exercicios: Exercicio[]): number => {
  return exercicios.reduce((totalVolume, exercicio) => {
    const exercicioVolume = exercicio.series.reduce((serieVolume, serie) => {
      const reps = parseReps(serie.repeticoes);
      const peso = serie.peso || 0;
      return serieVolume + (reps * peso);
    }, 0);
    return totalVolume + exercicioVolume;
  }, 0);
};

// Componente LogItem permanece o mesmo
const LogItem = ({ log }: { log: Log }) => {
  const [expanded, setExpanded] = useState(false);

  // Se o treino foi cancelado, exibe um card simplificado.
  if (log.status === 'cancelado') {
    const logDate = toDate(log.horarioInicio) || new Date();
    return (
      <View style={styles.logCard}>
        <View style={styles.logHeader}>
          <View>
            <Text style={styles.logTitle}>{log.treino.nome}</Text>
            <Text style={styles.logDate}>{logDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })} - <Text style={{ color: '#ff3b30' }}>Cancelado</Text></Text>
          </View>
        </View>
      </View>
    );
  }
  const getMaxWeight = (exercicio: Exercicio) => {
    if (!exercicio.series || exercicio.series.length === 0) return 0;
    // @ts-ignore
    if (typeof exercicio.series === 'number') return (exercicio as any).peso || 0;
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

  const volumeTotal = calculateVolume(log.exerciciosFeitos);

  return (
    <View style={styles.logCard}>
      <TouchableOpacity onPress={() => setExpanded(!expanded)} style={styles.logHeader}>
        <View>
          <Text style={styles.logTitle}>{log.treino.nome}</Text>
          <Text style={styles.logDate}>
            {logDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}
            {durationText} • {volumeTotal.toLocaleString('pt-BR')} kg
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

// Componente principal da tela
export default function MeusTreinosScreen() {
  const { user, initialized: authInitialized } = useAuth();
  const router = useRouter();
  const navigation = useNavigation();
  const [fichaAtiva, setFichaAtiva] = useState<Ficha | null>(null);
  const [todasAsFichas, setTodasAsFichas] = useState<Ficha[]>([]);
  const [treinoDeHoje, setTreinoDeHoje] = useState<Treino | null>(null);
  const [outrosTreinos, setOutrosTreinos] = useState<Treino[]>([]);
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<Log[]>([]);
  const [activeLog, setActiveLog] = useState<Log | null>(null);
  const [treinosConcluidos, setTreinosConcluidos] = useState(0);
  const [isManageModalVisible, setManageModalVisible] = useState(false);
  const [dataVersion, setDataVersion] = useState(0); // Estado para forçar a recarga

  const handleCreateNewFicha = async () => {
    if (!user) return;
    try {
      const expirationDate = new Date();
      expirationDate.setMonth(expirationDate.getMonth() + 2);
      const newFichaId = await addFicha({
        usuarioId: user.uid,
        nome: 'Novo Plano (Edite)',
        treinos: [],
        dataExpiracao: expirationDate,
        opcoes: 'Programa de treinamento',
        ativa: false
      });
      if (newFichaId) router.push({ pathname: '/(treino)/criatFicha', params: { fichaId: newFichaId } });
    } catch (error) {
      console.error("Erro ao criar nova ficha:", error);
    }
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={handleCreateNewFicha} style={{ marginRight: 15, padding: 5 }}>
          <FontAwesome name="plus" size={20} color="#fff" />
        </TouchableOpacity>
      ),
    });
  }, [navigation, user]);

  useFocusEffect(
    useCallback(() => {
      const fetchData = async () => {
        // Aguarda a inicialização da autenticação.
        // Se ainda não foi inicializado, o spinner de loading (que é true por padrão) continuará visível.
        if (!authInitialized) {
          return;
        }

        if (!user) { setLoading(false); return; } // Se não houver usuário após a inicialização, para.

        setLoading(true);
        try {
          const [ativa, todas, userLogs] = await Promise.all([
            getFichaAtiva(user.uid),
            getFichasByUsuarioId(user.uid),
            getLogsByUsuarioId(user.uid)
          ]);

          setFichaAtiva(ativa);
          setTodasAsFichas(todas);
          const sortedLogs = userLogs.sort((a, b) => (toDate(b.horarioFim)?.getTime() || 0) - (toDate(a.horarioFim)?.getTime() || 0));
          setLogs(sortedLogs);

          // Verifica se há um treino em andamento
          const ongoingLog = userLogs.find(log => !log.horarioFim && log.status !== 'cancelado');
          setActiveLog(ongoingLog || null);

          // Lógica para calcular treinos concluídos na semana
          const hoje = new Date();
          const diaDaSemana = hoje.getDay(); // 0 = Domingo, 1 = Segunda...
          const inicioSemana = new Date(hoje);
          inicioSemana.setDate(hoje.getDate() - diaDaSemana + (diaDaSemana === 0 ? -6 : 1)); // Início na segunda
          inicioSemana.setHours(0, 0, 0, 0);

          const logsDaSemana = sortedLogs.filter(log => {
            const logDate = toDate(log.horarioFim);
            return logDate && logDate >= inicioSemana;
          });
          setTreinosConcluidos(logsDaSemana.length);

          if (ativa && ativa.treinos.length > 0) {
            const treinosData = await getTreinosByIds(ativa.treinos);
            treinosData.sort((a, b) => (DIAS_SEMANA_ORDEM[a.diasSemana[0]] ?? 7) - (DIAS_SEMANA_ORDEM[b.diasSemana[0]] ?? 7));
            
            const diaString = DIAS_SEMANA_MAP[hoje.getDay()] as DiaSemana;
            const treinoDoDia = treinosData.find(t => t.diasSemana.includes(diaString));

            setTreinoDeHoje(treinoDoDia || null);
            setOutrosTreinos(treinosData.filter(t => t.id !== treinoDoDia?.id));
          } else {
            setTreinoDeHoje(null);
            setOutrosTreinos([]);
          }
        } catch (err) {
          console.error("Erro ao carregar dados do treino:", err);
          Alert.alert("Erro", "Não foi possível carregar os dados de treino.");
        } finally {
          setLoading(false);
        }
      };
      fetchData();
    }, [user, authInitialized, dataVersion]) // Adicionado authInitialized como dependência
  );
  
  const handleSetFichaAtiva = async (fichaId: string) => {
    if (!user) return;
    try {
      await setFichaAtivaService(user.uid, fichaId);
      setManageModalVisible(false);
      // Força a recarga dos dados ao mudar a versão
      setDataVersion(v => v + 1);
      // Opcional: Recarregar todos os dados se necessário, ou apenas atualizar o estado local.
      // A abordagem acima é mais otimista e rápida.
    } catch (error) {
      Alert.alert("Erro", "Não foi possível ativar a ficha.");
    }
  };

  const totalTreinosPlano = fichaAtiva?.treinos.length || 0;

  const renderProximoTreino = ({ item }: { item: Treino }) => (
    <TouchableOpacity
      style={styles.nextWorkoutCard}
      onPress={() => router.push(`/(treino)/ongoingWorkout?fichaId=${fichaAtiva?.id}&treinoId=${item.id}`)}
    >
      <Text style={styles.nextWorkoutDay}>{item.diasSemana[0]?.toUpperCase()}</Text>
      <Text style={styles.nextWorkoutTitle} numberOfLines={2}>{item.nome}</Text>
      <Text style={styles.nextWorkoutInfo}>{item.exercicios.length} exercícios</Text>
    </TouchableOpacity>
  );

  const renderFichaGerenciamento = ({ item }: { item: Ficha }) => {
    const renderRightActions = () => (
      <TouchableOpacity
        style={styles.swipeActivateButton}
        onPress={() => handleSetFichaAtiva(item.id)}
      >
        <FontAwesome name="star" size={20} color="#fff" />
        <Text style={styles.swipeButtonText}>Ativar</Text>
      </TouchableOpacity>
    );

    return (
      <Swipeable renderRightActions={renderRightActions} friction={2} rightThreshold={40}>
        <View style={styles.manageFichaCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.manageFichaTitle}>{item.nome}</Text>
            {item.id === fichaAtiva?.id && (
              <Text style={styles.activeTag}>Ativo</Text>
            )}
          </View>
          <TouchableOpacity
            style={styles.editFichaButton}
            onPress={() => {
              setManageModalVisible(false);
              router.push({ pathname: '/(treino)/criatFicha', params: { fichaId: item.id } });
            }}
          >
            <Text style={styles.editFichaButtonText}>Editar</Text>
          </TouchableOpacity>
        </View>
      </Swipeable>
    );
  };

  if (loading) {
    return <View style={styles.centeredContainer}><ActivityIndicator size="large" color="#00A6FF" /></View>;
  }

  const ListHeader = () => (
    <>
      {/* --- Card de Progresso --- */}
      {fichaAtiva && (
          <View style={[styles.progressContainer, { marginHorizontal: 15 }]}>
              <View style={styles.progressCircle}>
                  <FontAwesome name="check" size={24} color="#00A6FF" />
              </View>
              <View>
                  <Text style={styles.progressMainText}>{treinosConcluidos}/{totalTreinosPlano} treinos concluídos</Text>
                  <Text style={styles.progressSubText}>Continue com o bom trabalho!</Text>
              </View>
          </View>
      )}

      {/* --- Card de Treino de Hoje (Herói) --- */}
      {fichaAtiva && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Treino de Hoje</Text>
          <View style={styles.heroCardGlow}>
            {activeLog ? (
              // Card para "Continuar Treino"
              <TouchableOpacity
                style={styles.heroCard} 
                onPress={() => router.push(`/(treino)/ongoingWorkout?fichaId=${activeLog.treino.fichaId}&treinoId=${activeLog.treino.id}&logId=${activeLog.id}`)}
              >
                <View style={styles.heroTextContainer}>
                    <Text style={styles.heroTitle}>{activeLog.treino.nome}</Text>
                    <Text style={styles.heroInfo}>Treino em andamento...</Text>
                </View>
                <TouchableOpacity style={styles.startButton} onPress={() => router.push(`/(treino)/ongoingWorkout?fichaId=${activeLog.treino.fichaId}&treinoId=${activeLog.treino.id}&logId=${activeLog.id}`)}>
                  <FontAwesome name="play" size={16} color="#030405" />
                  <Text style={styles.startButtonText}>Continuar Treino</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            ) : treinoDeHoje ? (
              // Card para "Iniciar Treino"
              <TouchableOpacity
                style={styles.heroCard}
                onPress={() => router.push(`/(treino)/ongoingWorkout?fichaId=${fichaAtiva.id}&treinoId=${treinoDeHoje.id}`)}
              >
                <View style={styles.heroTextContainer}>
                    <Text style={styles.heroTitle}>{treinoDeHoje.nome}</Text>
                    <Text style={styles.heroInfo}>{treinoDeHoje.exercicios.length} Exercícios • ~{treinoDeHoje.exercicios.length * 6} min</Text>
                </View>
                <TouchableOpacity style={styles.startButton} onPress={() => router.push(`/(treino)/ongoingWorkout?fichaId=${fichaAtiva?.id}&treinoId=${treinoDeHoje.id}`)}>
                  <FontAwesome name="play" size={16} color="#030405" />
                  <Text style={styles.startButtonText}>Iniciar Treino</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      )}

      {/* --- Carrossel de Próximos Treinos --- */}
      {fichaAtiva && outrosTreinos.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Próximos Treinos</Text>
          <FlatList
            data={outrosTreinos}
            renderItem={renderProximoTreino}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 5 }}
          />
        </View>
      )}

      {/* --- Seção Meu Plano Ativo --- */}
      {fichaAtiva ? (
        <View style={styles.section}>
            <View style={styles.activePlanContainer}>
                <Text style={styles.activePlanText}>Plano Ativo: <Text style={{fontWeight: 'bold'}}>{fichaAtiva.nome}</Text></Text>
                <TouchableOpacity style={styles.manageButton} onPress={() => setManageModalVisible(true)}>
                    <FontAwesome name="pencil" size={14} color="#fff" />
                    <Text style={styles.manageButtonText}>Gerenciar</Text>
                </TouchableOpacity>
            </View>
        </View>
      ) : todasAsFichas.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.noActiveFichaCard}>
            <Text style={styles.noActiveFichaText}>
              Você possui {todasAsFichas.length} {todasAsFichas.length === 1 ? 'ficha' : 'fichas'} em sua conta, mas nenhuma está definida como ativa.
            </Text>
            <TouchableOpacity style={styles.manageButton} onPress={() => setManageModalVisible(true)}>
              <Text style={styles.manageButtonText}>Gerenciar fichas</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Nenhum plano ativo.</Text>
          <Text style={styles.emptySubText}>Crie um novo plano de treino para começar.</Text>
        </View>
      )}
      <Text style={[styles.sectionTitle, { marginTop: 15, marginBottom: 0 }]}>Histórico de Sessões</Text>
    </>
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <FlatList
        data={logs}
        renderItem={({ item }) => <LogItem log={item} />}
        keyExtractor={(item) => item.id}
        style={styles.container}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={
          <View style={styles.emptyContainer}><Text style={styles.emptyText}>Você ainda não completou nenhum treino.</Text><Text style={styles.emptySubText}>Seu histórico aparecerá aqui.</Text></View>
        }
      />

      <Modal
        visible={isManageModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setManageModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Gerenciar Planos</Text>
            <TouchableOpacity onPress={() => setManageModalVisible(false)}>
              <FontAwesome name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          <FlatList
            data={todasAsFichas}
            renderItem={renderFichaGerenciamento}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingHorizontal: 15 }}
            ListEmptyComponent={
              <Text style={styles.emptyText}>Nenhum plano encontrado.</Text>
            }
          />
        </View>
      </Modal>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#030405',
        paddingTop: 15,
    },
    centeredContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#030405',
    },
    greeting: {
        color: '#fff',
        fontSize: 24,
        fontWeight: 'bold',
        marginTop: 10,
        marginBottom: 20, 
        paddingHorizontal: 15,
    },
    section: {
        marginBottom: 30,
        paddingHorizontal: 15,
        
    },
    sectionTitle: {
        color: '#fff',
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 15,
    },
    // Progress Card
    progressContainer: {
        backgroundColor: '#141414',
        borderRadius: 12,
        padding: 15,
        flexDirection: 'row',
        alignItems: 'center', 
        marginBottom: 30,
        borderTopColor: '#ffffff2a',
        borderLeftColor: '#ffffff2a', 
        borderBottomColor: '#ffffff1a',
        borderRightColor: '#ffffff1a',
        borderWidth: 1,
        
        
    },
    progressCircle: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: 'rgba(0, 166, 255, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    progressMainText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    progressSubText: {
        color: '#aaa',
        fontSize: 14,
    },
    // Hero Card (Treino de Hoje)
    heroCardGlow: {
        borderRadius: 16,
        shadowColor: '#00A6FF',
        shadowOffset: { width: -5, height: -5 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
        elevation: 15, // para Android
    },
    heroCard: {
        backgroundColor: '#141414f1',
        borderRadius: 16,
        padding: 20,
        borderTopColor: '#00A6FFca',
        borderLeftColor: '#00A6FFca', 
        borderBottomColor: '#00A6FFaa',
        borderRightColor: '#00A6FFaa',
        
        borderWidth: 2,
    },
    heroTextContainer: {
        marginBottom: 20,
    },
    heroTitle: {
        color: '#fff',
        fontSize: 22,
        fontWeight: 'bold',
    },
    heroInfo: {
        color: '#ccc',
        fontSize: 14,
        marginTop: 5,
    },
    startButton: {
        backgroundColor: '#00A6FF',
        borderRadius: 10,
        paddingVertical: 15,
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
    },
    startButtonText: {
        color: '#030405',
        fontSize: 16,
        fontWeight: 'bold',
        marginLeft: 10,
    },
    // Next Workout Cards (Horizontal)
    nextWorkoutCard: {
        backgroundColor: '#1C1C1E',
        borderRadius: 12,
        padding: 15,
        width: 140,
        height: 140,
        marginRight: 10,
        justifyContent: 'space-between',
        borderTopColor: '#ffffff2a',
        borderLeftColor: '#ffffff2a', 
        borderBottomColor: '#ffffff1a',
        borderRightColor: '#ffffff1a',
        borderWidth: 1,
    },
    nextWorkoutDay: {
        color: '#00A6FF',
        fontSize: 12,
        fontWeight: 'bold',
    },
    nextWorkoutTitle: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    nextWorkoutInfo: {
        color: '#aaa',
        fontSize: 12,
    },
    // Active Plan Section
    activePlanContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#141414',
        padding: 15,
        borderRadius: 12,
        borderWidth: 1,
        borderTopColor: '#ffffff2a',
        borderLeftColor: '#ffffff2a', 
        borderBottomColor: '#ffffff1a',
        borderRightColor: '#ffffff1a',
    },
    activePlanText: {
        color: '#ccc',
        fontSize: 14,
        flex: 1,
    },
    manageButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#2c2c2e',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderTopColor: '#ffffff2a',
        borderLeftColor: '#ffffff2a', 
        borderBottomColor: '#ffffff1a',
        borderRightColor: '#ffffff1a',
    },
    manageButtonText: {
        color: '#fff',
        marginLeft: 8,
        fontWeight: 'bold',
    },
    // No Active Ficha Card
    noActiveFichaCard: {
      backgroundColor: '#1C1C1E',
      borderRadius: 12,
      padding: 20,
      alignItems: 'center',
      
    },
    noActiveFichaText: {
      color: '#ccc',
      fontSize: 15,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: 20,
    },
    // Empty State
    emptyContainer: {
        paddingVertical: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#141414',
        borderRadius: 12,
                borderWidth: 1,
        borderTopColor: '#ffffff2a',
        borderLeftColor: '#ffffff2a', 
        borderBottomColor: '#ffffff1a',
        borderRightColor: '#ffffff1a', 
        marginHorizontal: 15,
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
    // Log Styles (mantidos do original)
    logCard: {
        backgroundColor: '#141414',
        borderRadius: 12,
        marginBottom: 10,
        padding: 15,
        marginHorizontal: 15,
          borderWidth: 1,
        borderTopColor: '#ffffff2a',
        borderLeftColor: '#ffffff2a', 
        borderBottomColor: '#ffffff1a',
        borderRightColor: '#ffffff1a',
    },
    logHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    logTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    logDate: { color: '#aaa', fontSize: 12, marginTop: 4 },
    logDetails: {
        marginTop: 15,
        borderTopWidth: 1,
        borderTopColor: '#2a3b42',
        paddingTop: 10,
    },
    logExercicio: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
    logExercicioName: { color: '#ccc', fontSize: 14 },
    logExercicioInfo: { color: '#fff', fontSize: 14, fontWeight: '500' },
    // Modal Styles
    modalContainer: {
      flex: 1,
      backgroundColor: '#030405',
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: '#141414',
    },
    modalTitle: {
      color: '#fff',
      fontSize: 22,
      fontWeight: 'bold',
    },
    manageFichaCard: {
      backgroundColor: '#141414',
      padding: 20,
      borderRadius: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 10,
    },
    manageFichaTitle: {
      color: '#fff',
      fontSize: 16,
      fontWeight: 'bold',
    },
    activeTag: {
      color: '#00A6FF',
      fontSize: 12,
      fontWeight: 'bold',
      marginTop: 4,
    },
    editFichaButton: {
      backgroundColor: '#2c2c2e',
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 8,
    },
    editFichaButtonText: {
      color: '#fff',
      fontWeight: 'bold',
    },
    swipeActivateButton: {
      backgroundColor: '#00A6FF',
      justifyContent: 'center',
      alignItems: 'center',
      width: 100,
      borderRadius: 12,
      marginTop: 10,
    },
    swipeButtonText: {
      color: '#fff',
      fontWeight: 'bold',
      marginTop: 5,
    },
});