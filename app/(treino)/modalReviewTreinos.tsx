import { Exercicio } from '@/models/exercicio';
import { Log } from '@/models/log';
import { FontAwesome } from '@expo/vector-icons';
import { VideoView as Video, useVideoPlayer } from 'expo-video';
import React, { useMemo, useState } from 'react';
import { Dimensions, FlatList, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SvgUri } from 'react-native-svg';

// Componente de Mídia que renderiza SVG ou Vídeo com base na URI
const MediaDisplay = ({ uri, style }: { uri: string; style: any }) => {
    if (uri?.toLowerCase().endsWith('.svg')) {
        return <SvgUri width={style.width} height={style.height} uri={uri} style={style} />;
    }

    // Fallback para o VideoPlayer para outros formatos como MP4
    const player = useVideoPlayer(uri, (p) => {
        p.loop = true;
        p.muted = true;
        p.play();
    });

    React.useEffect(() => {
        return () => {
            player.release();
        };
    }, [player]);

    return <Video player={player} style={style} contentFit="cover" nativeControls={false} />;
};


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

const calculateLoadForExercise = (exercise: Exercicio): number => {
    return exercise.series.reduce((total, serie) => {
        const repsMatch = String(serie.repeticoes).match(/\d+/);
        const reps = repsMatch ? parseInt(repsMatch[0], 10) : 0;
        return total + (serie.peso || 0) * reps;
    }, 0);
};

// Gráfico de histórico para um exercício individual
const ExerciseHistoryChart = ({ exerciseId, allUserLogs, currentLogId }: { exerciseId: string; allUserLogs: Log[]; currentLogId: string }) => {
    const historicalExerciseData = useMemo(() => {
        return (allUserLogs || [])
            .filter(log => log.status !== 'cancelado' && log.horarioFim && log.exerciciosFeitos.some(ex => ex.modeloId === exerciseId))
            .sort((a, b) => toDate(a.horarioFim)!.getTime() - toDate(b.horarioFim)!.getTime());
    }, [allUserLogs, exerciseId]);

    if (historicalExerciseData.length < 2) {
        return <Text style={styles.chartEmptyText}>Histórico insuficiente para exibir o gráfico.</Text>;
    }

    const chartLabels = historicalExerciseData.map(l => {
        const date = toDate(l.horarioFim);
        return date ? `${date.getDate()}/${date.getMonth() + 1}` : '';
    });

    const chartDataPoints = historicalExerciseData.map(log => {
        const exercise = log.exerciciosFeitos.find(ex => ex.modeloId === exerciseId);
        return exercise ? calculateLoadForExercise(exercise) : 0;
    });

    const chartKitData = {
        labels: chartLabels,
        datasets: [{ data: chartDataPoints, color: (opacity = 1) => `rgba(0, 166, 255, ${opacity})`, strokeWidth: 2, }],
    };

    const chartConfig = {
        backgroundColor: "#1C1C1E", backgroundGradientFrom: "#1C1C1E", backgroundGradientTo: "#1C1C1E", decimalPlaces: 0,
        color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
        labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
        style: { borderRadius: 16 }, propsForDots: { r: "4", strokeWidth: "2", stroke: "#00A6FF" },
        getDotColor: (_: number, dataPointIndex: number) => historicalExerciseData[dataPointIndex]?.id === currentLogId ? '#58CC02' : '#00A6FF',
    };

    return (
        <View style={styles.expandedContent}>
            <LineChart data={chartKitData} width={Dimensions.get('window').width - 90} height={150} chartConfig={chartConfig} bezier style={styles.chartStyle} />
        </View>
    );
};

// Componente de item de exercício expansível
const ExpandableExerciseItem = ({ item, allUserLogs, log }: { item: Exercicio; allUserLogs: Log[]; log: Log }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const totalLoad = calculateLoadForExercise(item);
    const seriesInfo = `${item.series.length} séries`;
    const seriesCalculationString = item.series.map(serie => {
        const repsMatch = String(serie.repeticoes).match(/\d+/);
        const reps = repsMatch ? parseInt(repsMatch[0], 10) : 0;
        const peso = serie.peso || 0;
        return `(${peso}kg x ${reps})`;
    }).join(' + ');

    return (
        <View style={styles.exerciseItemContainer}>
            <TouchableOpacity style={styles.exerciseItemHeader} onPress={() => setIsExpanded(!isExpanded)}>
                {item.modelo.imagemUrl ? (
                    <MediaDisplay uri={item.modelo.imagemUrl} style={styles.exerciseVideo} />
                ) : (
                    <View style={styles.exerciseImagePlaceholder} />
                )}
                <View style={styles.exerciseInfo}>
                    <Text style={styles.exerciseName}>{item.modelo.nome}</Text>
                    <Text style={styles.exerciseDetails}>{item.modelo.grupoMuscular} • {seriesInfo}</Text>
                    <Text style={styles.seriesCalculationText}>{seriesCalculationString}</Text>
                </View>
                <View style={styles.exerciseRight}>
                    <Text style={styles.exerciseLoad}>{totalLoad.toLocaleString('pt-BR')} kg</Text>
                    <FontAwesome name={isExpanded ? "chevron-up" : "chevron-down"} size={16} color="#888" style={{ marginTop: 4 }} />
                </View>
            </TouchableOpacity>
            {isExpanded && <ExerciseHistoryChart exerciseId={item.modeloId} allUserLogs={allUserLogs} currentLogId={log.id} />}
        </View>
    );
};

