import { Exercicio, Serie } from '@/models/exercicio';
import { Log } from '@/models/log';
import { calculateTotalVolume } from '@/utils/volumeUtils'; // CORREÇÃO: Adicionada a importação que faltava.
import { FontAwesome } from '@expo/vector-icons';
// import { VideoView as Video, useVideoPlayer } from 'expo-video'; // Removido
import React, { useEffect } from 'react';
import { Dimensions, FlatList, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
// import { BarChart, LineChart } from 'react-native-chart-kit'; // Removido
import { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
// import { SvgUri } from 'react-native-svg'; // Removido
// --- Imports dos novos componentes ---
import { HistoricoCargaTreinoChart } from '@/components/charts/HistoricoCargaTreinoChart';
import { ExpandableExerciseItem } from '@/components/exercicios/ExpandableExerciseItem';

interface SerieComStatus extends Serie {
    concluido?: boolean;
}

// --- Funções movidas para os componentes ---
// MediaDisplay (movido)
// toDate (movido)
// calculateLoadForExercise (movido)
// ExerciseHistoryChart (movido)
// ExpandableExerciseItem (movido)
// --- Fim das funções movidas ---

const toDate = (date: any): Date | null => {
    if (!date) return null;
    if (typeof date.toDate === 'function') return date.toDate();
    const d = new Date(date);
    return isNaN(d.getTime()) ? null : d;
};

const formatTime = (date: Date | null): string => {
    if (!date) return '--:--';
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

const calculateDuration = (start: Date | null, end: Date | null): string => {
    if (!start || !end) return 'N/A';
    const diffMs = end.getTime() - start.getTime();
    if (diffMs < 0) return 'N/A';
    const totalMinutes = Math.floor(diffMs / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours > 0) {
        return `${hours}h ${minutes}min`;
    }
    return `${minutes} min`;
};

export const WorkoutReviewModal = ({ visible, onClose, initialLog, allUserLogs }: { visible: boolean; onClose: () => void; initialLog: Log | null; allUserLogs: Log[] }) => {
    const [currentLog, setCurrentLog] = React.useState(initialLog);

    // Encontra todos os logs concluídos para o mesmo treino do log inicial
    const relevantLogs = React.useMemo(() => {
        if (!initialLog) return [];
        // CORREÇÃO: Garante que o log inicial e os logs comparados tenham um treino e um ID de treino válidos.
        const initialTreinoId = initialLog.treino?.id;
        if (!initialTreinoId) return [];

        return allUserLogs
            // Filtra apenas logs que têm um ID de treino correspondente e estão concluídos.
            .filter(l => l.treino?.id === initialTreinoId && l.status === 'concluido')
            .sort((a, b) => (toDate(a.horarioFim)?.getTime() || 0) - (toDate(b.horarioFim)?.getTime() || 0));
    }, [allUserLogs, initialLog]);

    const currentIndex = React.useMemo(() => {
        if (!currentLog) return -1;
        return relevantLogs.findIndex(l => l.id === currentLog.id);
    }, [relevantLogs, currentLog]);

    useEffect(() => {
        // Atualiza o log atual se o log inicial mudar
        setCurrentLog(initialLog);
    }, [initialLog]);

    const navigateLog = (direction: 'prev' | 'next') => {
        if (currentIndex === -1) return;
        const newIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1;
        if (newIndex >= 0 && newIndex < relevantLogs.length) {
            setCurrentLog(relevantLogs[newIndex]);
        }
    };


    if (!currentLog) { return null; }

    const log = currentLog; // Usa o log atual para renderizar o restante do modal

    const startTime = toDate(log.horarioInicio);
    const endTime = toDate(log.horarioFim);
    const duration = calculateDuration(startTime, endTime);
    const userWeight = (log as any).usuario?.peso || 70; // Tenta pegar o peso do log, com fallback
    const cargaTotalLog = (log as any).cargaAcumulada || calculateTotalVolume(log.exercicios as Exercicio[], userWeight, true);
    const screenWidth = Dimensions.get('window').width;

    // --- Lógica do gráfico de barras movida para o componente ---
    // const historicalLogs = ...
    // const currentLogIndex = ...
    // const chartLabels = ...
    // const chartDataPoints = ...
    // const chartKitData = ...
    // const chartConfig = ...
    // --- Fim da lógica movida ---


    // --- Animação ---
    const chartHeight = useSharedValue(0);
    const animatedChartStyle = useAnimatedStyle(() => {
        return {
            height: chartHeight.value,
            overflow: 'hidden', 
        };
    });

    // Função para disparar a animação
    const handleChartDataReady = (hasData: boolean) => {
        if (visible && hasData) {
            chartHeight.value = withTiming(220, {
                duration: 800,
                easing: Easing.out(Easing.exp),
            });
        } else if (!visible) {
            chartHeight.value = 0;
        }
    };

    // Trigger da animação
    useEffect(() => {
        // A lógica de animação agora é controlada pelo callback onDataReady
        // Mas precisamos resetar ao fechar
        if (!visible) {
            chartHeight.value = 0;
        }
    }, [visible, chartHeight]);
    // --- Fim da Animação ---

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Resumo do Treino</Text>
                    <TouchableOpacity onPress={onClose}>
                        <FontAwesome name="close" size={24} color="#fff" />
                    </TouchableOpacity>
                </View>

                <FlatList
                    data={log.exercicios.filter(ex => (ex.series as SerieComStatus[]).some(s => s.concluido))}
                    keyExtractor={(item) => item.modeloId}
                    // --- SUBSTITUIÇÃO DO RENDERITEM ---
                    renderItem={({ item }) => (
                        <ExpandableExerciseItem 
                            item={item} 
                            allUserLogs={allUserLogs} 
                            log={log}
                            userWeight={userWeight}
                        />
                    )}
                    // --- FIM DA SUBSTITUIÇÃO ---
                    ListHeaderComponent={
                        <>
                            <View style={styles.infoCard}>
                                <Text style={styles.infoCardTitle}>Duração do Treino</Text>
                                <Text style={styles.durationValue}>{duration}</Text>
                                <View style={styles.timelineContainer}><View style={styles.timelineDot} /><View style={styles.timelineTrack} /><View style={styles.timelineDot} /></View>
                                <View style={styles.timeLabelContainer}><Text style={styles.timeLabel}>{formatTime(startTime)}</Text><Text style={styles.timeLabel}>{formatTime(endTime)}</Text></View>
                            </View>

                            <View style={styles.infoCard}><Text style={styles.infoCardTitle}>Carga Acumulada</Text><Text style={styles.loadValue}>{cargaTotalLog.toLocaleString('pt-BR')} kg</Text></View>
                            <View style={styles.infoCard}>
                                <Text style={styles.infoCardTitle}>Progressão de Carga</Text>
                                <View style={styles.chartContainer}>
                                    
                                    {/* --- SUBSTITUIÇÃO DO GRÁFICO --- */}
                                    <HistoricoCargaTreinoChart
                                        currentLog={log}
                                        allUserLogs={allUserLogs}
                                        style={animatedChartStyle}
                                        onDataReady={handleChartDataReady}
                                    />
                                    {/* --- FIM DA SUBSTITUIÇÃO --- */}

                                </View>
                            </View>
                            <Text style={[styles.cardTitle, { marginTop: 20, marginBottom: 15}]}>Carga por Exercício</Text>
                        </>
                    }
                    contentContainerStyle={{ paddingHorizontal: 15, paddingBottom: 30 }}
                />
            </SafeAreaView>
        </Modal>
    );
};

const styles = StyleSheet.create({
// ... (Estilos existentes)
    safeArea: { flex: 1, backgroundColor: '#030405' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#1C1C1E', paddingTop: 10 },
    headerTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
    navigationCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#141414',
        borderRadius: 12,
        padding: 15,
        marginTop: 10,
    },
    navigationTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
    navigationDate: { color: '#aaa', fontSize: 12, marginTop: 4 },
    infoCard: { backgroundColor: '#141414', borderRadius: 12, padding: 15, marginTop: 20, borderWidth: 1, borderColor: '#222' },
    infoCardTitle: { color: '#aaa', fontSize: 14, marginBottom: 10 },
    durationValue: { color: '#fff', fontSize: 28, fontWeight: 'bold', textAlign: 'center' },
    loadValue: { color: '#fff', fontSize: 28, fontWeight: 'bold', textAlign: 'center', paddingVertical: 10 },
    timelineContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, marginTop: 15 },
    timelineTrack: { flex: 1, height: 2, backgroundColor: '#333' },
    timelineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#00A6FF' },
    timeLabelContainer: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 10, marginTop: 5 },
    timeLabel: { color: '#ccc', fontSize: 12 },
    cardTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
    chartContainer: { alignItems: 'center' },
    // Estilos de exerciseItem removidos (agora estão no componente)
});
