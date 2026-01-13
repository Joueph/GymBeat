import { Serie } from '@/models/exercicio';
import { Log } from '@/models/log';
import { calculateTotalVolume } from '@/utils/volumeUtils';
import React, { useEffect, useMemo, useState } from 'react';
import { Dimensions, View } from 'react-native';
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
    currentLog?: Log | null; // Tornei opcional/null
    treinoId?: string; // Novo prop para identificar o treino quando não há currentLog
    allUserLogs: Log[];
    style?: any;
    onDataReady?: (hasData: boolean) => void;
    variant?: 'default' | 'minimal';
}

export const HistoricoCargaTreinoChart = ({ currentLog, treinoId, allUserLogs, style, onDataReady, variant = 'default' }: Props) => {
    const [animatedData, setAnimatedData] = useState<number[]>([]);
    const [showValues, setShowValues] = useState<boolean[]>([]);

    const chartData = useMemo(() => {
        // Define o ID alvo: usa o do log atual ou o prop treinoId
        const targetTreinoId = currentLog?.treino.id || treinoId;

        // Se não houver logs ou um ID alvo, não renderiza nada
        if (!allUserLogs || allUserLogs.length === 0 || !targetTreinoId) {
            // console.warn('[HistoricoCargaTreinoChart] Dados insuficientes: ', { logs: allUserLogs?.length, targetTreinoId });
            return { labels: [], datasets: [{ data: [], colors: [] }], originalData: [], maxValue: 1, hasData: false };
        }

        const allRelevantLogs = (allUserLogs || [])
            .filter(log => log.horarioInicio && log.treino.id === targetTreinoId && log.status !== 'cancelado')
            .sort((a, b) => toDate(a.horarioInicio)!.getTime() - toDate(b.horarioInicio)!.getTime());

        // Se tivermos um log atual, tentamos centralizá-lo nos últimos 4.
        // Se não (modo visualização apenas), pegamos os 4 últimos do histórico.
        let allLogsForChart: Log[] = [];
        const maxItems = variant === 'minimal' ? 8 : 4; // Show more bars in minimal mode

        if (currentLog) {
            const currentIndex = allRelevantLogs.findIndex(log => log.id === currentLog.id);
            allLogsForChart = allRelevantLogs.slice(Math.max(0, currentIndex - (maxItems - 1)), currentIndex + 1);
        } else {
            // Pega os últimos N logs disponíveis
            allLogsForChart = allRelevantLogs.slice(-maxItems);
        }

        const labels = allLogsForChart.map(l => {
            const date = toDate(l.horarioInicio);
            return date ? `${date.getDate()}/${date.getMonth() + 1}` : '';
        });

        const data = allLogsForChart.map(log => {
            if (log.cargaAcumulada && typeof log.cargaAcumulada === 'number' && log.cargaAcumulada > 0) {
                return log.cargaAcumulada;
            }
            return calculateTotalVolume(log.exercicios, (log as any).usuario?.peso || 70, true);
        });
        const maxValue = Math.max(...data, 1);

        // Cores: destaca o currentLog se existir, caso contrário deixa tudo padronizado
        const colors = allLogsForChart.map((log, index) => {
            if (variant === 'minimal') {
                return (opacity = 1) => `rgba(255, 255, 255, ${opacity})`; // White bars for minimal
            }

            return (currentLog && log.id === currentLog.id)
                ? (opacity = 1) => `rgba(28, 176, 246, ${opacity})` // Azul para o log atual
                : (opacity = 1) => `rgba(100, 100, 100, ${opacity})`; // Cinza para os outros
        });

        return {
            labels: labels.length > 0 ? labels : ['Hoje'],
            datasets: [{
                data: data.length > 0 ? data : [0],
                colors: colors
            }],
            originalData: data.length > 0 ? data : [0],
            maxValue: maxValue,
            hasData: data.length > 0
        };

    }, [allUserLogs, currentLog, treinoId, variant]);

    // Inicializa a animação quando os dados mudam
    useEffect(() => {
        if (chartData.hasData) {
            if (variant === 'minimal') {
                // No animation for minimal to keep it simple/performant or just instant
                setAnimatedData(chartData.originalData);
                return;
            }

            setAnimatedData(chartData.originalData.map(() => 0));
            setShowValues(chartData.originalData.map(() => false));

            chartData.originalData.forEach((targetValue, index) => {
                const delay = index * 200;
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
                            // Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); // Disable haptics on load
                        }
                    };
                    requestAnimationFrame(animate);
                }, delay);
            });
        }
    }, [chartData.hasData, chartData.originalData, chartData.maxValue, variant]);

    useEffect(() => {
        if (onDataReady) {
            onDataReady(chartData.hasData);
        }
    }, [chartData.hasData, onDataReady]);

    if (!chartData.hasData) {
        return null;
    }

    const barChartConfig = {
        backgroundColor: "transparent",
        backgroundGradientFrom: "#1E2923",
        backgroundGradientTo: "#08130D",
        backgroundGradientFromOpacity: 0,
        backgroundGradientToOpacity: 0,
        decimalPlaces: 0,
        color: (opacity = 1) => variant === 'minimal' ? `rgba(255, 255, 255, ${opacity})` : `rgba(28, 176, 246, ${opacity})`,
        labelColor: (opacity = 1) => variant === 'minimal' ? `rgba(0,0,0,0)` : `rgba(255, 255, 255, ${opacity})`,
        propsForBackgroundLines: {
            strokeDasharray: "4",
            stroke: variant === 'minimal' ? "rgba(255, 255, 255, 0.2)" : "rgba(255, 255, 255, 0.1)", // Visible lines for minimal
            strokeWidth: 1 // Visible width
        },
        formatYLabel: (yValue: string) => {
            if (variant === 'minimal') return '';
            const val = parseFloat(yValue);
            return `${Math.round(val)}kg`;
        }
    };

    // Minimal render
    if (variant === 'minimal') {
        return (
            <View style={style}>
                <BarChart
                    data={{
                        labels: chartData.labels, // Labels hidden via labelColor, but need same count
                        datasets: [{
                            data: chartData.originalData,
                            colors: chartData.datasets[0].colors
                        }]
                    }}
                    width={100}
                    height={40}
                    yAxisLabel=""
                    yAxisSuffix=""
                    chartConfig={{
                        ...barChartConfig,
                        barPercentage: 0.6,
                    }}
                    style={{ paddingRight: 0 }}
                    fromZero={true}
                    showValuesOnTopOfBars={false}
                    withInnerLines={true} // Enable inner lines
                    withHorizontalLabels={false}
                    withVerticalLabels={false}
                    withCustomBarColorFromData={true}
                    flatColor={true}
                />
            </View>
        );
    }

    return (
        <Animated.View style={style}>
            <View style={{ height: 220, alignItems: 'center' }}>
                <BarChart
                    data={{
                        labels: chartData.labels,
                        datasets: [{
                            data: animatedData.length > 0 && animatedData.some(v => v > 0)
                                ? animatedData
                                : [chartData.maxValue],
                            colors: chartData.datasets[0].colors
                        }]
                    }}
                    width={Dimensions.get('window').width - 70}
                    height={220}
                    yAxisLabel=""
                    yAxisSuffix=""
                    chartConfig={barChartConfig}
                    style={{ marginTop: 10, borderRadius: 8 }}
                    fromZero={true}
                    showValuesOnTopOfBars={true}
                    // @ts-ignore - Propriedades para gradiente
                    withVerticalBarGradient={true}
                    withCustomBarColorFromData={true}
                    verticalBarGradientFromOpacity={1}
                    verticalBarGradientToOpacity={0.6}
                    barPercentage={0.8}
                    segments={chartData.maxValue <= 5 ? chartData.maxValue : 5}
                />
            </View>
        </Animated.View>
    );
};