export const WorkoutReviewModal = ({ visible, onClose, log, allUserLogs }: { visible: boolean; onClose: () => void; log: Log | null; allUserLogs: Log[] }) => {
    if (!log) { return null; }

    const startTime = toDate(log.horarioInicio);
    const endTime = toDate(log.horarioFim);
    const duration = calculateDuration(startTime, endTime);
    const cargaAcumuladaTotal = (log as any).cargaAcumulada || log.exerciciosFeitos.reduce((acc, ex) => acc + calculateLoadForExercise(ex), 0);
    const screenWidth = Dimensions.get('window').width;

    const historicalLogs = (allUserLogs || [])
        .filter(l => l.treino.id === log.treino.id && l.status !== 'cancelado' && l.horarioFim)
        .sort((a, b) => toDate(a.horarioFim)!.getTime() - toDate(b.horarioFim)!.getTime());

    const chartLabels = historicalLogs.map(l => { const date = toDate(l.horarioFim); return date ? `${date.getDate()}/${date.getMonth() + 1}` : ''; });
    const chartDataPoints = historicalLogs.map(l => (l as any).cargaAcumulada || l.exerciciosFeitos.reduce((acc, ex) => acc + calculateLoadForExercise(ex), 0));

    const chartKitData = {
        labels: chartLabels.length > 1 ? chartLabels : ['Início', 'Hoje'],
        datasets: [{ data: chartDataPoints.length > 0 ? chartDataPoints : [0, cargaAcumuladaTotal], color: (opacity = 1) => `rgba(0, 166, 255, ${opacity})`, strokeWidth: 2, }],
        legend: ['Histórico de Carga'],
    };

    const chartConfig = {
        backgroundColor: "#141414", backgroundGradientFrom: "#141414", backgroundGradientTo: "#141414", decimalPlaces: 0,
        color: (opacity = 1) => `rgba(0, 166, 255, ${opacity})`,
        labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
        style: { borderRadius: 16 }, propsForDots: { r: "4", strokeWidth: "2", stroke: "#00A6FF" },
        getDotColor: (_: number, dataPointIndex: number) => historicalLogs[dataPointIndex]?.id === log.id ? '#58CC02' : '#00A6FF',
    };

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
                    data={log.exerciciosFeitos}
                    keyExtractor={(item) => item.modeloId}
                    renderItem={({ item }) => <ExpandableExerciseItem item={item} allUserLogs={allUserLogs} log={log} />}
                    ListHeaderComponent={
                        <>
                            <View style={styles.infoCard}>
                                <Text style={styles.infoCardTitle}>Duração do Treino</Text>
                                <Text style={styles.durationValue}>{duration}</Text>
                                <View style={styles.timelineContainer}><View style={styles.timelineDot} /><View style={styles.timelineTrack} /><View style={styles.timelineDot} /></View>
                                <View style={styles.timeLabelContainer}><Text style={styles.timeLabel}>{formatTime(startTime)}</Text><Text style={styles.timeLabel}>{formatTime(endTime)}</Text></View>
                            </View>

                            <View style={styles.infoCard}><Text style={styles.infoCardTitle}>Carga Acumulada</Text><Text style={styles.loadValue}>{cargaAcumuladaTotal.toLocaleString('pt-BR')} kg</Text></View>
                            <View style={styles.infoCard}><Text style={styles.infoCardTitle}>Progressão de Carga</Text><View style={styles.chartContainer}><LineChart data={chartKitData} width={screenWidth - 60} height={220} chartConfig={chartConfig} yAxisSuffix="kg" bezier style={styles.chartStyle} /></View></View>
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
    safeArea: { flex: 1, backgroundColor: '#030405' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#1C1C1E' },
    headerTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
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
    exerciseItemContainer: {
        backgroundColor: '#1C1C1E',
        borderRadius: 12,
        marginBottom: 10,
        overflow: 'hidden',
    },
    exerciseItemHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
    },
    exerciseImagePlaceholder: { width: 60, height: 60, borderRadius: 8, backgroundColor: '#333', marginRight: 15 },
    exerciseVideo: { width: 60, height: 60, borderRadius: 8, marginRight: 15, backgroundColor: '#000' },
    exerciseInfo: { flex: 1 },
    exerciseName: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    exerciseDetails: { color: '#aaa', fontSize: 14, marginTop: 4 },
    seriesCalculationText: { color: '#888', fontSize: 12, marginTop: 6, fontStyle: 'italic' },
    exerciseRight: { alignItems: 'flex-end', justifyContent: 'center', paddingLeft: 10 },
    exerciseLoad: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
    chartContainer: { alignItems: 'center' },
    chartStyle: { marginVertical: 8, borderRadius: 16 },
    expandedContent: {
        paddingHorizontal: 15,
        paddingBottom: 15,
    },
    chartEmptyText: {
        color: '#888',
        textAlign: 'center',
        paddingVertical: 20,
    },
});

