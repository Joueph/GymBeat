import { Exercicio, Serie } from '@/models/exercicio';
import { Log } from '@/models/log';
import { Usuario } from '@/models/usuario';
import { calculateLoadForSerie, calculateTotalVolume } from '@/utils/volumeUtils';
import { FontAwesome } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { VideoView as Video, VideoPlayer, useVideoPlayer } from 'expo-video';
import React, { useEffect, useMemo, useState } from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BarChart } from 'react-native-chart-kit';
import { SvgUri } from 'react-native-svg'; // Certifique-se de que esta importação está correta

// --- Helpers ---
interface SerieComStatus extends Serie {
    concluido?: boolean;
}

// Interface local para lidar com o log populado
interface LogWithUser extends Log {
    usuario?: Partial<Usuario>;
}

const toDate = (date: any): Date | null => {
    if (!date) return null;
    if (typeof date.toDate === 'function') return date.toDate();
    const d = new Date(date);
    return isNaN(d.getTime()) ? null : d;
};

const calculateWeightStatsForExercise = (exercise: Exercicio) => {
    const weights = (exercise.series as SerieComStatus[]).filter(s => s.concluido && s.peso && s.peso > 0).map(s => s.peso!);
    if (weights.length === 0) return { max: 0, min: 0, avg: 0 };
    const sum = weights.reduce((a, b) => a + b, 0);
    return {
        max: Math.max(...weights),
        min: Math.min(...weights),
        avg: sum / weights.length,
    };
};
// --- Fim Helpers ---

// Componente de Mídia
const MediaDisplay = ({ uri, style }: { uri: string; style: any }) => {
    if (uri?.toLowerCase().endsWith('.svg')) {
        return <SvgUri width={style.width} height={style.height} uri={uri} style={style} />;
    }
    const player: VideoPlayer | null = useVideoPlayer(uri, (p: VideoPlayer) => {
        p.loop = true;
        p.muted = true;
        p.play();
    });
    React.useEffect(() => () => player.release(), [player]);
    return <Video player={player} style={style} contentFit="cover" nativeControls={false} />;
};

