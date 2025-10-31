import { Exercicio, Serie } from '@/models/exercicio';
import { Log } from '@/models/log';
import { Treino } from '@/models/treino';
import { calculateLoadForSerie, calculateTotalVolume } from '@/utils/volumeUtils';
import { FontAwesome } from '@expo/vector-icons';
import { ResizeMode, Video } from 'expo-av'; // Changed from expo-video
import * as FileSystem from 'expo-file-system/legacy';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Modal, Platform, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';

// Flag para detecção do Expo Go
const IS_EXPO_GO = !__DEV__ || Platform.OS === 'ios';

// Adiciona a propriedade 'concluido' à interface Serie localmente
interface SerieComStatus extends Serie {
  concluido?: boolean;
}

// VideoListItem simplificado para Expo Go
const VideoListItem = React.memo(({ uri, style }: { uri: string; style: any }) => {
    const [localUri, setLocalUri] = useState<string | null>(null);
    const isWebP = uri?.toLowerCase().includes('.webp');
  
    useEffect(() => { 
      const manageMedia = async () => {
        if (!uri) return;
        const fileName = uri.split('/').pop()?.split('?')[0];
        if (!fileName) return;
  
        const localFileUri = `${FileSystem.cacheDirectory}${fileName}`;
        const fileInfo = await FileSystem.getInfoAsync(localFileUri);
  
        if (fileInfo.exists) {
          setLocalUri(localFileUri);
        } else {
          try {
            await FileSystem.downloadAsync(uri, localFileUri);
            setLocalUri(localFileUri);
          } catch (e) {
            console.error("Erro ao baixar a mídia:", e);
            setLocalUri(uri); // Fallback
          }
        }
      };
      manageMedia();
    }, [uri]);

    if (!localUri) {
      return <View style={[style, { backgroundColor: '#333', justifyContent: 'center', alignItems: 'center' }]}><ActivityIndicator color="#fff" /></View>;
    }

    if (isWebP) { // Handle WebP as Image
      return <Image source={{ uri: localUri || uri }} style={style} resizeMode="cover" />;
    }

    return (
      <Video
        source={{ uri: localUri || uri }}
        isMuted={true}
        isLooping={true}
        shouldPlay={true}
        resizeMode={ResizeMode.COVER}
        style={style}
      />
    );
});

