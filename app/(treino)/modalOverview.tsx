import { Exercicio, Serie } from '@/models/exercicio';
import { FontAwesome, FontAwesome5 } from '@expo/vector-icons';
import { VideoView as Video, useVideoPlayer } from 'expo-video';
import React, { useEffect, useMemo, useState } from 'react'; // Corrigido para React
import { Dimensions, FlatList, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native'; // Removed Treino import
import { G, Line, Path, Svg } from 'react-native-svg';
import { Log } from '../../models/log';
import { Treino } from '../../models/treino'; // Corrected import path

// A new component to manage each video player instance, now with WebP support
export function VideoListItem({ uri, style }: { uri: string; style: any }) {
    const isWebP = uri?.toLowerCase().includes('.webp');
  
    const player = useVideoPlayer(isWebP ? null : uri, (player) => {
      player.loop = true;
      player.muted = true;
      player.play();
    });
  
    useEffect(() => { return () => { if (!isWebP) { player.release(); } }; }, [uri, player, isWebP]);
  
    if (isWebP) {
      const { Image } = require('react-native');
      return <Image source={{ uri }} style={style} />;
    }
    return <Video style={style} player={player} nativeControls={false} contentFit="cover" />;
  }
// Helper to calculate load for a single serie
const calculateSerieLoad = (serie: Serie): number => {
    const repsMatch = String(serie.repeticoes).match(/\d+/);
    const reps = repsMatch ? parseInt(repsMatch[0], 10) : 0;
    return (serie.peso || 0) * reps;
};

// Simple Line Chart Component using SVG
const SimpleLineChart = ({ data, width, height, color = '#1cb0f6' }: { data: number[], width: number, height: number, color?: string }) => {
    if (!data || data.length < 2) {
        return <View style={{ width, height, justifyContent: 'center', alignItems: 'center' }}><Text style={styles.chartEmptyText}>Dados insuficientes para o gráfico</Text></View>;
    }

    const maxY = Math.max(...data, 1); // Avoid division by zero
    const padding = 20;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;
    const stepX = data.length > 1 ? chartWidth / (data.length - 1) : chartWidth;

    const points = data.map((value, index) => ({
        x: padding + index * stepX,
        y: padding + chartHeight - (value / maxY) * chartHeight,
    }));

    const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

    return (
        <View style={{ width, height }}>
            <Svg height={height} width={width}>
                <G>
                    {/* Grid Lines */}
                    {[...Array(5)].map((_, i) => (
                        <Line
                            key={`grid-${i}`}
                            x1={padding}
                            y1={padding + (chartHeight / 4) * i}
                            x2={width - padding}
                            y2={padding + (chartHeight / 4) * i}
                            stroke="#ffffff1a"
                            strokeWidth="1"
                        />
                    ))}
                    {/* Path */}
                    <Path d={path} fill="none" stroke={color} strokeWidth="2" />
                </G>
            </Svg>
        </View>
    );
};


const ExerciseLoadItem = ({ exercise, isCurrent, userLogs, treinoId }: { exercise: Exercicio, isCurrent: boolean, userLogs: Log[], treinoId: string }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [filter, setFilter] = useState<'acumulada' | 'maxima' | 'minima' | 'media'>('acumulada');

    const totalLoad = useMemo(() => {
        return exercise.series.reduce((sum, serie) => sum + calculateSerieLoad(serie), 0);
    }, [exercise.series]);

    const seriesDetails = useMemo(() => {
        if (exercise.series.length === 0) return "Nenhuma série";
        const firstSet = exercise.series[0];
        const peso = firstSet.peso || 0;
        const reps = firstSet.repeticoes;
        const numSeries = exercise.series.length;
        return `${peso}kg x ${reps} reps x ${numSeries} ${numSeries > 1 ? 'séries' : 'série'}`;
    }, [exercise.series]);
    
    const toDate = (date: any): Date | null => {
        if (!date) return null;
        if (typeof date.toDate === 'function') return date.toDate();
        const d = new Date(date);
        return isNaN(d.getTime()) ? null : d;
    };

    const exerciseHistoryData = useMemo(() => {
        const relevantLogs = userLogs
            .filter(log => log.treino.id === treinoId && log.horarioFim && log.status !== 'cancelado')
            .sort((a, b) => (toDate(a.horarioFim)?.getTime() || 0) - (toDate(b.horarioFim)?.getTime() || 0));

        return relevantLogs.map(log => {
            const loggedExercise = log.exerciciosFeitos.find(ex => ex.modeloId === exercise.modeloId);
            if (!loggedExercise || loggedExercise.series.length === 0) return 0;

            const weights = loggedExercise.series.map(s => s.peso || 0);

            switch (filter) {
                case 'acumulada':
                    return loggedExercise.series.reduce((sum, serie) => sum + calculateSerieLoad(serie), 0);
                case 'maxima':
                    return Math.max(...weights);
                case 'minima':
                    return Math.min(...weights);
                case 'media':
                    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
                    return totalWeight / weights.length;
                default:
                    return 0;
            }
        });
    }, [userLogs, treinoId, exercise.modeloId, filter]);

    return (
        <View style={styles.exerciseItemContainer}>
            <TouchableOpacity style={styles.exerciseItemHeader} onPress={() => setIsExpanded(!isExpanded)}>
                {exercise.modelo.imagemUrl ? (
                    <VideoListItem uri={exercise.modelo.imagemUrl} style={styles.exerciseImagePlaceholder} />
                ) : <View style={styles.exerciseImagePlaceholder} />}
                <View style={styles.exerciseInfo}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={styles.exerciseName}>{exercise.modelo.nome}</Text>
                        {isCurrent && <Text style={styles.currentTag}>Ex. atual</Text>}
                    </View>
                    <Text style={styles.exerciseGroup}>{exercise.modelo.grupoMuscular}</Text>
                    <Text style={styles.exerciseDetails}>{seriesDetails}</Text>
                </View>
                <View style={styles.exerciseLoadContainer}>
                    <Text style={styles.exerciseLoad}>{Math.round(totalLoad)}kg</Text>
                    <FontAwesome name={isExpanded ? "minus" : "plus"} size={20} color="#fff" />
                </View>
            </TouchableOpacity>
            {isExpanded && (
                <View style={styles.expandedContent}>
                    <View style={styles.filterContainer}>
                        <TouchableOpacity style={[styles.filterButton, filter === 'acumulada' && styles.filterButtonActive]} onPress={() => setFilter('acumulada')}>
                            <Text style={styles.filterButtonText}>Acumulada</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.filterButton, filter === 'maxima' && styles.filterButtonActive]} onPress={() => setFilter('maxima')}>
                            <Text style={styles.filterButtonText}>Máxima</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.filterButton, filter === 'minima' && styles.filterButtonActive]} onPress={() => setFilter('minima')}>
                            <Text style={styles.filterButtonText}>Mínima</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.filterButton, filter === 'media' && styles.filterButtonActive]} onPress={() => setFilter('media')}>
                            <Text style={styles.filterButtonText}>Média</Text>
                        </TouchableOpacity>
                    </View>
                    <SimpleLineChart
                        data={exerciseHistoryData}
                        width={Dimensions.get('window').width - 80}
                        height={100}
                    />
                </View>
            )}
        </View>
    );
};

