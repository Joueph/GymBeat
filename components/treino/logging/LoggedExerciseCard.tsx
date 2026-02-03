import { ExerciseDetailModal } from '@/app/(treino)/modals/ExerciseDetailModal';
import { ExerciseMenuAction, ExerciseOptionsMenu } from '@/components/menus/ExerciseOptionsMenu';
import { RepetitionsDrawer } from '@/components/RepetitionsDrawer';
import { RestTimeDrawer } from '@/components/RestTimeDrawer';
import { SetOptionsMenu } from '@/components/SetOptionsMenu';
import { TimeBasedSetDrawer } from '@/components/TimeBasedSetDrawer';
import { VideoListItem } from '@/components/VideoListItem';
import { Log } from '@/models/log';
import { LoggedExercise, SerieEdit } from '@/types/logging';
import { calculateLoadForSerie } from '@/utils/volumeUtils';
import { FontAwesome, FontAwesome5 } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useState } from 'react';
import {
    Image,
    LayoutAnimation,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

// Helper for cascade update
const cascadeUpdate = (series: SerieEdit[], index: number, field: keyof SerieEdit, oldValue: any): SerieEdit[] => {
    const newSeries = [...series];
    const newValue = newSeries[index][field];

    for (let i = index + 1; i < newSeries.length; i++) {
        if (newSeries[i][field] == oldValue) {
            newSeries[i] = { ...newSeries[i], [field]: newValue };
        } else {
            break;
        }
    }
    return newSeries;
};

interface LoggedExerciseCardProps {
    item: LoggedExercise;
    onSeriesChange: (newSeries: SerieEdit[]) => void;
    onRemove: () => void;
    onRestTimeChange: (newRestTime: number) => void;
    onNotesChange: (notes: string) => void;
    userWeight: number;
    onPesoBarraChange: (newPesoBarra: number) => void;
    startRestTimer: (
        duration: number,
        isExercise: boolean,
        timedSetInfo?: { exerciseIndex: number, setIndex: number },
        completedSetInfo?: { exerciseIndex: number, setIndex: number }
    ) => void;
    onMenuStateChange: (isOpen: boolean) => void;
    exerciseIndex: number;
    onOpenMachineDrawer: () => void;
    onReorder: () => void;
    onOpenNotes: () => void;
    onSubstitute: () => void;
    allUserLogs: Log[];
}

export const LoggedExerciseCard = ({
    item,
    onSeriesChange,
    onRemove,
    onRestTimeChange,
    onNotesChange,
    userWeight,
    onPesoBarraChange,
    startRestTimer,
    onMenuStateChange,
    exerciseIndex,
    onOpenMachineDrawer,
    onReorder,
    onOpenNotes,
    onSubstitute,
    allUserLogs,
}: LoggedExerciseCardProps) => {
    const [isDetailModalVisible, setDetailModalVisible] = useState(false);
    const [isRepDrawerVisible, setIsRepDrawerVisible] = useState(false);
    const [editingSetIndex, setEditingSetIndex] = useState<number | null>(null);
    const [isExerciseTimeDrawerVisible, setIsExerciseTimeDrawerVisible] = useState(false);
    const [isRestTimePickerVisible, setIsRestTimePickerVisible] = useState(false);
    const [isAdvancedOptionsVisible, setIsAdvancedOptionsVisible] = useState(false);

    const [series, setSeries] = useState<SerieEdit[]>(
        item.series.map((s, i) => ({
            ...s,
            id: s.id || `set-${Date.now()}-${i}`,
            type: s.type || 'normal',
            concluido: s.concluido || false,
            isWarmup: s.isWarmup || false,
        }))
    );

    const focusedWeightRef = React.useRef<number | null>(null);

    useEffect(() => {
        setSeries(item.series.map((s, i) => ({
            ...s,
            id: s.id || `set-${Date.now()}-${i}`,
            type: s.type || 'normal',
            concluido: s.concluido || false,
            isWarmup: s.isWarmup || false,
        })));
    }, [item.series, item]);

    useEffect(() => {
        const allSetsCompleted = series.length > 0 && series.every(s => s.concluido);
        if (allSetsCompleted) {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        }
    }, [series]);

    const handleSeriesUpdate = (newSeries: SerieEdit[]) => {
        setSeries(newSeries);
        onSeriesChange(newSeries);
        if (newSeries.length === 0) {
            onRemove();
        }
    };

    const handleSetOption = (
        option: 'toggleWarmup' | 'addDropset' | 'copy' | 'delete' | 'toggleTime',
        index: number
    ) => {
        setTimeout(() => {
            const newSets = [...series];
            if (option === 'delete') {
                newSets.splice(index, 1);
            } else if (option === 'copy') {
                newSets.splice(index + 1, 0, {
                    ...newSets[index],
                    id: `set-${Date.now()}`,
                });
            } else if (option === 'toggleTime') {
                const currentSet = newSets[index];
                currentSet.isTimeBased = !currentSet.isTimeBased;
                currentSet.repeticoes = currentSet.isTimeBased ? '60' : '10';
                if (currentSet.isTimeBased)
                    currentSet.peso = 0;
            } else if (option === 'addDropset') {
                const parentSet = newSets[index];
                newSets.splice(index + 1, 0, {
                    id: `set-${Date.now()}`,
                    repeticoes: parentSet.repeticoes,
                    peso: (parentSet.peso ?? 10) * 0.7,
                    type: 'dropset',
                    concluido: false,
                });
            } else if (option === 'toggleWarmup') {
                const currentSet = newSets[index];
                currentSet.isWarmup = !currentSet.isWarmup;
            }
            handleSeriesUpdate(newSets);
        }, 100);
    };

    const getRepetitionsValue = useCallback(() => {
        if (editingSetIndex === null || !series[editingSetIndex]) {
            return '10';
        }
        return String(series[editingSetIndex].repeticoes);
    }, [editingSetIndex, series]);

    const handleRepetitionsSave = (newReps: string) => {
        if (editingSetIndex === null) return;
        let newSets = [...series];

        const oldValue = newSets[editingSetIndex].repeticoes;
        newSets[editingSetIndex].repeticoes = newReps;

        newSets = cascadeUpdate(newSets, editingSetIndex, 'repeticoes', oldValue);

        handleSeriesUpdate(newSets);
        setIsRepDrawerVisible(false);
        setEditingSetIndex(null);
    };

    const handleToggleComplete = (index: number) => {
        const newSeries = [...series];
        const set = newSeries[index];
        const isCompleting = !set.concluido;

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        if (isCompleting && newSeries[index].type === 'normal') {
            const normalSets = newSeries.filter(s => s.type === 'normal');
            const currentNormalSetIndex = normalSets.findIndex(s => s.id === newSeries[index].id);
            const isLastNormalSet = currentNormalSetIndex === normalSets.length - 1;

            if (!isLastNormalSet) {
                const nextSet = newSeries[index + 1];
                if (set.isTimeBased) {
                    const duration = parseInt(String(set.repeticoes), 10);
                    if (!isNaN(duration) && duration > 0) {
                        startRestTimer(duration, true, { exerciseIndex, setIndex: index });
                        return;
                    }
                } else {
                    if (!nextSet || nextSet.type !== 'dropset') {
                        startRestTimer(
                            item.restTime || 60,
                            false,
                            undefined,
                            { exerciseIndex, setIndex: index }
                        );
                    }
                }
            }
        }

        newSeries[index].concluido = isCompleting;
        handleSeriesUpdate(newSeries);
    };

    const formatRestTime = (seconds: number) => {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        let result = '';
        if (minutes > 0) {
            result += `${minutes} min`;
        }
        if (remainingSeconds > 0) {
            if (minutes > 0) result += ' ';
            result += `${remainingSeconds} seg`;
        }
        return result.trim() || '0 seg';
    };

    const renderSetItem = ({ item: setItem, getIndex }: { item: SerieEdit, getIndex: () => number | undefined }) => {
        const itemIndex = getIndex();
        if (itemIndex === undefined) return null;

        return (
            <View
                key={setItem.id}
                style={{
                    marginLeft: setItem.type === 'dropset' ? 30 : 0,
                    marginBottom: 10,
                    flexDirection: 'row',
                    alignItems: 'center',
                }}
            >
                {setItem.concluido && <View style={styles.completedBar} />}
                <View
                    style={[
                        styles.setRow,
                        setItem.concluido && styles.setRowCompleted,
                        { flex: 1 },
                    ]}
                >
                    {setItem.type === 'dropset' ? (
                        <View style={{ width: 30, marginRight: 10, alignItems: 'center' }}>
                            <FontAwesome5 name="arrow-down" size={16} color="#888" />
                        </View>
                    ) : setItem.isWarmup ? (
                        <View style={{ width: 30, marginRight: 10, alignItems: 'center' }}>
                            <FontAwesome5 name="fire" size={16} color="#FFA500" />
                        </View>
                    ) : (
                        <View style={[styles.seriesNumberContainer]}>
                            <Text style={styles.seriesNumberText}>
                                {series.slice(0, itemIndex + 1).filter(s => s.type !== 'dropset').length}
                            </Text>
                        </View>
                    )}
                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>{setItem.isTimeBased ? 'Tempo (s)' : 'Reps'}</Text>
                        <TouchableOpacity
                            style={[
                                styles.repButton,
                                setItem.isTimeBased && styles.timeBasedButton,
                                (itemIndex > 0 && series[itemIndex - 1].repeticoes == setItem.repeticoes) && { opacity: 0.7 }
                            ]}
                            onPress={() => {
                                if (setItem.isTimeBased) {
                                    setEditingSetIndex(itemIndex);
                                    setIsExerciseTimeDrawerVisible(true);
                                } else {
                                    setEditingSetIndex(itemIndex);
                                    setIsRepDrawerVisible(true);
                                }
                            }}
                        >
                            {setItem.isTimeBased && <FontAwesome name="clock-o" size={16} color="#fff" />}
                            <Text style={[styles.repButtonText, setItem.isTimeBased && { marginLeft: 8 }]}>
                                {setItem.isTimeBased
                                    ? formatRestTime(parseInt(String(setItem.repeticoes), 10) || 0)
                                    : String(setItem.repeticoes)}
                            </Text>
                        </TouchableOpacity>
                    </View>
                    <Text style={styles.xText}>x</Text>
                    {item.modelo.caracteristicas?.isPesoCorporal ? (
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Peso</Text>
                            <View style={[styles.setInput, styles.bodyWeightContainer]}>
                                <Text style={styles.bodyWeightText}>Corporal</Text>
                            </View>
                        </View>
                    ) : (
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Peso (kg)</Text>
                            <TextInput
                                style={[
                                    styles.setInput,
                                    (itemIndex > 0 && series[itemIndex - 1].peso == setItem.peso) && { opacity: 0.7 }
                                ]}
                                placeholder="kg"
                                placeholderTextColor="#888"
                                keyboardType="decimal-pad"
                                editable={!setItem.isTimeBased}
                                value={String(setItem.peso || '')}
                                onFocus={() => {
                                    focusedWeightRef.current = typeof setItem.peso === 'number' ? setItem.peso : parseFloat(String(setItem.peso));
                                }}
                                onChangeText={(text) => {
                                    const newSets = [...series];
                                    newSets[itemIndex].peso = text as any;
                                    setSeries(newSets);
                                    handleSeriesUpdate(newSets);
                                }}
                                onEndEditing={(e) => {
                                    let newSets = [...series];
                                    const val = parseFloat(e.nativeEvent.text.replace(',', '.')) || 0;
                                    newSets[itemIndex] = { ...newSets[itemIndex], peso: val };

                                    if (focusedWeightRef.current !== null) {
                                        newSets = cascadeUpdate(newSets, itemIndex, 'peso', focusedWeightRef.current);
                                    }

                                    handleSeriesUpdate(newSets);
                                }}
                            />
                        </View>
                    )}
                    <TouchableOpacity
                        style={styles.checkboxContainer}
                        onPress={() => handleToggleComplete(itemIndex)}
                    >
                        <FontAwesome name={setItem.concluido ? 'check-square' : 'square-o'} size={24} color={setItem.concluido ? '#3B82F6' : '#aaa'} />
                    </TouchableOpacity>
                    <SetOptionsMenu
                        isTimeBased={!!setItem.isTimeBased}
                        isNormalSet={(setItem.type || 'normal') === 'normal'}
                        isWarmup={!!setItem.isWarmup}
                        onSelect={action => handleSetOption(action, itemIndex)}
                        isFirstSet={itemIndex === 0}
                    />
                </View>
            </View>
        );
    };

    return (
        <>
            <View style={styles.exercicioCard}>
                <View style={styles.exercicioHeader}>
                    <TouchableOpacity style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }} onPress={() => setDetailModalVisible(true)}>
                        <VideoListItem uri={item.modelo.imagemUrl} style={styles.exerciseVideo} />
                        <View style={styles.exerciseInfo}>
                            <Text style={styles.exercicioName}>{item.modelo.nome}</Text>
                            <Text style={styles.muscleGroup}>{item.modelo.grupoMuscular}</Text>
                        </View>
                    </TouchableOpacity>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <ExerciseOptionsMenu
                            showAdvanced={true}
                            onSelect={(action: ExerciseMenuAction) => {
                                if (action === 'delete') {
                                    onRemove();
                                } else if (action === 'changeMachine') {
                                    onOpenMachineDrawer();
                                } else if (action === 'editRestTime') {
                                    setIsRestTimePickerVisible(true);
                                } else if (action === 'addNote') {
                                    onOpenNotes();
                                } else if (action === 'advanced') {
                                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                    setIsAdvancedOptionsVisible(!isAdvancedOptionsVisible);
                                } else if (action === 'reorder') {
                                    onReorder();
                                } else if (action === 'replace') {
                                    onSubstitute();
                                }
                            }}
                        />
                    </View>
                </View>

                <>
                    <View>
                        {series.map((s, index) => renderSetItem({ item: s, getIndex: () => index }))}
                    </View>

                    <TouchableOpacity
                        style={styles.addSetButton}
                        onPress={() => {
                            const lastNormalSet = series.slice().reverse().find(s => s.type !== 'dropset');
                            const newSet = {
                                id: `set-${Date.now()}`,
                                repeticoes: lastNormalSet?.repeticoes || '10',
                                peso: lastNormalSet?.peso || 10,
                                type: 'normal' as const,
                                isTimeBased: lastNormalSet?.isTimeBased || false,
                                concluido: false,
                            };
                            handleSeriesUpdate([...series, newSet]);
                        }}
                    >
                        <Text style={styles.addSetButtonText}>+ Adicionar Série</Text>
                    </TouchableOpacity>

                    {isAdvancedOptionsVisible && (
                        <View style={styles.advancedOptionsContainer}>
                            {item.modelo.caracteristicas?.usaBarra && (
                                <View style={styles.barbellWeightCard}>
                                    <Text style={styles.barbellWeightLabel}>Peso da Barra</Text>
                                    <TextInput
                                        style={styles.barbellWeightInput}
                                        value={String(item.pesoBarra || 0)}
                                        onChangeText={(text) => {
                                            const newPeso = parseFloat(text.replace(',', '.')) || 0;
                                            onPesoBarraChange(newPeso);
                                        }}
                                        keyboardType="decimal-pad"
                                        placeholder="kg"
                                        placeholderTextColor="#888"
                                    />
                                </View>
                            )}
                            {item.modelo.caracteristicas?.isPesoBilateral &&
                                !item.modelo.caracteristicas?.usaBarra &&
                                series.length > 0 && (
                                    <View style={styles.bilateralInfoCard}>
                                        <View style={styles.dumbbellIconContainer}>
                                            <View style={styles.dumbbellWithWeight}>
                                                <FontAwesome5 name="dumbbell" size={24} color="#ccc" style={{ transform: [{ rotate: '-45deg' }] }} />
                                                <Text style={styles.dumbbellWeightText}>{series[0].peso || 0} kg</Text>
                                            </View>
                                            <View style={styles.dumbbellWithWeight}>
                                                <FontAwesome5 name="dumbbell" size={24} color="#ccc" style={{ transform: [{ rotate: '-45deg' }] }} />
                                                <Text style={styles.dumbbellWeightText}>{series[0].peso || 0} kg</Text>
                                            </View>
                                        </View>
                                    </View>
                                )}
                            {item.modelo.caracteristicas?.usaBarra && series.length > 0 && (
                                <View style={styles.bilateralInfoCard}>
                                    <View style={styles.barbellIconContainer}>
                                        <Image
                                            source={require('@/assets/images/Exercicios/ilustracaoBarra.png')} // Changed to alias
                                            style={styles.barbellImage}
                                            resizeMode="contain"
                                        />
                                    </View>
                                    <View style={styles.barbellWeightDistribution}>
                                        <Text style={styles.dumbbellWeightText}>{series[0].peso || 0} kg</Text>
                                        <Text style={styles.barbellCenterWeightText}>{item.pesoBarra || 0} kg</Text>
                                        <Text style={styles.dumbbellWeightText}>{series[0].peso || 0} kg</Text>
                                    </View>
                                </View>
                            )}
                            {/* Detalhes do Cálculo de Volume */}
                            {isAdvancedOptionsVisible && (<View style={styles.volumeDetailsContainer}>
                                <Text style={styles.volumeDetailsTitle}>Cálculo de Volume</Text>
                                {series.filter(s => s.concluido).length > 0 ? (
                                    series.map((serie, index) => {
                                        if (!serie.concluido) return null;

                                        const { calculationString } = calculateLoadForSerie(serie, item, userWeight);
                                        const normalSeriesCount = series.slice(0, index + 1).filter(s => s.type === 'normal').length;

                                        return (
                                            <View
                                                key={serie.id}
                                                style={[
                                                    styles.volumeDetailRow,
                                                    serie.type === 'dropset' && styles.volumeDetailRowDropset,
                                                ]}
                                            >
                                                <Text style={styles.volumeDetailLabel}>
                                                    {serie.type === 'dropset' ? 'Dropset:' : `Série ${normalSeriesCount}:`}
                                                </Text>
                                                <Text style={styles.volumeDetailCalculation}>{calculationString}</Text>
                                            </View>
                                        );
                                    })
                                ) : (
                                    <Text style={styles.volumeDetailEmptyText}>
                                        Complete uma série para ver o cálculo do volume.
                                    </Text>
                                )}
                            </View>)}
                        </View>
                    )}
                </>


                <RestTimeDrawer
                    visible={isRestTimePickerVisible}
                    onClose={() => setIsRestTimePickerVisible(false)}
                    onSave={(newRestTime) => {
                        onRestTimeChange(newRestTime);
                        setIsRestTimePickerVisible(false);
                    }}
                    initialValue={item.restTime || 60}
                />
                <RepetitionsDrawer
                    visible={isRepDrawerVisible}
                    onClose={() => {
                        setIsRepDrawerVisible(false);
                        setEditingSetIndex(null);
                    }}
                    onSave={handleRepetitionsSave}
                    initialValue={getRepetitionsValue()}
                />
                <TimeBasedSetDrawer
                    visible={isExerciseTimeDrawerVisible}
                    onClose={() => setIsExerciseTimeDrawerVisible(false)}
                    onSave={(newDuration: number) => {
                        if (editingSetIndex !== null) {
                            let newSets = [...series];
                            const oldValue = newSets[editingSetIndex].repeticoes;
                            newSets[editingSetIndex].repeticoes = String(newDuration);

                            // Cascade for time-based sets logic (if we treat time as 'reps' here)
                            newSets = cascadeUpdate(newSets, editingSetIndex, 'repeticoes', oldValue);

                            handleSeriesUpdate(newSets);
                        }
                    }}
                    initialValue={editingSetIndex !== null ? parseInt(String(series[editingSetIndex]?.repeticoes), 10) || 60 : 60}
                />
            </View>
            <ExerciseDetailModal
                visible={isDetailModalVisible}
                onClose={() => setDetailModalVisible(false)}
                exercise={item}
                allUserLogs={allUserLogs}
            />
        </>
    );
};

