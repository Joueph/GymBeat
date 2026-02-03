import { FontAwesome, FontAwesome5 } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { LayoutAnimation, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { ScaleDecorator } from 'react-native-draggable-flatlist';

import { ExerciseMenuAction, ExerciseOptionsMenu } from '@/components/menus/ExerciseOptionsMenu';
import { SetOptionsMenu } from '@/components/SetOptionsMenu';
import { VideoListItem } from '@/components/VideoListItem';
import { Exercicio } from '@/models/exercicio';
import { SerieEdit, cascadeUpdate, formatRestTime } from '@/utils/treinoUtils';

interface ExerciseItemProps {
    item: Exercicio;
    drag: () => void;
    isActive: boolean;
    onUpdateExercise: (ex: Exercicio) => void;
    onRemoveExercise: () => void;
    exerciseIndex: number;
    onOpenRepDrawer: (exerciseIndex: number, setIndex: number) => void;
    onOpenTimeDrawer: (exerciseIndex: number, setIndex: number) => void;
    onOpenRestTimeModal: (exerciseIndex: number) => void;
    setIsEditing: (isEditing: boolean) => void;
    onOpenMachineDrawer: (exerciseIndex: number) => void;
    onReorder: () => void;
    onOpenNotes: () => void;
    onSubstitute: () => void;
    onShowDetail: () => void;
    isPremium: boolean;
    navigateToPaywall: () => void;
}

export const ExerciseItem = ({
    item,
    drag,
    isActive,
    onUpdateExercise,
    onRemoveExercise,
    exerciseIndex,
    onOpenRepDrawer,
    onOpenTimeDrawer,
    onOpenRestTimeModal,
    setIsEditing,
    onOpenMachineDrawer,
    onReorder,
    onOpenNotes,
    onSubstitute,
    onShowDetail,
    isPremium,
    navigateToPaywall,
}: ExerciseItemProps) => {
    const [series, setSeries] = useState<SerieEdit[]>(
        item.series.map((s, i) => ({ ...s, id: s.id || `set-${Date.now()}-${i}`, type: s.type || 'normal' }))
    );

    // Track the weight value on focus to enable cascade logic
    const focusedWeightRef = React.useRef<number | null>(null);

    useEffect(() => {
        setSeries(item.series.map((s, i) => ({ ...s, id: s.id || `set-${Date.now()}-${i}`, type: s.type || 'normal' })));
    }, [item.series, item]);

    const handleSeriesUpdate = (newSeries: SerieEdit[]) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setSeries(newSeries);
        onUpdateExercise({ ...item, series: newSeries });
        setIsEditing(true);
    };

    const handleSetOption = (option: 'toggleWarmup' | 'addDropset' | 'copy' | 'delete' | 'toggleTime', index: number) => {
        setTimeout(() => {
            const newSets = [...series];
            if (option === 'delete') {
                newSets.splice(index, 1);
            } else if (option === 'copy') {
                newSets.splice(index + 1, 0, { ...newSets[index], id: `set-${Date.now()}` });
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
            } else if (option === 'toggleTime') {
                const currentSet = newSets[index];
                currentSet.isTimeBased = !currentSet.isTimeBased;
                if (currentSet.isTimeBased) {
                    currentSet.peso = 0;
                    currentSet.repeticoes = '60';
                } else {
                    currentSet.repeticoes = '10';
                }
            }
            handleSeriesUpdate(newSets);
        }, 100);
    };

    const renderSetItem = (setItem: SerieEdit, index: number) => {
        const normalSeriesCount = series
            .slice(0, index + 1)
            .filter(s => s.type === 'normal' && !s.isWarmup).length;

        return (
            <View key={setItem.id} style={[styles.setRow, setItem.type === 'dropset' && styles.dropsetRow]}>
                {setItem.type === 'dropset' ? (
                    <FontAwesome5 name="arrow-down" size={16} color="#888" style={styles.setIndicator} />
                ) : setItem.isWarmup ? (
                    <FontAwesome5 name="fire" size={16} color="#FFA500" style={styles.setIndicator} />
                ) : (
                    <Text style={styles.setIndicator}>{normalSeriesCount}</Text>
                )}
                <View style={styles.inputGroup}>
                    <TouchableOpacity
                        style={[
                            styles.repButton,
                            setItem.isTimeBased && { flexDirection: 'row', gap: 6 },
                            (index > 0 && series[index - 1].repeticoes === setItem.repeticoes) && { opacity: 0.7 }
                        ]}
                        onPress={() => {
                            if (setItem.isTimeBased) {
                                onOpenTimeDrawer(exerciseIndex, index);
                            } else {
                                onOpenRepDrawer(exerciseIndex, index);
                            }
                        }}
                    >
                        {setItem.isTimeBased && <FontAwesome name="clock-o" size={16} color="#fff" />}
                        <Text style={styles.repButtonText}>
                            {setItem.isTimeBased
                                ? formatRestTime(parseInt(String(setItem.repeticoes), 10) || 0)
                                : String(setItem.repeticoes)}
                        </Text>
                    </TouchableOpacity>
                </View>
                <Text style={styles.xText}>x</Text>
                {item.modelo?.caracteristicas?.isPesoCorporal ? (
                    <View style={styles.inputGroup}>
                        <View style={[styles.setInput, styles.bodyWeightContainer]}>
                            <Text style={styles.bodyWeightText}>Corporal</Text>
                        </View>
                    </View>
                ) : (
                    <View style={styles.inputGroup}>
                        <TextInput
                            style={[styles.setInput, (index > 0 && series[index - 1].peso == setItem.peso) && { opacity: 0.7 }]}
                            value={String(setItem.peso || '')}
                            onFocus={() => {
                                focusedWeightRef.current = typeof setItem.peso === 'number' ? setItem.peso : parseFloat(String(setItem.peso));
                            }}
                            onChangeText={(text) => {
                                const newSets = [...series];
                                newSets[index] = { ...newSets[index], peso: text as any };
                                // We rely on state update for typing, but cascade happens on EndEditing
                                // We do call handleSeriesUpdate here to keep 'item' logic compliant, 
                                // BUT we must not cascade yet.
                                setSeries(newSets);
                                onUpdateExercise({ ...item, series: newSets });
                                setIsEditing(true);
                            }}
                            onEndEditing={(e) => {
                                let newSets = [...series];
                                const val = parseFloat(e.nativeEvent.text.replace(',', '.')) || 0;
                                newSets[index] = { ...newSets[index], peso: val };

                                // Apply cascade
                                if (focusedWeightRef.current !== null) {
                                    newSets = cascadeUpdate(newSets, index, 'peso', focusedWeightRef.current);
                                }

                                handleSeriesUpdate(newSets);
                            }}
                            keyboardType="decimal-pad"
                        />
                    </View>
                )}
                <SetOptionsMenu
                    isTimeBased={!!setItem.isTimeBased}
                    isNormalSet={setItem.type === 'normal'}
                    isWarmup={!!setItem.isWarmup}
                    isFirstSet={index === 0}
                    onSelect={action => handleSetOption(action, index)}
                />
            </View>
        );
    };

    const renderSeriesHeader = () => (
        <View style={styles.seriesHeader}>
            <View style={styles.setIndicator} />
            <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Reps</Text>
            </View>
            <View style={styles.xText} />
            <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                    {item.modelo?.caracteristicas?.isPesoCorporal ? 'Peso' : 'Peso (kg)'}
                </Text>
            </View>
            <View style={{ width: 40 }} />
        </View>
    );

    return (
        <ScaleDecorator>
            <View style={[styles.exercicioCard, isActive && styles.activeCard]}>
                <View style={styles.exercicioHeader}>
                    {item.modelo?.imagemUrl ? (
                        <VideoListItem uri={item.modelo.imagemUrl} style={styles.exerciseVideo} />
                    ) : (
                        <View style={[styles.exerciseVideo, { backgroundColor: '#333' }]} />
                    )}
                    <View style={styles.exerciseInfo}>
                        <Text style={styles.exercicioName}>{item.modelo?.nome}</Text>
                        <Text style={styles.muscleGroup}>{item.modelo?.grupoMuscular}</Text>
                    </View>
                    <ExerciseOptionsMenu
                        onSelect={(action: ExerciseMenuAction) => {
                            if (action === 'delete') {
                                onRemoveExercise();
                            } else if (action === 'changeMachine') {
                                if (!isPremium) {
                                    navigateToPaywall();
                                    return;
                                }
                                onOpenMachineDrawer(exerciseIndex);
                            } else if (action === 'editRestTime') {
                                onOpenRestTimeModal(exerciseIndex);
                            } else if (action === 'addNote') {
                                onOpenNotes();
                            } else if (action === 'reorder') {
                                onReorder();
                            } else if (action === 'replace') {
                                onSubstitute();
                            }
                        }}
                    />
                </View>
                {item && (
                    <View style={styles.notesContainer}>
                        <FontAwesome name="pencil" size={12} color="#fff" />
                        <TextInput
                            style={styles.notesInput}
                            placeholder="Anotações do exercício..."
                            placeholderTextColor="#888"
                            value={item.notes || ''}
                            onChangeText={(text) => onUpdateExercise({ ...item, notes: text })}
                            multiline
                        />
                    </View>
                )}
                <View style={styles.seriesContainer}>
                    {/* Machine Chooser Marker */}

                    {series.length > 0 && renderSeriesHeader()}
                    {series.map(renderSetItem)}
                </View>
                <TouchableOpacity
                    style={styles.addSetButton}
                    onPress={() => {
                        const lastSet = series[series.length - 1];
                        handleSeriesUpdate([
                            ...series,
                            {
                                id: `set-${Date.now()}`,
                                repeticoes: lastSet?.repeticoes || '10',
                                peso: lastSet?.peso || 10,
                                type: 'normal',
                                isWarmup: false,
                                concluido: false,
                            },
                        ]);
                    }}
                >
                    <FontAwesome name="plus" size={14} color="#3B82F6" />
                    <Text style={styles.addSetButtonText}>Adicionar Série</Text>
                </TouchableOpacity>

            </View>
        </ScaleDecorator>
    );
};