interface WorkoutOverviewModalProps {
    visible: boolean;
    onClose: () => void;
    treino: Treino;
    exerciciosFeitos: Exercicio[];
    currentExerciseIndex: number;
    cargaAcumuladaTotal: number;
    userLogs: Log[];
}

export const WorkoutOverviewModal = ({
    visible,
    onClose,
    treino,
    currentExerciseIndex,
    cargaAcumuladaTotal,
    userLogs
}: WorkoutOverviewModalProps) => {

    const toDate = (date: any): Date | null => {
        if (!date) return null;
        if (typeof date.toDate === 'function') return date.toDate();
        const d = new Date(date);
        return isNaN(d.getTime()) ? null : d;
    };

    const previousLogsLoadHistory = useMemo(() => {
        if (!userLogs || !treino) return [];

        const relevantLogs = userLogs
            .filter(log => log.treino.id === treino.id && log.horarioFim && log.status !== 'cancelado')
            .sort((a, b) => (toDate(a.horarioFim)?.getTime() || 0) - (toDate(b.horarioFim)?.getTime() || 0));

        const history = relevantLogs.map(log => 
            log.exerciciosFeitos.reduce((totalLoad, ex) => 
                totalLoad + ex.series.reduce((sum, serie) => sum + calculateSerieLoad(serie), 0), 0)
        );
        return history;
    }, [userLogs, treino]);

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <View style={styles.modalSafeArea}>
                <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Visão Geral Do Treino</Text>
                    <TouchableOpacity onPress={onClose}><FontAwesome name="close" size={24} color="#fff" /></TouchableOpacity>
                </View>
                <FlatList
                    data={treino.exercicios}
                    keyExtractor={(item) => item.modeloId}
                    contentContainerStyle={styles.listContentContainer}
                    ListHeaderComponent={
                        <>
                            <View style={styles.summaryCard}>
                                <Text style={styles.summaryLabel}>Carga acumulada até agora</Text>
                                <Text style={styles.summaryValue}>{Math.round(cargaAcumuladaTotal).toLocaleString('pt-BR')} kg</Text>
                            </View>
                            <Text style={styles.listTitle}>Treinos Anteriores</Text>
                            <View style={styles.chartContainer}>
                                <SimpleLineChart
                                    data={previousLogsLoadHistory}
                                    width={Dimensions.get('window').width - 40}
                                    height={150}
                                />
                            </View>
                            <View style={styles.listHeader}>
                                <Text style={styles.listTitle}>Carga por exercício</Text>
                                <FontAwesome5 name="sort" size={20} color="#fff" />
                            </View>
                        </>
                    }
                    renderItem={({ item, index }) => (
                        <ExerciseLoadItem
                            exercise={item}
                            isCurrent={index === currentExerciseIndex}
                            userLogs={userLogs}
                            treinoId={treino.id}
                        />
                    )}
                />
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalSafeArea: { flex: 1, backgroundColor: '#030405' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 20 },
    modalTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
    listContentContainer: { paddingHorizontal: 20, paddingBottom: 40 },
    summaryCard: { backgroundColor: '#1f1f1f', borderRadius: 12, padding: 20, alignItems: 'center', marginBottom: 20 },
    summaryLabel: { color: '#aaa', fontSize: 16 },
    summaryValue: { color: '#fff', fontSize: 36, fontWeight: 'bold', marginTop: 8 },
    chartContainer: { backgroundColor: '#1f1f1f', borderRadius: 12, paddingVertical: 10, alignItems: 'center', marginBottom: 30 },
    chartEmptyText: { color: '#aaa', fontSize: 14 },
    listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, paddingHorizontal: 5 },
    listTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 10 },
    exerciseItemContainer: { backgroundColor: '#1f1f1f', borderRadius: 12, marginBottom: 10, },
    exerciseItemHeader: { flexDirection: 'row', alignItems: 'center', padding: 15 },
    exerciseImagePlaceholder: { width: 60, height: 60, borderRadius: 8, backgroundColor: '#333', marginRight: 15 },
    exerciseInfo: { flex: 1, gap: 2 },
    exerciseName: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginRight: 8 },
    exerciseGroup: { color: '#aaa', fontSize: 14, textTransform: 'capitalize' },
    exerciseDetails: { color: '#ccc', fontSize: 12, marginTop: 2 },
    currentTag: { backgroundColor: '#1cb0f6', color: '#fff', fontSize: 10, fontWeight: 'bold', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden', alignSelf: 'flex-start' },
    exerciseLoadContainer: { alignItems: 'center', justifyContent: 'center', paddingLeft: 10, gap: 8 },
    exerciseLoad: { color: '#fff', fontSize: 20, fontWeight: 'bold', },
    expandedContent: { marginTop: 10, borderTopWidth: 1, borderTopColor: '#333', paddingTop: 10, paddingHorizontal: 15, paddingBottom: 15 },
    historyTitle: { color: '#ccc', fontSize: 14, marginBottom: 5, alignSelf: 'center' },
    filterContainer: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 15 },
    filterButton: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 15, backgroundColor: '#333' },
    filterButtonActive: { backgroundColor: '#1cb0f6' },
    filterButtonText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
});