const ExerciseLoadItem = React.memo(({ 
    exercise, 
    isCurrent, 
    cargaAcumuladaExercicio, 
    userWeight,
    userLogs,
    treinoId,
}: { 
    exercise: Exercicio; 
    isCurrent: boolean; 
    cargaAcumuladaExercicio: number; 
    userWeight: number;
    userLogs: Log[];
    treinoId: string;
}) => {
    const [isExpanded, setIsExpanded] = useState(false);

    // Calcula estatísticas simples do histórico
    const historyStats = useMemo(() => {
        if (!userLogs || !exercise) return null;
        
        try {
            const toDate = (date: any): Date | null => {
                if (!date) return null;
                try {
                    if (typeof date.toDate === 'function') return date.toDate();
                    const d = new Date(date);
                    return isNaN(d.getTime()) ? null : d;
                } catch (error) {
                    return null;
                }
            };

            const relevantLogs = userLogs
                .filter(log => log?.treino?.id === treinoId && log.status === 'concluido')
                .sort((a, b) => {
                    const dateA = toDate(a.horarioInicio);
                    const dateB = toDate(b.horarioInicio);
                    return (dateB?.getTime() || 0) - (dateA?.getTime() || 0);
                });

            if (relevantLogs.length === 0) return null;

            // Pega os últimos 3 treinos
            const recentLogs = relevantLogs.slice(0, 3);
            const loads = recentLogs.map(log => {
                const loggedExercise = log.exercicios?.find(ex => ex?.modeloId === exercise.modeloId);
                if (!loggedExercise) return 0;
                return calculateTotalVolume([loggedExercise], userWeight, true);
            }).filter(l => l > 0);

            if (loads.length === 0) return null;

            const lastLoad = loads[0];
            const avgLoad = loads.reduce((sum, l) => sum + l, 0) / loads.length;
            const maxLoad = Math.max(...loads);

            return {
                last: lastLoad,
                average: avgLoad,
                max: maxLoad,
                count: loads.length,
            };
        } catch (error) {
            console.warn('Error calculating history stats:', error);
            return null;
        }
    }, [userLogs, treinoId, exercise, userWeight]);

    const renderSeriesDetails = useCallback(() => {
        if (!exercise || !exercise.series) {
            return <Text style={styles.chartEmptyText}>Nenhuma série disponível.</Text>;
        }
        
        const completedSeries = (exercise.series as SerieComStatus[]).filter(s => s?.concluido === true);
        const totalSeries = exercise.series.length;
        let normalSeriesCounter = 0;

        return (
            <View style={styles.seriesDetailContainer}>
                {totalSeries > 0 && <View style={styles.progressBarContainer}>
                    <View style={styles.progressBarBackground}>
                        <View 
                            style={[
                                styles.progressBarFill, 
                                { width: `${(completedSeries.length / totalSeries) * 100}%` }
                            ]} 
                        />
                    </View>
                    <Text style={styles.progressText}>
                        {completedSeries.length}/{totalSeries} séries concluídas
                    </Text>
                </View>}

                {completedSeries.length > 0 && (
                    <>
                        <Text style={styles.seriesDetailHeader}>Séries Concluídas:</Text>
                        {completedSeries.map((serie, index) => {
                            if (!serie) return null;

                            const isDropset = serie.type === 'dropset';
                            if (!isDropset) {
                                normalSeriesCounter++;
                            }

                            const { calculationString } = calculateLoadForSerie(serie, exercise, userWeight);

                            const rowStyle: ViewStyle[] = [styles.seriesDetailRow];
                            if (isDropset) {
                                rowStyle.push(styles.dropsetRow);
                            }

                            return (
                                <View key={serie.id || `serie-${index}`} style={rowStyle}>
                                    <Text style={styles.seriesDetailText}>
                                        {isDropset ? ' | Drop:' : `Série ${normalSeriesCounter}:`}
                                    </Text>
                                    <Text style={styles.seriesDetailCalculation}>{calculationString}</Text>
                                </View>
                            );
                        })}
                    </>
                )}
                {historyStats && (
                    <View style={styles.historyStatsContainer}>
                        <Text style={styles.historyStatsTitle}>Histórico (últimos {historyStats.count} treinos):</Text>
                        <View style={styles.historyStatsGrid}>
                            <View style={styles.historyStatItem}>
                                <Text style={styles.historyStatLabel}>Último</Text>
                                <Text style={styles.historyStatValue}>{Math.round(historyStats.last)} kg</Text>
                            </View>
                            <View style={styles.historyStatItem}>
                                <Text style={styles.historyStatLabel}>Média</Text>
                                <Text style={styles.historyStatValue}>{Math.round(historyStats.average)} kg</Text>
                            </View>
                            <View style={styles.historyStatItem}>
                                <Text style={styles.historyStatLabel}>Máximo</Text>
                                <Text style={styles.historyStatValue}>{Math.round(historyStats.max)} kg</Text>
                            </View>
                        </View>
                    </View>
                )}
            </View>
        );
    }, [exercise, userWeight, historyStats]);

    const toggleExpanded = useCallback(() => {
        setIsExpanded(prev => !prev);
    }, []);

    return (
        <View style={[styles.exerciseItemContainer, isCurrent && styles.currentExerciseContainer]}>
            <TouchableOpacity 
                style={styles.exerciseItemHeader} 
                onPress={toggleExpanded}
                activeOpacity={0.7}
            >
                {exercise?.modelo?.imagemUrl ? (
                    <VideoListItem uri={exercise.modelo.imagemUrl} style={styles.exerciseImagePlaceholder} />
                ) : <View style={styles.exerciseImagePlaceholder} />}
                <View style={styles.exerciseInfo}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={styles.exerciseName} numberOfLines={1}>
                            {exercise?.modelo?.nome || 'Sem nome'}
                        </Text>
                        {isCurrent && <Text style={styles.currentTag}>Ex. atual</Text>}
                    </View>
                    <Text style={styles.exerciseGroup}>
                        {exercise?.modelo?.grupoMuscular || 'Sem grupo'}
                    </Text>
                </View>
                <View style={styles.exerciseLoadContainer}>
                    <Text style={styles.exerciseLoad}>{Math.round(cargaAcumuladaExercicio)}kg</Text>
                    <FontAwesome name={isExpanded ? "chevron-up" : "chevron-down"} size={16} color="#888" style={{ marginTop: 4 }} />
                </View>
            </TouchableOpacity>
            {isExpanded && (
                <View style={styles.expandedContent}>
                    {renderSeriesDetails()}
                </View>
            )}
        </View>
    );
});