const styles = StyleSheet.create({
    exercicioCard: {
        backgroundColor: '#1A1D23',
        padding: 15,
        flex: 1,
        marginBottom: 15,
    },
    exercicioHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    exerciseVideo: {
        width: 60,
        height: 60,
        borderRadius: 8,
        marginRight: 15,
    },
    exerciseInfo: {
        flex: 1,
    },
    exercicioName: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
    muscleGroup: {
        color: '#aaa',
        fontSize: 14,
        marginTop: 4,
    },
    setRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 8,
        paddingHorizontal: 5,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    setRowCompleted: {
        opacity: 0.75,
    },
    seriesNumberContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        width: 30,
        height: 30,
        borderRadius: 5,
        marginRight: 10,
    },
    seriesNumberText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
    completedBar: {
        width: 5,
        backgroundColor: '#3B82F6',
        height: '100%',
        marginRight: 5,
        borderRadius: 2,
    },
    inputGroup: {
        alignItems: 'center',
    },
    inputLabel: {
        color: '#aaa', fontSize: 10, marginBottom: 4
    },
    setInput: {
        backgroundColor: '#262A32',
        color: '#fff',
        padding: 10,
        borderRadius: 5,
        textAlign: 'center',
        fontSize: 16,
        minWidth: 80,
    },
    repButton: {
        backgroundColor: '#262A32',
        padding: 10,
        borderRadius: 5,
        textAlign: 'center',
        fontSize: 16,
        minWidth: 80,
        height: 42,
        justifyContent: 'center',
    },
    repButtonText: {
        color: '#fff', textAlign: 'center', fontSize: 16
    },
    timeBasedButton: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    xText: { color: '#888', fontSize: 14, marginHorizontal: 10 },
    addSetButton: {
        padding: 15,
        marginTop: 10,
        backgroundColor: 'transparent',
        borderRadius: 8,
        alignItems: 'center',
    },
    addSetButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
    checkboxContainer: {
        paddingHorizontal: 15,
        justifyContent: 'center',
        alignItems: 'center',
    },
    bodyWeightContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        height: 42,
    },
    bodyWeightText: {
        color: '#ccc',
        fontSize: 16,
        fontWeight: '500',
    },
    advancedOptionsContainer: {
        marginTop: 10,
        paddingHorizontal: 10,
    },
    barbellWeightCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#1f1f1f',
        borderRadius: 12,
        padding: 15,
        marginBottom: 15,
        borderWidth: 1,
        borderColor: '#ffffff1a',
    },
    barbellWeightLabel: {
        color: '#ccc',
        fontSize: 16,
        fontWeight: '500',
    },
    barbellWeightInput: {
        backgroundColor: '#2A2E37',
        color: '#fff',
        paddingVertical: 8,
        paddingHorizontal: 15,
        borderRadius: 8,
        fontSize: 16,
        textAlign: 'center',
        minWidth: 60,
    },
    bilateralInfoCard: {
        backgroundColor: '#1f1f1f',
        borderRadius: 12,
        padding: 15,
        alignItems: 'center',
        marginBottom: 15,
        borderWidth: 1,
        borderColor: '#ffffff1a',
    },
    dumbbellIconContainer: {
        flexDirection: 'row',
        gap: 40,
        marginBottom: 5,
    },
    dumbbellWithWeight: {
        alignItems: 'center',
        gap: 8,
    },
    dumbbellWeightText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: 'bold',
    },
    barbellIconContainer: {
        width: '100%',
        alignItems: 'center',
        marginBottom: 10,
    },
    barbellImage: {
        width: '100%',
        height: 80,
    },
    barbellWeightDistribution: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        paddingHorizontal: 10,
    },
    barbellCenterWeightText: {
        color: '#3B82F6',
        fontSize: 14,
        fontWeight: 'bold',
    },
    volumeDetailsContainer: {
        backgroundColor: '#1f1f1f',
        borderRadius: 12,
        padding: 15,
        marginTop: 15,
        borderWidth: 1,
        borderColor: '#ffffff1a',
    },
    volumeDetailsTitle: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    volumeDetailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 4,
    },
    volumeDetailRowDropset: {
        marginLeft: 15,
        borderLeftWidth: 2,
        borderLeftColor: '#444',
        paddingLeft: 10,
    },
    volumeDetailLabel: {
        color: '#ccc',
        fontSize: 14,
    },
    volumeDetailCalculation: {
        color: '#fff',
        fontSize: 14,
    },
    volumeDetailEmptyText: {
        color: '#888',
        fontSize: 14,
        textAlign: 'center',
        paddingVertical: 10,
    },
});
