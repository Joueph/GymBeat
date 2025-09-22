import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Alert, Animated, ImageBackground, TouchableOpacity } from 'react-native';
import { Swipeable, GestureHandlerRootView, RectButton } from 'react-native-gesture-handler';
import { FontAwesome } from '@expo/vector-icons';
import { useAuth } from '../authprovider';
import { useRouter, useFocusEffect } from 'expo-router';
import { getFichaAtiva } from '../../services/fichaService';
import { getTreinosByIds, DiaSemana } from '../../services/treinoService';
import { Ficha } from '../../models/ficha';
import { Treino } from '../../models/treino';

const DIAS_SEMANA_ORDEM: { [key: string]: number } = {
  'dom': 0, 'seg': 1, 'ter': 2, 'qua': 3, 'qui': 4, 'sex': 5, 'sab': 6
};

const DIAS_SEMANA_MAP: { [key: number]: string } = {
  0: 'dom', 1: 'seg', 2: 'ter', 3: 'qua', 4: 'qui', 5: 'sex', 6: 'sab'
};

const AnimatedIcon = Animated.createAnimatedComponent(FontAwesome);

export default function TreinoHojeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [fichaAtiva, setFichaAtiva] = useState<Ficha | null>(null);
  const [treinoDeHoje, setTreinoDeHoje] = useState<Treino | null>(null);
  const [outrosTreinos, setOutrosTreinos] = useState<Treino[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      const fetchData = async () => {
        if (!user) {
          setLoading(false);
          return;
        }
        setLoading(true);
        try {
          const ativa = await getFichaAtiva(user.uid);
          setFichaAtiva(ativa);

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

  const handleEditFicha = (fichaId: string) => {
    router.push(`/treino/criarFicha?fichaId=${fichaId}`);
  };

  const renderLeftActions = (progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>, fichaId: string) => {
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

  if (loading) {
    return <ActivityIndicator style={styles.container} size="large" color="#fff" />;
  }

  const totalTreinos = outrosTreinos.length + (treinoDeHoje ? 1 : 0);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ScrollView style={styles.container}>
        {fichaAtiva ? (
          <>
            <View style={{ marginBottom: 30 }}>
              <Swipeable
                renderLeftActions={(progress, dragX) => renderLeftActions(progress, dragX, fichaAtiva.id)}
                overshootLeft={false}
              >
                <ImageBackground 
                  source={{ uri: fichaAtiva.imagemUrl || undefined }} 
                  style={styles.cardFichaAtiva} 
                  imageStyle={{ borderRadius: 12 }}
                >
                  <View style={styles.cardOverlay}>
                    <Text style={styles.fichaAtivaTitle}>{fichaAtiva.nome}</Text>
                    <Text style={styles.fichaAtivaSubtitle}>
                      {totalTreinos} {totalTreinos === 1 ? 'treino' : 'treinos'}
                    </Text>
                  </View>
                </ImageBackground>
              </Swipeable>
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
                <Text style={styles.sectionTitle}>Outros Treinos</Text>
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
                <Text style={styles.emptySubText}>Edite a ficha para adicionar treinos.</Text>
              </View>
            )}
          </>
        ) : (
          <View style={styles.centeredEmpty}>
            <Text style={styles.emptyText}>Nenhuma ficha ativa.</Text>
            <Text style={styles.emptySubText}>Vá para a aba 'Workouts' para ativar uma ficha.</Text>
            <TouchableOpacity style={styles.callToActionButton} onPress={() => router.push('/workouts')}>
              <Text style={styles.callToActionText}>Ver Workouts</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0d181c', padding: 15 },
    cardFichaAtiva: { 
      backgroundColor: '#1a2a33', 
      borderRadius: 12, 
      minHeight: 120, 
      justifyContent: 'flex-end' 
    },
    cardOverlay: {
      backgroundColor: 'rgba(0,0,0,0.5)',
      padding: 12,
      borderBottomLeftRadius: 12,
      borderBottomRightRadius: 12,
    },
    fichaAtivaTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
    fichaAtivaSubtitle: { fontSize: 14, color: '#ccc' },
    cardTreinoHoje: {
      backgroundColor: '#1cb0f6',
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
      paddingTop: '40%',
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
    callToActionButton: {
      marginTop: 20,
      backgroundColor: '#1cb0f6',
      paddingVertical: 12,
      paddingHorizontal: 25,
      borderRadius: 8,
    },
    callToActionText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: 'bold',
    },
});