// Gráfico de histórico individual
const ExerciseHistoryChart = ({ exerciseId, allUserLogs, currentLogId, userWeight }: { exerciseId: string; allUserLogs: Log[]; currentLogId: string; userWeight: number }) => {
    const [filter, setFilter] = useState<'acumulada' | 'maxima' | 'media' | 'minima'>('acumulada');
    const [animatedData, setAnimatedData] = useState<number[]>([]);

    const historicalExerciseData = useMemo(() => {
        const relevantLogs = (allUserLogs || [])
            .filter(log => log.status !== 'cancelado' && log.horarioInicio && log.exercicios.some(ex => ex.modeloId === exerciseId))
            .sort((a, b) => toDate(a.horarioInicio)!.getTime() - toDate(b.horarioInicio)!.getTime());
        
        const currentIndex = relevantLogs.findIndex(log => log.id === currentLogId);
        const logsForChart = relevantLogs.slice(Math.max(0, currentIndex - 3), currentIndex + 1);

        return logsForChart;
    }, [allUserLogs, exerciseId]);

    const chartData = useMemo(() => {
        const labels = historicalExerciseData.map(l => {
            const date = toDate(l.horarioInicio);
            return date ? `${date.getDate()}/${date.getMonth() + 1}` : '';
        });

        const dataPoints = historicalExerciseData.map(log => {
            const exercise = log.exercicios.find(ex => ex.modeloId === exerciseId);
            if (!exercise) return 0;

            switch (filter) {
                case 'acumulada':
                    return calculateTotalVolume([exercise], userWeight, true);
                case 'maxima':
                    return calculateWeightStatsForExercise(exercise).max;
                case 'media':
                    return calculateWeightStatsForExercise(exercise).avg;
                case 'minima':
                    return calculateWeightStatsForExercise(exercise).min;
                default:
                    return 0;
            }
        });

        const colors = historicalExerciseData.map((log) =>
            log.id === currentLogId
            ? (opacity = 1) => `rgba(28, 176, 246, ${opacity})`
            : (opacity = 1) => `rgba(100, 100, 100, ${opacity})`
        );

        return {
            labels,
            datasets: [{ data: dataPoints, colors: colors }],
            originalData: dataPoints,
            hasData: dataPoints.length > 0,
            maxValue: Math.max(...dataPoints, 1),
        };
    }, [historicalExerciseData, filter, currentLogId, userWeight]);

    useEffect(() => {
        if (chartData.hasData) {
            setAnimatedData(chartData.originalData.map(() => 0));
            chartData.originalData.forEach((targetValue, index) => {
                const delay = index * 150;
                const animDuration = 500;
                setTimeout(() => {
                    const startTime = Date.now();
                    const animate = () => {
                        const elapsed = Date.now() - startTime;
                        const progress = Math.min(elapsed / animDuration, 1);
                        const easedProgress = 1 - Math.pow(1 - progress, 3);
                        setAnimatedData(prev => {
                            const newData = [...prev];
                            newData[index] = easedProgress * targetValue;
                            return newData;
                        });
                        if (progress < 1) {
                            requestAnimationFrame(animate);
                        } else {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }
                    };
                    requestAnimationFrame(animate);
                }, delay);
            });
        }
    }, [chartData.hasData, chartData.originalData]);

    if (historicalExerciseData.length < 1) {
        return <Text style={styles.chartEmptyText}>Histórico insuficiente para exibir o gráfico.</Text>;
    }

    const barChartConfig = {
        backgroundColor: "transparent", backgroundGradientFromOpacity: 0, backgroundGradientToOpacity: 0, decimalPlaces: 0,
        color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
        labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
        propsForBackgroundLines: { strokeDasharray: "4", stroke: "rgba(255, 255, 255, 0.1)", strokeWidth: 1 },
        formatYLabel: (yValue: string) => `${Math.round(parseFloat(yValue))}kg`,
    };

    return (
        <View style={styles.expandedContent}>
            <View style={styles.filterContainer}>
                <TouchableOpacity style={[styles.filterButton, filter === 'acumulada' && styles.filterButtonActive]} onPress={() => setFilter('acumulada')}><Text style={styles.filterButtonText}>Acumulada</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.filterButton, filter === 'maxima' && styles.filterButtonActive]} onPress={() => setFilter('maxima')}><Text style={styles.filterButtonText}>Máxima</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.filterButton, filter === 'media' && styles.filterButtonActive]} onPress={() => setFilter('media')}><Text style={styles.filterButtonText}>Média</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.filterButton, filter === 'minima' && styles.filterButtonActive]} onPress={() => setFilter('minima')}><Text style={styles.filterButtonText}>Mínima</Text></TouchableOpacity>
            </View>
            <BarChart
                data={{
                    labels: chartData.labels,
                    datasets: [{
                        data: animatedData.length > 0 && animatedData.some(v => v > 0) ? animatedData : [chartData.maxValue],
                        colors: chartData.datasets[0].colors
                    }]
                }}
                width={Dimensions.get('window').width - 60}
                height={180}
                yAxisLabel=""
                yAxisSuffix=""
                chartConfig={barChartConfig}
                style={styles.chartStyle}
                fromZero={true}
                showValuesOnTopOfBars={true}
                withCustomBarColorFromData={true}
                segments={4}
            />
        </View>
    );
};

// Componente Principal
interface Props {
    item: Exercicio;
    allUserLogs: Log[];
    log: Log; // O log atual para contexto
    userWeight: number; // Peso do usuário para cálculos
}