const styles = StyleSheet.create({
    exercicioCard: {
        backgroundColor: '#1A1D23',
        borderRadius: 12,
        marginBottom: 15,
        padding: 15,
        borderWidth: 1,
        borderColor: '#222',
    },
    activeCard: {
        borderColor: '#1cb0f6',
        shadowColor: '#1cb0f6',
        shadowOpacity: 0.5,
        shadowRadius: 5,
        elevation: 10,
    },
    exercicioHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 15,
    },
    exerciseVideo: {
        width: 60,
        height: 60,
        borderRadius: 8,
        marginRight: 15,
        backgroundColor: '#333',
    },
    exerciseInfo: {
        flex: 1,
    },
    exercicioName: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    muscleGroup: {
        color: '#aaa',
        fontSize: 14,
        marginTop: 4,
    },
    notesContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 8,
        marginBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    notesInput: {
        flex: 1,
        color: '#fff',
        fontSize: 16,
        paddingVertical: 5,
        paddingHorizontal: 10,
        backgroundColor: 'transparent',
    },
    seriesContainer: {
        marginTop: 10,
    },
    seriesHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 5,
        paddingHorizontal: 5,
    },
    setIndicator: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
        width: 40,
        textAlign: 'center',
    },
    inputGroup: {
        alignItems: 'center',
        flex: 1,
    },
    inputLabel: {
        color: '#aaa',
        fontSize: 10,
        marginBottom: 4,
    },
    xText: {
        color: '#888',
        fontSize: 14,
        alignSelf: 'flex-end',
        paddingBottom: 10,
    },
    addSetButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 15,
        marginTop: 15,
        backgroundColor: 'transparent',
        borderRadius: 8,
        alignSelf: 'center',
        width: '100%',
        justifyContent: 'center',
    },
    addSetButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 14,
    },
    setRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
        paddingVertical: 8,
        paddingHorizontal: 5,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    dropsetRow: {
        marginLeft: 20,
        borderLeftWidth: 2,
        borderLeftColor: '#444',
    },
    repButton: {
        backgroundColor: '#262A32',
        padding: 10,
        borderRadius: 5,
        minWidth: 80,
        height: 42,
        justifyContent: 'center',
        alignItems: 'center',
    },
    repButtonText: {
        color: '#fff',
        fontSize: 16,
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
    bodyWeightContainer: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    bodyWeightText: {
        color: '#aaa',
        fontSize: 12,
    },
});
