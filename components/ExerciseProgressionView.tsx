
import { HistoricoCargaExercicioChart } from '@/components/charts/HistoricoCargaExercicioChart';
import { Log } from '@/models/log';
import { FontAwesome5 } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface ExerciseProgressionViewProps {
    exerciseId: string;
    currentTreinoId?: string; // Optional because we might be viewing from outside a workout
    allUserLogs: Log[];
}

type GraphMetric = 'volume' | 'volume_per_rep' | 'reps';

const formatDate = (date: any): string => {
    if (!date) return '-';
    const d = date.toDate ? date.toDate() : new Date(date);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
};

export const ExerciseProgressionView: React.FC<ExerciseProgressionViewProps> = ({
    exerciseId,
    currentTreinoId,
    allUserLogs
}) => {
    const [filterMode, setFilterMode] = useState<'all' | 'current'>('current');
    const [timeRange, setTimeRange] = useState<'3m' | '1y' | 'all'>('3m');
    const [metric, setMetric] = useState<GraphMetric>('volume');

    const filteredLogs = useMemo(() => {
        let logs = allUserLogs.filter(log =>
            log.exercicios && log.exercicios.some(e => e.modeloId === exerciseId) && log.status !== 'cancelado'
        );

        if (filterMode === 'current' && currentTreinoId) {
            logs = logs.filter(log => log.treino.id === currentTreinoId);
        }

        if (timeRange !== 'all') {
            const now = new Date();
            const cutoffDate = new Date();
            if (timeRange === '3m') {
                cutoffDate.setDate(now.getDate() - 90);
            } else if (timeRange === '1y') {
                cutoffDate.setDate(now.getDate() - 365);
            }
            logs = logs.filter(log => {
                const logDate = log.horarioInicio?.toDate ? log.horarioInicio.toDate() : new Date(log.horarioInicio);
                return logDate >= cutoffDate;
            });
        }

        return logs.sort((a, b) => {
            const dateA = a.horarioInicio?.toDate ? a.horarioInicio.toDate() : new Date(a.horarioInicio);
            const dateB = b.horarioInicio?.toDate ? b.horarioInicio.toDate() : new Date(b.horarioInicio);
            return dateB.getTime() - dateA.getTime(); // DESC for list
        });
    }, [allUserLogs, exerciseId, currentTreinoId, filterMode]);

    // For chart we usually want ASC date
    const chartLogs = useMemo(() => [...filteredLogs].reverse(), [filteredLogs]);

    const renderLogItem = ({ item }: { item: Log }) => {
        const exercise = item.exercicios.find(e => e.modeloId === exerciseId);
        if (!exercise) return null;

        return (
            <View style={styles.logItem}>
                <View style={styles.logHeader}>
                    <FontAwesome5 name="calendar-alt" size={14} color="#888" style={{ marginRight: 8 }} />
                    <Text style={styles.logDate}>{formatDate(item.horarioFim || item.horarioInicio)}</Text>
                    <Text style={styles.workoutName}>{item.treino.nome}</Text>
                </View>
                <View style={styles.setsContainer}>
                    {exercise.series.map((s, i) => (
                        <View key={i} style={styles.setTag}>
                            <Text style={styles.setText}>{s.repeticoes} x {s.peso}kg</Text>
                        </View>
                    ))}
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            {/* Toggle Filter */}
            {currentTreinoId && (
                <View style={styles.filterContainer}>
                    <TouchableOpacity
                        style={[styles.filterButton, filterMode === 'current' && styles.activeFilter]}
                        onPress={() => setFilterMode('current')}
                    >
                        <Text style={[styles.filterText, filterMode === 'current' && styles.activeFilterText]}>Este Treino</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.filterButton, filterMode === 'all' && styles.activeFilter]}
                        onPress={() => setFilterMode('all')}
                    >
                        <Text style={[styles.filterText, filterMode === 'all' && styles.activeFilterText]}>Todos</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Chart */}
            <View style={styles.chartContainer}>

                {/* Time Range Selector */}
                <View style={styles.timeRangeContainer}>
                    {[
                        { id: '3m', label: '3 Meses' },
                        { id: '1y', label: '1 Ano' },
                        { id: 'all', label: 'Tudo' },
                    ].map((tr) => (
                        <TouchableOpacity
                            key={tr.id}
                            style={[styles.rangeButton, timeRange === tr.id && styles.activeRangeButton]}
                            onPress={() => setTimeRange(tr.id as any)}
                        >
                            <Text style={[styles.rangeText, timeRange === tr.id && styles.activeRangeText]}>
                                {tr.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Metric Selector */}
                <View style={styles.metricSelector}>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={{ height: 40 }}
                        contentContainerStyle={{ alignItems: 'center' }}
                    >
                        {[
                            { id: 'volume', label: 'Volume Total' },
                            { id: 'reps', label: 'Reps Totais' },
                            { id: 'volume_per_rep', label: 'Volume / Rep' },
                        ].map((m) => (
                            <TouchableOpacity
                                key={m.id}
                                style={[styles.metricButton, metric === m.id && styles.activeMetricButton]}
                                onPress={() => setMetric(m.id as GraphMetric)}
                            >
                                <Text style={[styles.metricButtonText, metric === m.id && styles.activeMetricButtonText]}>
                                    {m.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                <HistoricoCargaExercicioChart
                    logs={chartLogs}
                    exerciseId={exerciseId}
                    metric={metric}
                />
            </View>

            {/* List */}
            <Text style={styles.sectionTitle}>Histórico Detalhado</Text>
            <FlatList
                data={filteredLogs}
                renderItem={renderLogItem}
                keyExtractor={item => item.id}
                scrollEnabled={false} // Assuming parent handles scroll
                ListEmptyComponent={<Text style={styles.emptyText}>Nenhum registro encontrado.</Text>}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 15,
    },
    filterContainer: {
        flexDirection: 'row',
        backgroundColor: '#333',
        borderRadius: 8,
        padding: 4,
        marginBottom: 20,
    },
    filterButton: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        borderRadius: 6,
    },
    activeFilter: {
        backgroundColor: '#1cb0f6',
    },
    filterText: {
        color: '#aaa',
        fontWeight: 'bold',
        fontSize: 14,
    },
    activeFilterText: {
        color: '#fff',
    },
    chartContainer: {
        marginBottom: 25,
        backgroundColor: '#1A1D23',
        padding: 10,
        borderRadius: 12,
    },
    timeRangeContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginBottom: 15,
        backgroundColor: '#111',
        borderRadius: 8,
        padding: 4,
        alignSelf: 'center',
        gap: 8, // Try gap, but rely on margins if needed
    },
    rangeButton: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 6,
        marginHorizontal: 2,
    },
    activeRangeButton: {
        backgroundColor: '#333',
    },
    rangeText: {
        color: '#666',
        fontSize: 12,
        fontWeight: '600',
    },
    activeRangeText: {
        color: '#fff',
    },
    metricSelector: {
        width: '100%',
        marginBottom: 10,
    },
    metricButton: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 15,
        backgroundColor: '#333',
        borderWidth: 1,
        borderColor: '#444',
        marginRight: 8, // Added redundant margin for older RN versions
    },
    activeMetricButton: {
        backgroundColor: '#1cb0f6',
        borderColor: '#1cb0f6',
    },
    metricButtonText: {
        color: '#888',
        fontSize: 12,
        fontWeight: '600',
    },
    activeMetricButtonText: {
        color: '#fff',
    },
    sectionTitle: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 10,
        alignSelf: 'flex-start',
    },
    logItem: {
        backgroundColor: '#1A1D23',
        padding: 15,
        borderRadius: 10,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#333',
    },
    logHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    logDate: {
        color: '#fff',
        fontWeight: 'bold',
        marginRight: 10,
    },
    workoutName: {
        color: '#888',
        fontSize: 12,
        flex: 1,
        textAlign: 'right',
    },
    setsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    setTag: {
        backgroundColor: '#2A2E37',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    setText: {
        color: '#ccc',
        fontSize: 12,
    },
    emptyText: {
        color: '#888',
        textAlign: 'center',
        marginTop: 20,
        fontStyle: 'italic',
    }
});
