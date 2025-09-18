import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Alert, Animated, ImageBackground, Image } from 'react-native';
import { Swipeable, GestureHandlerRootView, RectButton } from 'react-native-gesture-handler';
import { FontAwesome } from '@expo/vector-icons';
import { useAuth } from '../authprovider';
import { useRouter } from 'expo-router';
import { getFichaAtiva, getFichasInativas, deleteFicha } from '../../services/fichaService';
import { getTreinosByIds } from '../../services/treinoService';
import { Ficha } from '../../models/ficha';
import { Treino } from '../../models/treino';

const DIAS_SEMANA_MAP: { [key: number]: string } = {
  0: 'dom', 1: 'seg', 2: 'ter', 3: 'qua', 4: 'qui', 5: 'sex', 6: 'sab'
}; 

const AnimatedIcon = Animated.createAnimatedComponent(FontAwesome);

export default function TreinoHojeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [fichaAtiva, setFichaAtiva] = useState<Ficha | null>(null);
  const [treinoDeHoje, setTreinoDeHoje] = useState<Treino | null>(null);
  const [fichasAnteriores, setFichasAnteriores] = useState<Ficha[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      setLoading(true);
      try {
        // Busca a ficha ativa e as fichas anteriores em paralelo
        const [ativa, inativas] = await Promise.all([
          getFichaAtiva(user.uid),
          getFichasInativas(user.uid),
        ]);

        setFichaAtiva(ativa);
        setFichasAnteriores(inativas);

        if (ativa && ativa.treinos.length > 0) {
          const treinos = await getTreinosByIds(ativa.treinos);
          const hoje = new Date().getDay();
          const diaString = DIAS_SEMANA_MAP[hoje] as 'dom' | 'seg' | 'ter' | 'qua' | 'qui' | 'sex' | 'sab';
          const treinoDoDia = treinos.find(t => t.diasSemana.includes(diaString)) || null;
          setTreinoDeHoje(treinoDoDia);
        }
      } catch (err) {
        Alert.alert("Erro", "Não foi possível carregar os dados de treino.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  const handleDeleteFicha = async (fichaId: string) => {
    try {
      await deleteFicha(fichaId);
      setFichasAnteriores(prevFichas => prevFichas.filter(f => f.id !== fichaId));
    } catch (error) {
      Alert.alert("Erro", "Não foi possível apagar a ficha.");
    }
  };

  const handleEditFicha = (fichaId: string) => {
    router.push(`/treino/criarFicha?fichaId=${fichaId}`);
  };

  const renderRightActions = (progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>, fichaId: string) => {
    const scale = dragX.interpolate({
      inputRange: [-80, 0],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    });

    return (
      <RectButton style={styles.deleteBox} onPress={() => handleDeleteFicha(fichaId)}>
        <AnimatedIcon name="trash-o" size={28} color="white" style={{ transform: [{ scale }] }} />
      </RectButton>
    );
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

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ScrollView style={styles.container}>
        {/* Card da Ficha Ativa */}
        {fichaAtiva ? (
          <View style={{ marginBottom: 15 }}>
            <Swipeable
              renderLeftActions={(progress, dragX) => renderLeftActions(progress, dragX, fichaAtiva.id)}
              overshootLeft={false}
            >
              <ImageBackground 
                source={{ uri: fichaAtiva.imagemUrl || undefined }} 
                style={styles.cardFichaAtiva} 
                imageStyle={{ borderRadius: 8 }}
              >
                <View style={styles.cardOverlay}>
                  <Text style={styles.fichaAtivaTitle}>{fichaAtiva.nome}</Text>
                  <Text style={styles.fichaAtivaSubtitle}>Ficha atual</Text>
                </View>
              </ImageBackground>
            </Swipeable>
          </View>
        ) : (
          <Text style={styles.emptyText}>Nenhuma ficha ativa encontrada.</Text>
        )}

        {/* Card do Treino do Dia */}
        {treinoDeHoje ? (
          <View style={styles.cardTreinoHoje}>
            <Text style={styles.treinoHojeTitle}>{treinoDeHoje.nome}</Text>
            <Text style={styles.treinoHojeSubtitle}>Intervalo: {treinoDeHoje.intervalo.min}m {treinoDeHoje.intervalo.seg}s</Text>
            <Text style={styles.treinoHojeExercicios}>{treinoDeHoje.exercicios.length} exercícios</Text>
          </View>
        ) : fichaAtiva ? (
          <View style={[styles.cardTreinoHoje, styles.cardDescanso]}>
              <Text style={styles.treinoHojeTitle}>Hoje é dia de descanso!</Text>
          </View>
        ) : null}

        {/* Lista de Fichas Anteriores */}
        {fichasAnteriores.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Fichas Anteriores</Text>
              {fichasAnteriores.map(ficha => (
                <View key={ficha.id} style={{ marginBottom: 10 }}>
                  <Swipeable
                    renderLeftActions={(progress, dragX) => renderLeftActions(progress, dragX, ficha.id)}
                    renderRightActions={(progress, dragX) => renderRightActions(progress, dragX, ficha.id)}
                    overshootRight={false}
                    overshootLeft={false}
                  >
                    <View style={styles.cardFichaAnterior}>
                        <Image 
                          source={{ uri: ficha.imagemUrl || 'https://via.placeholder.com/100x100.png?text=Ficha' }} 
                          style={styles.fichaAnteriorImage} 
                        />
                        <Text style={styles.fichaAnteriorTitle}>{ficha.nome}</Text>
                    </View>
                  </Swipeable>
                </View>
              ))}
            </>
        )}
      </ScrollView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0d181c', padding: 15 },
    cardFichaAtiva: { 
      backgroundColor: '#173F5F', 
      borderRadius: 8, 
      minHeight: 100, 
      justifyContent: 'flex-end' 
    },
    cardOverlay: {
      backgroundColor: 'rgba(0,0,0,0.5)',
      padding: 12,
      borderBottomLeftRadius: 8,
      borderBottomRightRadius: 8,
    },
    fichaAtivaTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
    fichaAtivaSubtitle: { fontSize: 14, color: '#ccc' },
    cardTreinoHoje: { backgroundColor: '#4CAF50', padding: 25, borderRadius: 12, marginBottom: 30, alignItems: 'center' },
    treinoHojeTitle: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
    treinoHojeSubtitle: { fontSize: 16, color: '#fff', marginTop: 5 },
    treinoHojeExercicios: { fontSize: 16, color: '#fff', marginTop: 10, fontWeight: '500' },
    cardDescanso: { backgroundColor: '#2a3b42'},
    sectionTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff', marginTop: 20, marginBottom: 10 },
    cardFichaAnterior: { backgroundColor: '#222', borderRadius: 8, flexDirection: 'row', alignItems: 'center', overflow: 'hidden' },
    fichaAnteriorImage: { width: 60, height: 60, marginRight: 15 },
    fichaAnteriorTitle: { fontSize: 16, color: '#aaa', flex: 1 },
    emptyText: { color: '#aaa', textAlign: 'center', marginVertical: 20 },
    deleteBox: {
      backgroundColor: '#ff3b30',
      justifyContent: 'center',
      alignItems: 'center',
      width: 80,
      borderRadius: 8,
      height: '100%',
    },
    editBox: {
      backgroundColor: '#1cb0f6',
      justifyContent: 'center',
      alignItems: 'center',
      width: 80,
      borderRadius: 8,
      height: '100%',
    },
});