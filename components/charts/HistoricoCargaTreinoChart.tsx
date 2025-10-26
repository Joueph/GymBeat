import { Serie } from '@/models/exercicio';
import { Log } from '@/models/log';
import { calculateTotalVolume } from '@/utils/volumeUtils';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useMemo, useState } from 'react';
import { Dimensions, View } from 'react-native';
import { BarChart } from 'react-native-chart-kit';
import Animated from 'react-native-reanimated';

// --- Helpers ---
interface SerieComStatus extends Serie {
    concluido?: boolean;
}

const toDate = (date: any): Date | null => {
    if (!date) return null;
    if (typeof date.toDate === 'function') return date.toDate();
    const d = new Date(date);
    return isNaN(d.getTime()) ? null : d;
};

interface Props {
    currentLog: Log;
    allUserLogs: Log[];
    style?: any;
    onDataReady?: (hasData: boolean) => void;
}

export const HistoricoCargaTreinoChart = ({ currentLog, allUserLogs, style, onDataReady }: Props) => {
    const [animatedData, setAnimatedData] = useState<number[]>([]);
    const [showValues, setShowValues] = useState<boolean[]>([]);

    const chartData = useMemo(() => {
        // --- INÍCIO DA CORREÇÃO ---
        // 1. Filtra TODOS os logs relevantes (incluindo o atual)
        const allRelevantLogs = (allUserLogs || [])
            .filter(log => log.horarioInicio && log.treino.id === currentLog.treino.id && log.status !== 'cancelado')
            .sort((a, b) => toDate(a.horarioInicio)!.getTime() - toDate(b.horarioInicio)!.getTime()); // 2. Ordena cronologicamente

        // 3. Encontra o índice do log atual (o que está sendo revisado)
        const currentIndex = allRelevantLogs.findIndex(log => log.id === currentLog.id);

        // 4. Pega uma "fatia" de até 4 logs, terminando no log atual
        // Isso garante que o log atual seja o último e os anteriores estejam em ordem.
        const allLogsForChart = allRelevantLogs.slice(Math.max(0, currentIndex - 3), currentIndex + 1);
        // --- FIM DA CORREÇÃO ---

        const labels = allLogsForChart.map(l => {
            const date = toDate(l.horarioInicio);
            return date ? `${date.getDate()}/${date.getMonth() + 1}` : '';
        });

        const data = allLogsForChart.map(log => {
            // Prioriza o uso da carga já calculada e salva no log.
            if (log.cargaAcumulada && typeof log.cargaAcumulada === 'number' && log.cargaAcumulada > 0) {
                return log.cargaAcumulada;
            }
            // Como fallback, recalcula o volume usando a função utilitária correta.
            return calculateTotalVolume(log.exercicios, (log as any).usuario?.peso || 70, true);
        });
        const maxValue = Math.max(...data, 1);

        // --- INÍCIO DA CORREÇÃO (Cores) ---
        // Destaca apenas o log atual (currentLog) em azul e os outros em cinza.
        const colors = allLogsForChart.map((log, index) =>
            log.id === currentLog.id
            ? (opacity = 1) => `rgba(28, 176, 246, ${opacity})` // Azul para o log atual
            : (opacity = 1) => `rgba(100, 100, 100, ${opacity})` // Cinza para os outros
        );
        // --- FIM DA CORREÇÃO (Cores) ---

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

    }, [allUserLogs, currentLog]);

    // Inicializa a animação quando os dados mudam
    useEffect(() => {
        if (chartData.hasData) {
            // Inicializa todas as barras em 0
            setAnimatedData(chartData.originalData.map(() => 0));
            setShowValues(chartData.originalData.map(() => false));
            
            // Anima cada barra em sequência
            chartData.originalData.forEach((targetValue, index) => {
                const delay = index * 200; // 200ms de delay entre cada barra
                const animDuration = 500; // 500ms para cada animação
                
                setTimeout(() => {
                    const startTime = Date.now();
                    const animate = () => {
                        const elapsed = Date.now() - startTime;
                        const progress = Math.min(elapsed / animDuration, 1);
                        const easedProgress = 1 - Math.pow(1 - progress, 3); // easeOut cubic
                        
                        setAnimatedData(prev => {
                            const newData = [...prev];
                            newData[index] = easedProgress * targetValue;
                            return newData;
                        });
                        
                        if (progress < 1) {
                            requestAnimationFrame(animate);
                        } else {
                            // Mostra o valor quando a animação termina
                            setShowValues(prev => {
                                const newShowValues = [...prev];
                                newShowValues[index] = true;
                                return newShowValues;
                            });
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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
        return null;
    }

    const barChartConfig = {
        backgroundColor: "transparent",
        backgroundGradientFromOpacity: 0,
        backgroundGradientToOpacity: 0,
        decimalPlaces: 0,
        color: (opacity = 1) => `rgba(28, 176, 246, ${opacity})`,
        labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
        // --- INÍCIO DA ALTERAÇÃO (UI) ---
        propsForBackgroundLines: {
            strokeDasharray: "4", // Define as linhas como tracejadas
            stroke: "rgba(255, 255, 255, 0.1)",
            strokeWidth: 1
        },
        formatYLabel: (yValue: string) => {
            const val = parseFloat(yValue);
            return `${Math.round(val)}kg`; // Adiciona 'kg' ao rótulo Y
        }
        // --- FIM DA ALTERAÇÃO (UI) ---
    };

    return (
        <Animated.View style={style}>
            <View style={{ height: 220, alignItems: 'center' }}>
                <BarChart
                    data={{
                        labels: chartData.labels,
                        datasets: [{
                            data: animatedData.length > 0 && animatedData.some(v => v > 0) 
                                ? animatedData 
                                : [chartData.maxValue], // Força escala inicial
                            colors: chartData.datasets[0].colors
                        }]
                    }}
                    width={Dimensions.get('window').width - 70} 
                    height={220}
                    yAxisLabel=""
                    // yAxisSuffix="kg" // Removido para usar o formatYLabel
                    chartConfig={barChartConfig} 
                    style={{ marginTop: 10, borderRadius: 8 }}
                    fromZero={true}
                    showValuesOnTopOfBars={true}
                    // @ts-ignore - Propriedades para gradiente
                    withVerticalBarGradient={true}
                    withCustomBarColorFromData={true} // Garante que o array 'colors' funcione
                    verticalBarGradientFromOpacity={1}
                    verticalBarGradientToOpacity={0.6}
                    barPercentage={0.8}
                    segments={chartData.maxValue <= 5 ? chartData.maxValue : 5}
                />
            </View>
        </Animated.View>
    );
};
