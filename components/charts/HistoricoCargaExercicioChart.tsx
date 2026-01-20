
import { Serie } from '@/models/exercicio';
import { Log } from '@/models/log';
import React, { useEffect, useMemo, useState } from 'react';
import { Dimensions, Text, View } from 'react-native';
import { BarChart } from 'react-native-chart-kit';
import Animated from 'react-native-reanimated';

// --- Helpers ---
interface SerieComStatus extends Omit<Serie, 'concluido'> {
    concluido?: boolean;
}

const toDate = (date: any): Date | null => {
    if (!date) return null;
    if (typeof date.toDate === 'function') return date.toDate();
    const d = new Date(date);
    return isNaN(d.getTime()) ? null : d;
};

interface Props {
    logs: Log[];
    exerciseId: string;
    metric?: 'volume' | 'volume_per_rep' | 'reps';
    style?: any;
    onDataReady?: (hasData: boolean) => void;
}

export const HistoricoCargaExercicioChart = ({ logs, exerciseId, metric = 'volume', style, onDataReady }: Props) => {
    const [animatedData, setAnimatedData] = useState<number[]>([]);
    const [showValues, setShowValues] = useState<boolean[]>([]);

    const chartData = useMemo(() => {
        if (!logs || logs.length === 0) {
            return { labels: [], datasets: [{ data: [], colors: [] }], originalData: [], maxValue: 1, hasData: false };
        }

        const sortedLogs = [...logs].sort((a, b) => toDate(a.horarioInicio)!.getTime() - toDate(b.horarioInicio)!.getTime());

        // Take last 6 logs for better visibility
        const logsForChart = sortedLogs.slice(-6);

        const labels = logsForChart.map(l => {
            const date = toDate(l.horarioInicio);
            return date ? `${date.getDate()}/${date.getMonth() + 1}` : '';
        });

        const data = logsForChart.map(log => {
            const exercise = log.exercicios.find(e => e.modeloId === exerciseId);
            if (!exercise || !exercise.series) return 0;

            const sets = exercise.series;

            if (metric === 'volume') {
                let volume = 0;
                sets.forEach((s: any) => {
                    const peso = parseFloat(String(s.peso || 0));
                    const reps = parseFloat(String(s.repeticoes || 0));
                    volume += (peso * reps);
                });
                return Math.round(volume);
            }

            if (metric === 'reps') {
                let totalReps = 0;
                sets.forEach((s: any) => {
                    totalReps += parseFloat(String(s.repeticoes || 0));
                });
                return totalReps;
            }

            if (metric === 'volume_per_rep') {
                let totalVolume = 0;
                let totalReps = 0;
                sets.forEach((s: any) => {
                    const weight = parseFloat(String(s.peso || 0));
                    const reps = parseFloat(String(s.repeticoes || 0));
                    totalVolume += (weight * reps);
                    totalReps += reps;
                });

                return totalReps > 0 ? Math.round((totalVolume / totalReps) * 10) / 10 : 0;
            }

            return 0;
        });

        const maxValue = Math.max(...data, 1);

        const colors = logsForChart.map(() => (opacity = 1) => `rgba(28, 176, 246, ${opacity})`);

        return {
            labels,
            datasets: [{
                data: data,
                colors: colors
            }],
            originalData: data,
            maxValue: maxValue,
            hasData: data.some(v => v > 0)
        };

    }, [logs, exerciseId]);

    useEffect(() => {
        if (chartData.hasData) {
            setAnimatedData(chartData.originalData.map(() => 0));
            setShowValues(chartData.originalData.map(() => false));

            chartData.originalData.forEach((targetValue, index) => {
                const delay = index * 100;
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
                            setShowValues(prev => {
                                const newShowValues = [...prev];
                                newShowValues[index] = true;
                                return newShowValues;
                            });
                        }
                    };
                    requestAnimationFrame(animate);
                }, delay);
            });
        }
    }, [chartData.hasData, chartData.originalData, chartData.maxValue]);

    useEffect(() => {
        if (onDataReady) {
            onDataReady(chartData.hasData);
        }
    }, [chartData.hasData, onDataReady]);

    if (!chartData.hasData) {
        return (
            <View style={{ height: 150, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ color: '#666' }}>Sem dados suficientes.</Text>
            </View>
        );
    }

    const barChartConfig = {
        backgroundColor: "transparent",
        backgroundGradientFrom: "#1E2923",
        backgroundGradientTo: "#08130D",
        backgroundGradientFromOpacity: 0,
        backgroundGradientToOpacity: 0,
        decimalPlaces: 0,
        color: (opacity = 1) => `rgba(28, 176, 246, ${opacity})`,
        labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
        propsForBackgroundLines: {
            strokeDasharray: "4",
            stroke: "rgba(255, 255, 255, 0.1)",
            strokeWidth: 1
        },
    };

    return (
        <Animated.View style={style}>
            <View style={{ height: 220, alignItems: 'center' }}>
                <BarChart
                    data={{
                        labels: chartData.labels,
                        datasets: [{
                            data: animatedData.length > 0 ? animatedData : [0],
                            colors: chartData.datasets[0].colors
                        }]
                    }}
                    width={Dimensions.get('window').width - 40} // Full modal width approx
                    height={220}
                    yAxisLabel=""
                    yAxisSuffix=""
                    chartConfig={barChartConfig}
                    style={{ marginTop: 10, borderRadius: 8 }}
                    fromZero={true}
                    showValuesOnTopOfBars={true}
                    withCustomBarColorFromData={true}
                    withInnerLines={true}
                    withHorizontalLabels={false}
                    flatColor={true}
                />
            </View>
        </Animated.View>
    );
};