export const ExpandableExerciseItem = ({ item, allUserLogs, log, userWeight }: Props) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const totalLoad = calculateTotalVolume([item], userWeight, true);
    const completedSeries = (item.series as SerieComStatus[]).filter(s => s.concluido);
    const seriesInfo = `${completedSeries.length} séries concluídas`;

    const renderSeriesDetails = () => {
        if (completedSeries.length === 0) {
            return <Text style={styles.chartEmptyText}>Nenhuma série concluída para este exercício.</Text>;
        }

        let normalSeriesCounter = 0;

        return (
            <View style={styles.seriesDetailContainer}>
                <Text style={styles.seriesDetailHeader}>Cálculo da Carga:</Text>
                {completedSeries.map((serie: SerieComStatus, index: number) => {
                    if (!serie) return null;

                    const isDropset = serie.type === 'dropset';
                    if (!isDropset) {
                        normalSeriesCounter++;
                    }

                    const { calculationString } = calculateLoadForSerie(serie, item, userWeight);

                    return (
                        <View key={serie.id || `serie-${index}`} style={[styles.seriesDetailRow, isDropset && styles.dropsetRow]}>
                            <Text style={styles.seriesDetailText}>
                                {isDropset ? ' | Drop:' : `Série ${normalSeriesCounter}:`}
                            </Text>
                            <Text style={styles.seriesDetailCalculation}>{calculationString}</Text>
                        </View>
                    );
                })}
            </View>
        );
    };

    return (
        <View style={styles.exerciseItemContainer}>
            <TouchableOpacity style={styles.exerciseItemHeader} onPress={() => setIsExpanded(!isExpanded)}>
                {item.modelo.imagemUrl ? <MediaDisplay uri={item.modelo.imagemUrl} style={styles.exerciseVideo} /> : <View style={styles.exerciseImagePlaceholder} />}
                <View style={styles.exerciseInfo}>
                    <Text style={styles.exerciseName}>{item.modelo.nome}</Text>
                    <Text style={styles.exerciseDetails}>{item.modelo.grupoMuscular} • {seriesInfo}</Text>
                </View>
                <View style={styles.exerciseRight}><Text style={styles.exerciseLoad}>{totalLoad.toLocaleString('pt-BR')} kg</Text><FontAwesome name={isExpanded ? "chevron-up" : "chevron-down"} size={16} color="#888" style={{ marginTop: 4 }} /></View>
            </TouchableOpacity>
            {isExpanded && (
                <View style={styles.expandedContent}>
                    {renderSeriesDetails()}
                    <ExerciseHistoryChart exerciseId={item.modeloId} allUserLogs={allUserLogs} currentLogId={log.id} userWeight={userWeight} />
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
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
    exerciseDetails: { color: '#aaa', fontSize: 14, marginTop: 4, textTransform: 'capitalize' },
    exerciseRight: { alignItems: 'flex-end', justifyContent: 'center', paddingLeft: 10 },
    exerciseLoad: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
    chartStyle: { marginTop: 10, borderRadius: 8 },
    expandedContent: {
        paddingHorizontal: 15,
        paddingBottom: 15,
        borderTopWidth: 1,
        borderTopColor: '#333',
        marginTop: 10,
    },
    chartEmptyText: {
        color: '#888',
        textAlign: 'center',
        paddingVertical: 20,
    },
    seriesDetailContainer: {
        marginBottom: 15,
        paddingTop: 15,
        borderBottomWidth: 1, borderBottomColor: '#333',
    },
    seriesDetailHeader: { color: '#fff', fontSize: 14, fontWeight: 'bold', marginBottom: 10 },
    seriesDetailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 4,
    },
    dropsetRow: {
        marginLeft: 15,
        paddingLeft: 10,
    },
    seriesDetailText: { color: '#ccc', fontSize: 14 },
    seriesDetailCalculation: { color: '#fff', fontSize: 14, fontWeight: '500' },
    filterContainer: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 15 },
    filterButton: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 15, backgroundColor: '#333' },
    filterButtonActive: { backgroundColor: '#1cb0f6' },
    filterButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
});