interface WorkoutOverviewModalProps {
    visible: boolean;
    onClose: () => void;
    treino: Treino;
    currentExerciseIndex: number;
    cargaAcumuladaTotal: number;
    userLogs: Log[];
    horarioInicio: Date | null;
    userWeight: number;
}

export const WorkoutOverviewModal = ({
    visible,
    onClose,
    treino,
    currentExerciseIndex,
    cargaAcumuladaTotal,
    userLogs,
    horarioInicio,
    userWeight,
}: WorkoutOverviewModalProps) => {
    const [elapsedTime, setElapsedTime] = useState('00:00');

    const cargaEstimadaTotal = useMemo(() => {
        if (!treino?.exercicios) return 0;
        return calculateTotalVolume(treino.exercicios, userWeight, false);
    }, [treino?.exercicios, userWeight]);

    const overallProgress = useMemo(() => {
        if (!treino?.exercicios) return { completed: 0, total: 0, percentage: 0 };
        
        let completedSeries = 0;
        let totalSeries = 0;
        
        treino.exercicios.forEach(ex => {
            if (ex.series) {
                totalSeries += ex.series.length;
                completedSeries += (ex.series as SerieComStatus[]).filter(s => s?.concluido === true).length;
            }
        });
        
        const percentage = totalSeries > 0 ? (completedSeries / totalSeries) * 100 : 0;
        
        return {
            completed: completedSeries,
            total: totalSeries,
            percentage: Math.round(percentage),
        };
    }, [treino?.exercicios]);

    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;
        if (visible && horarioInicio) {
            const updateTime = () => {
                const now = new Date();
                const diffSeconds = Math.floor((now.getTime() - horarioInicio.getTime()) / 1000);
                const minutes = Math.floor(diffSeconds / 60).toString().padStart(2, '0');
                const seconds = (diffSeconds % 60).toString().padStart(2, '0');
                setElapsedTime(`${minutes}:${seconds}`);
            };
            
            updateTime();
            interval = setInterval(updateTime, 1000);
        }

        return () => {
            if (interval) {
                clearInterval(interval);
            }
        };
    }, [visible, horarioInicio]);

    const renderItem = useCallback(({ item, index }: { item: Exercicio; index: number }) => (
        <ExerciseLoadItem
            exercise={item}
            isCurrent={index === currentExerciseIndex}
            cargaAcumuladaExercicio={calculateTotalVolume([item], userWeight, true)}
            userWeight={userWeight}
            userLogs={userLogs || []}
            treinoId={treino.id}
        />
    ), [currentExerciseIndex, userWeight, userLogs, treino.id]);

    const keyExtractor = useCallback((item: Exercicio, index: number) => 
        item?.modeloId || `exercise-${index}`, 
    []);

    if (!treino || !treino.exercicios) {
        return null;
    }

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <View style={styles.modalSafeArea}>
                <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Visão Geral Do Treino</Text>
                    <TouchableOpacity onPress={onClose}>
                        <FontAwesome name="close" size={24} color="#fff" />
                    </TouchableOpacity>
                </View>
                <FlatList
                    data={treino.exercicios}
                    keyExtractor={keyExtractor}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContentContainer}
                    removeClippedSubviews={false}
                    maxToRenderPerBatch={5}
                    updateCellsBatchingPeriod={50}
                    initialNumToRender={3}
                    ListHeaderComponent={
                        <>
                            <View style={styles.infoCard}>
                                <Text style={styles.infoCardTitle}>Duração do Treino</Text>
                                <Text style={styles.durationValue}>{elapsedTime}</Text>
                            </View>

                            <View style={styles.infoCard}>
                                <Text style={styles.infoCardTitle}>Progresso Geral</Text>
                                <View style={styles.progressBarContainer}>
                                    <View style={styles.progressBarBackground}>
                                        <View 
                                            style={[
                                                styles.progressBarFill, 
                                                { width: `${overallProgress.percentage}%` }
                                            ]} 
                                        />
                                    </View>
                                    <Text style={styles.progressText}>
                                        {overallProgress.completed}/{overallProgress.total} séries ({overallProgress.percentage}%)
                                    </Text>
                                </View>
                            </View>

                            <View style={styles.infoCard}>
                                <Text style={styles.infoCardTitle}>Carga Acumulada</Text>
                                <Text style={styles.loadValue}>
                                    {Math.round(cargaAcumuladaTotal).toLocaleString('pt-BR')} kg
                                </Text>
                                <Text style={styles.estimatedLoadLabel}>
                                    Estimado para hoje: {Math.round(cargaEstimadaTotal).toLocaleString('pt-BR')} kg
                                </Text>
                            </View>

                            <Text style={[styles.listTitle, { marginTop: 20, marginBottom: 15}]}>
                                Carga por Exercício
                            </Text>
                        </>
                    }
                />
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalSafeArea: { flex: 1, backgroundColor: '#141414' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#222', marginBottom: 10 },
    modalTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
    listContentContainer: { paddingHorizontal: 15, paddingBottom: 30 },
    infoCard: { backgroundColor: '#1C1C1E', borderRadius: 12, padding: 15, marginTop: 10, borderWidth: 1, borderColor: '#222' },
    infoCardTitle: { color: '#aaa', fontSize: 14, marginBottom: 10 },
    durationValue: { color: '#fff', fontSize: 28, fontWeight: 'bold', textAlign: 'center' },
    loadValue: { color: '#fff', fontSize: 28, fontWeight: 'bold', textAlign: 'center', paddingVertical: 10 },
    estimatedLoadLabel: { color: '#aaa', fontSize: 12, textAlign: 'center', marginTop: -5, marginBottom: 5, },
    progressBarContainer: { paddingVertical: 5 },
    progressBarBackground: { height: 8, backgroundColor: '#333', borderRadius: 4, overflow: 'hidden' },
    progressBarFill: { height: '100%', backgroundColor: '#1cb0f6', borderRadius: 4 },
    progressText: { color: '#fff', fontSize: 16, fontWeight: 'bold', textAlign: 'center', marginTop: 10 },
    comparisonContainer: { marginTop: 15, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#333' },
    comparisonLabel: { color: '#aaa', fontSize: 12, marginBottom: 5 },
    comparisonRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5 },
    comparisonValue: { fontSize: 16, fontWeight: 'bold' },
    historyCount: { color: '#aaa', fontSize: 11, marginTop: 5 },
    chartEmptyText: { color: '#aaa', fontSize: 14 },
    listTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
    exerciseItemContainer: {
        backgroundColor: '#1C1C1E',
        borderRadius: 12,
        marginBottom: 10,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'transparent',
    },
    currentExerciseContainer: {
        borderColor: '#1cb0f6',
    },
    exerciseItemHeader: { flexDirection: 'row', alignItems: 'center', padding: 15 },
    exerciseImagePlaceholder: { width: 60, height: 60, borderRadius: 8, backgroundColor: '#333', marginRight: 15 },
    exerciseInfo: { flex: 1 },
    exerciseName: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginRight: 8, flexShrink: 1 },
    exerciseGroup: { color: '#aaa', fontSize: 14, textTransform: 'capitalize', marginTop: 2 },
    currentTag: { backgroundColor: '#1cb0f6', color: '#fff', fontSize: 10, fontWeight: 'bold', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden', alignSelf: 'flex-start' },
    exerciseLoadContainer: { alignItems: 'flex-end', justifyContent: 'center', paddingLeft: 10 },
    exerciseLoad: { color: '#fff', fontSize: 18, fontWeight: 'bold', },
    expandedContent: { marginTop: 10, borderTopWidth: 1, borderTopColor: '#333', paddingTop: 10, paddingHorizontal: 15, paddingBottom: 15 },
    seriesDetailContainer: {
        marginBottom: 10,
        paddingTop: 5,
    },
    seriesDetailHeader: { color: '#fff', fontSize: 14, fontWeight: 'bold', marginBottom: 10, marginTop: 10 },
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
    historyStatsContainer: {
        marginTop: 15,
        paddingTop: 15,
        borderTopWidth: 1,
        borderTopColor: '#333',
    },
    historyStatsTitle: { color: '#fff', fontSize: 14, fontWeight: 'bold', marginBottom: 10 },
    historyStatsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    historyStatItem: {
        alignItems: 'center',
    },
    historyStatLabel: { color: '#aaa', fontSize: 12, marginBottom: 5 },
    historyStatValue: { color: '#1cb0f6', fontSize: 16, fontWeight: 'bold' },
});