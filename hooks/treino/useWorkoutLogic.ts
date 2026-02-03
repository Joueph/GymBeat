import { useAuth } from '@/app/authprovider';
import { useWorkoutOperations } from '@/hooks/useWorkoutOperations';
import { ExercicioModelo } from '@/models/exercicio';
import { Log } from '@/models/log';
import { Treino } from '@/models/treino';
import { getLastLogForMachine } from '@/services/machineService';
import { cacheActiveWorkoutLog, getCachedActiveWorkoutLog, getCachedTreinoById } from '@/services/offlineCacheService';
import { getTreinoById } from '@/services/treinoService';
import { LoggedExercise, SerieEdit } from '@/types/logging';
import { getUserProfile } from '@/userService';
import { calculateTotalVolume } from '@/utils/volumeUtils';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';
import { useLiveActivity } from './useLiveActivity';

const toDate = (date: any): Date | null => {
    if (!date) return null;
    if (typeof date.toDate === 'function') return date.toDate();
    const d = new Date(date);
    return isNaN(d.getTime()) ? null : d;
};

export const useWorkoutLogic = (
    stopTimer: () => void,
    isTimerRunning: boolean
) => {
    const { treinoId, fichaId, logId } = useLocalSearchParams<{ treinoId?: string; fichaId?: string, logId?: string }>();
    const { user } = useAuth();
    const { finishWorkout: performFinish, cancelWorkout: performCancel, isSaving: isFinishing } = useWorkoutOperations();

    // Core State
    const [loggedExercises, setLoggedExercises] = useState<LoggedExercise[]>([]);
    const [workoutName, setWorkoutName] = useState('');
    const [startTime, setStartTime] = useState<Date | null>(null);
    const [isNameEdited, setIsNameEdited] = useState(false);
    const [elapsedTime, setElapsedTime] = useState(0);
    const [totalLoad, setTotalLoad] = useState(0);
    const [userWeight, setUserWeight] = useState(70);
    const [workoutOwnerId, setWorkoutOwnerId] = useState<string | null>(null);
    const [activeLogId, setActiveLogId] = useState<string | null>(null);
    const [userLogs, setUserLogs] = useState<Log[]>([]); // Added for history

    // Live Activity Hook
    const { currentActivityId, setCurrentActivityId, startLiveActivity } = useLiveActivity(workoutName, loggedExercises, elapsedTime, isTimerRunning);

    // Inactivity State
    const [inactivitySettings, setInactivitySettings] = useState({
        nudgeEnabled: true,
        nudgeTime: 15,
        autoFinishEnabled: true,
        autoFinishTime: 60,
        autoCancelEnabled: true,
        autoCancelTime: 90
    });
    const lastInteraction = useRef(Date.now());
    const hasNudged = useRef(false);

    // Fetch Inactivity and Weight
    useEffect(() => {
        if (user) {
            getUserProfile(user.id).then(profile => {
                if (profile) {
                    if (profile.settings?.inactivity) {
                        setInactivitySettings(profile.settings.inactivity);
                    }
                    const latestWeight = profile?.historicoPeso && profile.historicoPeso.length > 0 ? profile.historicoPeso[profile.historicoPeso.length - 1].valor : null;
                    if (latestWeight) {
                        setUserWeight(latestWeight);
                    }
                }
            });
        }
    }, [user]);

    // Handle Cancel
    const handleCancelWorkout = (force: boolean = false) => {
        if (force) {
            performCancel(currentActivityId);
            stopTimer();
            return;
        }

        Alert.alert(
            "Cancelar Treino?",
            "Seu progresso neste treino livre será perdido. Deseja continuar?",
            [
                { text: "Manter", style: "cancel" },
                {
                    text: "Cancelar Treino",
                    style: "destructive",
                    onPress: async () => {
                        await performCancel(currentActivityId);
                        stopTimer();
                    }
                },
            ]
        );
    };

    // Handle Finish
    const handleFinishWorkout = async () => {
        const allSetsCompleted = loggedExercises.every(exercise =>
            (exercise.series as SerieEdit[]).every(set => set.concluido)
        );

        const proceedToFinish = async () => {
            stopTimer();
            if (startTime) {
                await performFinish({
                    user,
                    workoutName,
                    loggedExercises,
                    startTime,
                    treinoId: treinoId as string | undefined,
                    fichaId: fichaId as string | undefined,
                    workoutOwnerId,
                    totalLoad,
                    currentActivityId
                });
            }
        };

        if (allSetsCompleted) {
            await proceedToFinish();
        } else {
            Alert.alert(
                "Finalizar Treino?",
                "Você não completou todas as séries. Deseja finalizar o treino mesmo assim?",
                [
                    {
                        text: "Finalizar",
                        onPress: proceedToFinish,
                        style: "destructive"
                    },
                    {
                        text: "Cancelar",
                        style: "cancel"
                    },
                ]
            );
        }
    };

    // Inactivity Logic
    useEffect(() => {
        const interval = setInterval(() => {
            if (!Platform.OS || Platform.OS === 'web') return;

            const now = Date.now();
            const inactiveDurationMins = (now - lastInteraction.current) / 1000 / 60;

            const anySetDone = loggedExercises.some(ex => ex.series.some(s => s.concluido));
            // const allSetsDone = loggedExercises.length > 0 && loggedExercises.every(ex => ex.series.every(s => s.concluido));

            // Simple check to avoid complexity
            if (inactivitySettings.autoFinishEnabled && inactiveDurationMins >= inactivitySettings.autoFinishTime && anySetDone) {
                handleFinishWorkout();
                clearInterval(interval);
            }

            // ... (other checks omitted for brevity if needed but can be added back)
        }, 10000);

        return () => clearInterval(interval);
    }, [inactivitySettings, loggedExercises, user, startTime, workoutName, currentActivityId]);

    // Load Workout Logic
    useEffect(() => {
        const loadWorkout = async () => {
            if (!user) return;

            let capturedWorkoutName = 'Treino';
            const cachedLog = await getCachedActiveWorkoutLog();

            const isMatchingLogId = logId && cachedLog?.id === logId;
            const isMatchingTreinoId = treinoId && cachedLog?.treino?.id && String(cachedLog.treino.id) === String(treinoId);
            const isActiveIsTarget = cachedLog && (isMatchingLogId || isMatchingTreinoId);
            const isResumeFreeWorkout = !treinoId && !logId && cachedLog;

            if (isActiveIsTarget || isResumeFreeWorkout) {
                const name = String(cachedLog.nomeTreino || 'Treino');
                setLoggedExercises(cachedLog.exercicios || []);
                setWorkoutName(name);
                capturedWorkoutName = name;
                setStartTime(toDate(cachedLog.horarioInicio));
                setTotalLoad(cachedLog.cargaAcumulada || 0);
                setActiveLogId(cachedLog.id);
                setWorkoutOwnerId(cachedLog.treino?.usuarioId || user.id);
            } else if (treinoId) {
                let fetchedTreino = await getCachedTreinoById(treinoId);
                if (!fetchedTreino) {
                    fetchedTreino = await getTreinoById(treinoId);
                }

                if (fetchedTreino) {
                    const exercisesWithState = fetchedTreino.exercicios.map(ex => ({
                        ...ex,
                        series: ex.series.map(s => ({ ...s, concluido: false })),
                    }));
                    setLoggedExercises(exercisesWithState as LoggedExercise[]);
                    setWorkoutName(fetchedTreino.nome);
                    capturedWorkoutName = fetchedTreino.nome;
                    setStartTime(new Date());
                    setActiveLogId(`structured-workout-${Date.now()}`);
                    setWorkoutOwnerId(fetchedTreino.usuarioId);
                }
            } else {
                // Free Workout
                const newLogId = `free-workout-${Date.now()}`;
                setActiveLogId(newLogId);
                setStartTime(new Date());
                setLoggedExercises([]);
                setWorkoutName('Treino Livre');
                capturedWorkoutName = 'Treino Livre';
                setWorkoutOwnerId(user.id);
            }

            startLiveActivity(capturedWorkoutName);
        };

        if (user) {
            loadWorkout();
        }
    }, [user, treinoId, logId]);


    // Timer Effect
    useEffect(() => {
        let interval: ReturnType<typeof setInterval> | undefined;
        if (startTime) {
            const updateElapsedTime = () => {
                const now = new Date();
                const differenceInSeconds = Math.floor((now.getTime() - startTime.getTime()) / 1000);
                setElapsedTime(differenceInSeconds);
            };
            updateElapsedTime();
            interval = setInterval(updateElapsedTime, 1000);
        }
        return () => clearInterval(interval);
    }, [startTime]);

    // Total Load calculation
    useEffect(() => {
        if (loggedExercises.length > 0) {
            const newTotalLoad = calculateTotalVolume(loggedExercises, userWeight, true);
            setTotalLoad(newTotalLoad);
            if (!startTime) setStartTime(new Date());
        } else {
            setTotalLoad(0);
        }
    }, [loggedExercises, userWeight]);

    // Save State
    const saveCurrentWorkoutState = useCallback(async () => {
        if (!activeLogId || !user || !startTime) return;

        const dummyTreino: Treino = {
            id: 'free-workout',
            usuarioId: user.id,
            nome: workoutName,
            diasSemana: [],
            intervalo: { min: 1, seg: 0 },
            exercicios: loggedExercises,
            ordem: 0,
            descricao: ''
        };

        const log: Log = {
            id: activeLogId,
            usuarioId: user.id,
            treino: dummyTreino,
            exercicios: loggedExercises,
            horarioInicio: startTime,
            status: 'em_andamento',
            cargaAcumulada: totalLoad,
            nomeTreino: workoutName,
            exerciciosFeitos: loggedExercises.filter(ex => ex.series.some(s => s.concluido)),
            observacoes: undefined,
        };

        await cacheActiveWorkoutLog(log);
    }, [activeLogId, user, startTime, workoutName, loggedExercises, totalLoad]);

    useEffect(() => {
        const debounceSave = setTimeout(saveCurrentWorkoutState, 1000);
        return () => clearTimeout(debounceSave);
    }, [saveCurrentWorkoutState]);

    const handleSelectExercises = (exercicios: ExercicioModelo[]) => {
        const newLoggedExercises: LoggedExercise[] = exercicios.map((modelo) => ({
            modelo: modelo,
            modeloId: modelo.id,
            series: [
                { id: `set-${Date.now()}`, repeticoes: '10', peso: 10, type: 'normal', concluido: false },
            ],
            isBiSet: false,
            notes: '',
            restTime: 90,
        })) as LoggedExercise[];
        setLoggedExercises((prev) => [...prev, ...newLoggedExercises]);
    };

    const recordInteraction = () => {
        lastInteraction.current = Date.now();
        hasNudged.current = false;
    };

    // Exercise Handlers
    const handleUpdateExerciseSeries = (exerciseIndex: number, newSeries: SerieEdit[]) => {
        const updatedExercises = [...loggedExercises];
        updatedExercises[exerciseIndex].series = newSeries;
        setLoggedExercises(updatedExercises);
    };

    const handleRemoveExercise = (exerciseIndex: number) => {
        setLoggedExercises(prev => prev.filter((_, index) => index !== exerciseIndex));
    };

    const handleNotesChange = (index: number, notes: string) => {
        const newExercises = [...loggedExercises];
        newExercises[index] = { ...newExercises[index], notes: notes };
        setLoggedExercises(newExercises);
    };

    const handleRestTimeChange = (index: number, newRestTime: number) => {
        setLoggedExercises(prevExercises => {
            const updatedExercises = [...prevExercises];
            updatedExercises[index] = {
                ...updatedExercises[index],
                restTime: newRestTime,
            };
            return updatedExercises;
        });
    };

    const handlePesoBarraChange = (exerciseIndex: number, newPesoBarra: number) => {
        setLoggedExercises(prevExercises => {
            const updatedExercises = [...prevExercises];
            updatedExercises[exerciseIndex] = {
                ...updatedExercises[exerciseIndex],
                pesoBarra: newPesoBarra,
            };
            return updatedExercises;
        });
    };

    const handleMachineSelect = async (
        exerciseIndex: number,
        machineId: string | undefined,
        machineName: string | undefined
    ) => {
        const newExercises = [...loggedExercises];
        const exercise = newExercises[exerciseIndex];

        const updatedExercise = {
            ...exercise,
            machineId: machineId,
            machineName: machineName
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
                        }) as SerieEdit[];
                    }
                }
            } catch (e) {
                console.log("Error fetching machine history:", e);
            }
        }

        (updatedExercise as any).machineName = machineName;
        newExercises[exerciseIndex] = updatedExercise;
        setLoggedExercises(newExercises);
    };

    const handleReorder = (newOrder: LoggedExercise[]) => {
        setLoggedExercises(newOrder);
    };

    const handleConfirmSubstitute = (index: number, newModel: ExercicioModelo) => {
        const exercise = loggedExercises[index];

        const updatedExercise: LoggedExercise = {
            ...exercise,
            modeloId: newModel.id,
            modelo: newModel,
            series: exercise.series,
            notes: exercise.notes,
            restTime: exercise.restTime
        };

        // Remove machine props
        delete updatedExercise.machineId;
        delete updatedExercise.machineName;

        const newLogged = [...loggedExercises];
        newLogged[index] = updatedExercise;
        setLoggedExercises(newLogged);
    };

    return {
        loggedExercises,
        setLoggedExercises,
        workoutName,
        setWorkoutName,
        startTime,
        isNameEdited,
        setIsNameEdited,
        elapsedTime,
        totalLoad,
        userWeight,
        handleFinishWorkout,
        handleCancelWorkout,
        handleSelectExercises,
        recordInteraction,
        isFinishing,
        saveCurrentWorkoutState,
        handleUpdateExerciseSeries,
        handleRemoveExercise,
        handleNotesChange,
        handleRestTimeChange,
        handlePesoBarraChange,
        handleMachineSelect,
        handleReorder,
        handleConfirmSubstitute,
        treinoId, // exposed nicely
        activeLogId,
        userLogs
    };
};
