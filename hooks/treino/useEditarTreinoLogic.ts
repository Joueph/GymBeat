import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { useSharedValue, withTiming } from 'react-native-reanimated';

import { useAuth } from '@/app/authprovider';
import { usePremiumStatus } from '@/hooks/usePremiumStatus';
import { useWorkoutOperations } from '@/hooks/useWorkoutOperations';

import { getLogsByUsuarioId } from '@/services/logService';
import { getLastLogForMachine } from '@/services/machineService';
import {
    getCachedActiveWorkoutLog,
    getCachedTreinoById,
} from '@/services/offlineCacheService';
import {
    deleteTreino,
    getTreinoById,
    getTreinosByUsuarioId,
} from '@/services/treinoService';
import { getUserProfile } from '@/userService';

import { Exercicio, ExercicioModelo } from '@/models/exercicio';
import { Log } from '@/models/log';
import { Treino } from '@/models/treino';
import { cascadeUpdate, SerieEdit } from '@/utils/treinoUtils';

export const useEditarTreinoLogic = () => {
    const { user } = useAuth();
    const router = useRouter();
    const params = useLocalSearchParams();
    const { treinoId, fichaId, fromConfig } = params as { treinoId?: string; fichaId: string, fromConfig?: string };

    const [treino, setTreino] = useState<Treino | null>(null);
    const [loading, setLoading] = useState(true);
    const { saveTreino, isSaving } = useWorkoutOperations();

    // Modal States
    const [isModalVisible, setModalVisible] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [isRepDrawerVisible, setIsRepDrawerVisible] = useState(false);
    const [isExerciseTimeDrawerVisible, setIsExerciseTimeDrawerVisible] = useState(false);
    const [isDefaultRestTimeDrawerVisible, setDefaultRestTimeDrawerVisible] = useState(false);
    const [isRestTimeModalVisible, setIsRestTimeModalVisible] = useState(false);
    const [editingIndices, setEditingIndices] = useState<{ exerciseIndex: number; setIndex: number } | null>(null);
    const [isSettingsModalVisible, setSettingsModalVisible] = useState(false);
    const [workoutScreenType, setWorkoutScreenType] = useState<'simplified' | 'complete'>('complete');

    const [activeLog, setActiveLog] = useState<Log | null>(null);
    const [allUserLogs, setAllUserLogs] = useState<Log[]>([]);
    const [carouselIndex, setCarouselIndex] = useState(0);
    const [isReorderModalVisible, setReorderModalVisible] = useState(false);
    const [isNotesModalVisible, setIsNotesModalVisible] = useState(false);
    const [exerciseForNotes, setExerciseForNotes] = useState<{ index: number, exercise: Exercicio } | null>(null);

    // Detail Modal
    const [isDetailModalVisible, setDetailModalVisible] = useState(false);
    const [detailExerciseIndex, setDetailExerciseIndex] = useState<number | null>(null);

    // Review Modal
    const [selectedLog, setSelectedLog] = useState<Log | null>(null);
    const [isReviewModalVisible, setIsReviewModalVisible] = useState(false);

    const { isPremium, navigateToPaywall } = usePremiumStatus();

    // Machine Drawer Logic
    const [isMachineDrawerVisible, setIsMachineDrawerVisible] = useState(false);
    const [exerciseForMachine, setExerciseForMachine] = useState<{ index: number, exercise: Exercicio } | null>(null);

    // Substitute Logic
    const [isSubstituteModalVisible, setSubstituteModalVisible] = useState(false);
    const [exerciseForSubstitution, setExerciseForSubstitution] = useState<{ index: number, exercise: Exercicio } | null>(null);

    const editingProgress = useSharedValue(0);

    useEffect(() => {
        editingProgress.value = withTiming(isEditing ? 1 : 0, { duration: 300 });
    }, [isEditing]);

    useEffect(() => {
        if (!treinoId) {
            setIsEditing(true);
        }
    }, [treinoId]);

    useEffect(() => {
        const checkActiveWorkout = async () => {
            const log = await getCachedActiveWorkoutLog();
            setActiveLog(log);
        };
        checkActiveWorkout();
    }, []);

    useEffect(() => {
        if (user?.id) {
            getLogsByUsuarioId(user.id).then(fetchedLogs => {
                if (!isPremium) {
                    setAllUserLogs(fetchedLogs.slice(0, 5));
                } else {
                    setAllUserLogs(fetchedLogs);
                }
            });
            getUserProfile(user.id).then(profile => {
                if (profile?.workoutScreenType) {
                    setWorkoutScreenType(profile.workoutScreenType);
                }
            });
        }
    }, [user, isPremium]);

    useEffect(() => {
        const loadTreino = async () => {
            let cachedLoaded = false;
            if (treinoId) {
                try {
                    const cachedTreino = await getCachedTreinoById(treinoId as string);
                    if (cachedTreino) {
                        setTreino(cachedTreino);
                        setLoading(false);
                        cachedLoaded = true;
                    }
                } catch (e) {
                    // ignore
                }
            }

            if (treinoId) {
                try {
                    const fetchedTreino = await getTreinoById(treinoId as string);
                    if (fetchedTreino && fetchedTreino.exercicios) {
                        fetchedTreino.exercicios.forEach((ex, index) => {
                            if (!ex.modelo) {
                                console.error(`[editarTreino] ERRO: Exercício no índice ${index} (ID: ${ex.modeloId}) veio sem 'modelo'.`);
                            }
                        });
                    }
                    if (fetchedTreino) {
                        setTreino({ ...fetchedTreino, id: treinoId as string });
                    }
                } catch (error) {
                    // ignore
                }
            } else {
                setTreino({
                    id: '',
                    nome: 'Novo Treino',
                    usuarioId: user?.id || '',
                    fichaId: (typeof fichaId === 'string' && fichaId === 'unassigned') ? undefined : (fichaId || undefined),
                    exercicios: [],
                    diasSemana: [],
                    intervalo: { min: 1, seg: 30 },
                    ordem: 0,
                    descricao: '',
                });
            }
            setLoading(false);
        };
        loadTreino();
    }, [treinoId, fichaId, user]);

    const handleUpdateExercise = (updatedExercise: Exercicio, index: number) => {
        if (!treino) return;
        const newExercicios = [...treino.exercicios];
        if (!isEditing) setIsEditing(true);
        newExercicios[index] = updatedExercise;
        setTreino({ ...treino, exercicios: newExercicios });
    };

    const handleRemoveExercise = (index: number) => {
        if (!treino) return;
        const exerciseName = treino.exercicios[index]?.modelo?.nome || 'este exercício';
        Alert.alert(
            "Apagar Exercício",
            `Tem certeza que deseja apagar "${exerciseName}" do seu treino?`,
            [
                { text: "Cancelar", style: "cancel" },
                {
                    text: "Apagar",
                    style: "destructive",
                    onPress: () => {
                        if (!isEditing) setIsEditing(true);
                        const newExercicios = [...treino.exercicios];
                        newExercicios.splice(index, 1);
                        setTreino({ ...treino, exercicios: newExercicios });
                    }
                }
            ]
        );
    };

    const handleOpenSubstitute = (index: number) => {
        if (!treino) return;
        setExerciseForSubstitution({ index, exercise: treino.exercicios[index] });
        setSubstituteModalVisible(true);
    };

    const handleConfirmSubstitute = (newModel: ExercicioModelo) => {
        if (!exerciseForSubstitution || !treino) return;
        const { index } = exerciseForSubstitution;

        const updatedExercise: Exercicio = {
            ...treino.exercicios[index],
            modeloId: newModel.id,
            modelo: newModel,
        };

        delete updatedExercise.machineId;
        delete updatedExercise.machineName;

        handleUpdateExercise(updatedExercise, index);
        setSubstituteModalVisible(false);
        setExerciseForSubstitution(null);
    };

    const handleMachineSelect = async (machineId: string | undefined, machineName: string | undefined, shouldClose: boolean = true) => {
        if (!exerciseForMachine || !treino) return;

        const { index, exercise } = exerciseForMachine;
        const newExercises = [...treino.exercicios];

        const updatedExercise = {
            ...exercise,
            machineId: machineId,
            machineName: machineName,
        };

        if (machineId && user) {
            try {
                const lastLog = await getLastLogForMachine(exercise.modeloId, machineId, user.id);
                if (lastLog && lastLog.exercicios) {
                    const prevEx = lastLog.exercicios.find(e => e.modeloId === exercise.modeloId && e.machineId === machineId);
                    if (prevEx && prevEx.series && prevEx.series.length > 0) {
                        updatedExercise.series = updatedExercise.series.map((s, i) => {
                            const prevSet = prevEx.series[i];
                            if (prevSet) {
                                return {
                                    ...s,
                                    repeticoes: prevSet.repeticoes,
                                    peso: prevSet.peso,
                                };
                            }
                            return s;
                        });
                    }
                }
            } catch (e) {
                console.log("Error fetching machine history:", e);
            }
        }

        newExercises[index] = updatedExercise;
        setTreino({ ...treino, exercicios: newExercises });
        if (!isEditing) setIsEditing(true);

        if (shouldClose) {
            setIsMachineDrawerVisible(false);
            setExerciseForMachine(null);
        }
    };

    const handleStartWorkout = () => {
        if (!treino || !treino.id) return;
        router.push({
            pathname: '/(treino)/LoggingDuringWorkout',
            params: { treinoId: treino.id, fichaId: treino.fichaId }
        });
    };

    const handleSave = async () => {
        if (!treino) return;
        const isNew = !treino.id || treino.id === '';

        if (!isPremium && isNew && user?.id) {
            try {
                const treinos = await getTreinosByUsuarioId(user.id);
                if (treinos.length >= 5) {
                    navigateToPaywall();
                    return;
                }
            } catch (e) {
                console.error("Error checking limits:", e);
            }
        }

        const savedId = await saveTreino(treino, isNew);
        if (savedId) {
            if (isNew) {
                setTreino(prev => prev ? { ...prev, id: savedId } : null);
            }
            setIsEditing(false);
        }
    };

    const handleDeleteTreino = async () => {
        if (!treino || !treino.id) {
            Alert.alert("Erro", "Este treino ainda não foi salvo e não pode ser deletado.");
            router.back();
            return;
        }

        Alert.alert(
            "Apagar Treino",
            `Tem certeza que deseja apagar permanentemente o treino "${treino.nome}"? Esta ação não pode ser desfeita.`,
            [
                { text: "Cancelar", style: "cancel" },
                {
                    text: "Apagar", style: "destructive", onPress: async () => {
                        try {
                            await deleteTreino(treino.id, treino.fichaId ?? undefined);
                            Alert.alert("Sucesso", "O treino foi apagado.");
                            router.back();
                        } catch (error) { console.error("Erro ao apagar treino:", error); Alert.alert('Erro', 'Não foi possível apagar o treino.'); }
                    }
                }
            ]
        );
    };

    const handleAddExercises = (exerciciosSelecionados: ExercicioModelo[]) => {
        if (!treino) return;

        const novosExercicios: Exercicio[] = exerciciosSelecionados.map(modelo => ({
            modeloId: modelo.id,
            modelo: modelo,
            series: [{ id: `set-${Date.now()}`, repeticoes: '10', peso: 10, type: 'normal', concluido: false }],
            isBiSet: false,
            notes: '',
            restTime: 90,
        }));

        if (!isEditing) setIsEditing(true);
        setTreino(prev => prev ? { ...prev, exercicios: [...prev.exercicios, ...novosExercicios] } : null);
        setModalVisible(false);
    };

    // Timer / Reps Handlers
    const handleRepetitionsSave = (newReps: string) => {
        if (!editingIndices || !treino) return;
        const { exerciseIndex, setIndex } = editingIndices;
        const updatedExercicios = [...treino.exercicios];
        const seriesToUpdate = [...updatedExercicios[exerciseIndex].series] as SerieEdit[];
        const oldValue = seriesToUpdate[setIndex].repeticoes;
        seriesToUpdate[setIndex] = { ...seriesToUpdate[setIndex], repeticoes: newReps };
        const cascadedSeries = cascadeUpdate(seriesToUpdate, setIndex, 'repeticoes', oldValue);
        updatedExercicios[exerciseIndex] = { ...updatedExercicios[exerciseIndex], series: cascadedSeries };
        if (!isEditing) setIsEditing(true);
        setTreino({ ...treino, exercicios: updatedExercicios });
        setIsRepDrawerVisible(false);
        setEditingIndices(null);
    };

    const handleTimeBasedSetSave = (newSeconds: number) => {
        if (!editingIndices || !treino) return;
        const { exerciseIndex, setIndex } = editingIndices;
        const updatedExercicios = [...treino.exercicios];
        const seriesToUpdate = [...updatedExercicios[exerciseIndex].series] as SerieEdit[];
        const oldValue = seriesToUpdate[setIndex].repeticoes;
        seriesToUpdate[setIndex] = { ...seriesToUpdate[setIndex], repeticoes: String(newSeconds) };
        const cascadedSeries = cascadeUpdate(seriesToUpdate, setIndex, 'repeticoes', oldValue);
        updatedExercicios[exerciseIndex] = { ...updatedExercicios[exerciseIndex], series: cascadedSeries };
        if (!isEditing) setIsEditing(true);
        setTreino({ ...treino, exercicios: updatedExercicios });
        setIsExerciseTimeDrawerVisible(false);
        setEditingIndices(null);
    };

    const handleRestTimeSave = (newRestTime: number) => {
        if (!editingIndices || !treino) return;
        const { exerciseIndex } = editingIndices;
        const updatedExercise = { ...treino.exercicios[exerciseIndex], restTime: newRestTime };
        handleUpdateExercise(updatedExercise, exerciseIndex);
        setIsRestTimeModalVisible(false);
    };

    const handleDefaultRestTimeSave = (newSeconds: number) => {
        if (!treino) return;
        const oldDefaultSeconds = (treino.intervalo?.min ?? 1) * 60 + (treino.intervalo?.seg ?? 30);
        const updatedExercicios = treino.exercicios.map(ex => {
            if (ex.restTime === oldDefaultSeconds) {
                return { ...ex, restTime: newSeconds };
            }
            return ex;
        });
        const newMin = Math.floor(newSeconds / 60);
        const newSeg = newSeconds % 60;
        setTreino({ ...treino, exercicios: updatedExercicios, intervalo: { min: newMin, seg: newSeg } });
        setDefaultRestTimeDrawerVisible(false);
    };

    const getRepetitionsValue = () => {
        if (!editingIndices || !treino) return '10';
        const { exerciseIndex, setIndex } = editingIndices;
        const exercise = treino.exercicios[exerciseIndex];
        return exercise?.series[setIndex]?.repeticoes || '10';
    };

    const getRestTimeValue = () => {
        if (!editingIndices || !treino) return 90;
        const { exerciseIndex } = editingIndices;
        const exercise = treino.exercicios[exerciseIndex];
        return exercise?.restTime || 90;
    };

    const hasRelevantLogs = useMemo(() => {
        if (!treinoId || !allUserLogs || allUserLogs.length === 0) {
            return false;
        }
        return allUserLogs.some(log => log.treino?.id === treinoId);
    }, [allUserLogs, treinoId]);

    return {
        state: {
            treino,
            loading,
            isSaving,
            isModalVisible,
            isEditing,
            isRepDrawerVisible,
            isExerciseTimeDrawerVisible,
            isDefaultRestTimeDrawerVisible,
            isRestTimeModalVisible,
            editingIndices,
            isSettingsModalVisible,
            workoutScreenType,
            activeLog,
            allUserLogs,
            carouselIndex,
            isReorderModalVisible,
            isNotesModalVisible,
            exerciseForNotes,
            isDetailModalVisible,
            detailExerciseIndex,
            selectedLog,
            isReviewModalVisible,
            isPremium,
            isMachineDrawerVisible,
            exerciseForMachine,
            isSubstituteModalVisible,
            exerciseForSubstitution,
            editingProgress,
            treinoId,
            user,
            hasRelevantLogs,
            fromConfig
        },
        actions: {
            setTreino,
            setModalVisible,
            setIsEditing,
            setIsRepDrawerVisible,
            setIsExerciseTimeDrawerVisible,
            setDefaultRestTimeDrawerVisible,
            setIsRestTimeModalVisible,
            setEditingIndices,
            setSettingsModalVisible,
            setCarouselIndex,
            setReorderModalVisible,
            setIsNotesModalVisible,
            setExerciseForNotes,
            setDetailModalVisible,
            setDetailExerciseIndex,
            setSelectedLog,
            setIsReviewModalVisible,
            navigateToPaywall,
            setIsMachineDrawerVisible,
            setExerciseForMachine,
            setSubstituteModalVisible,
            setExerciseForSubstitution,
            handleUpdateExercise,
            handleRemoveExercise,
            handleOpenSubstitute,
            handleConfirmSubstitute,
            handleMachineSelect,
            handleStartWorkout,
            handleSave,
            handleDeleteTreino,
            handleAddExercises,
            handleRepetitionsSave,
            handleTimeBasedSetSave,
            handleRestTimeSave,
            handleDefaultRestTimeSave,
            getRepetitionsValue,
            getRestTimeValue
        }
    };
};
