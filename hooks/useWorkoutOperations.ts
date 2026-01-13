import { LoggedExercise } from '@/app/(treino)/LoggingDuringWorkout';
import { Log } from '@/models/log';
import { Treino } from '@/models/treino';
import * as NotificationsLiveActivity from '@/modules/notifications-live-activity';
import { addLog } from '@/services/logService';
import { cacheActiveWorkoutLog, cacheTreino } from '@/services/offlineCacheService';
import { addTreino, updateTreino } from '@/services/treinoService';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform } from 'react-native';

export interface FinishWorkoutParams {
    user: any;
    workoutName: string;
    loggedExercises: LoggedExercise[];
    startTime: Date;
    treinoId?: string;
    fichaId?: string;
    workoutOwnerId?: string | null;
    totalLoad: number;
    currentActivityId?: string | null;
}

export function useWorkoutOperations() {
    const [isSaving, setIsSaving] = useState(false);
    const router = useRouter();

    const saveTreino = async (treino: Treino, isNew: boolean): Promise<string | null> => {
        setIsSaving(true);
        try {
            let resultId = treino.id;
            if (!isNew && treino.id) {
                await updateTreino(treino.id, treino);
                // FORCE CACHE UPDATE with FULL OBJECT
                await cacheTreino(treino);
            } else {
                resultId = await addTreino(treino);
                // Para novos treinos, precisamos do ID gerado
                if (resultId) {
                    const newTreino = { ...treino, id: resultId };
                    await cacheTreino(newTreino);
                }
            }
            return resultId;
        } catch (error) {
            console.error("Erro ao salvar treino:", error);
            Alert.alert('Erro', 'Não foi possível salvar o treino.');
            return null;
        } finally {
            setIsSaving(false);
        }
    };

    const finishWorkout = async (params: FinishWorkoutParams) => {
        const {
            user,
            workoutName,
            loggedExercises,
            startTime,
            treinoId,
            fichaId,
            workoutOwnerId,
            totalLoad,
            currentActivityId
        } = params;

        if (!user || !startTime) {
            Alert.alert('Erro', 'Dados do usuário ou do treino incompletos para salvar o log.');
            return;
        }

        setIsSaving(true);
        const finalEndTime = new Date();
        let finalTreinoId = treinoId;

        try {
            // 1. Handle "Free Workout" (Create new Treino doc if needed)
            if (!finalTreinoId) {
                const novoTreinoData: Omit<Treino, 'id'> = {
                    nome: workoutName,
                    usuarioId: user.id,
                    exercicios: loggedExercises,
                    diasSemana: [],
                    fichaId: null,
                    intervalo: { min: 1, seg: 0 },
                    ordem: 999,
                    descricao: ''
                };
                try {
                    finalTreinoId = await addTreino(novoTreinoData);
                } catch (treinoError) {
                    console.error('[finishWorkout] Erro ao criar documento do treino livre:', treinoError);
                    Alert.alert('Erro', 'Não foi possível criar o registro do treino antes de salvar o log.');
                    setIsSaving(false);
                    return;
                }
            }

            // 2. Update existing template if owner
            if (finalTreinoId && treinoId && typeof treinoId === 'string') {
                if (workoutOwnerId === user.id) {
                    // Sanitize exercises for the template: keep weight/reps updates but reset completion status
                    const exercisesForTemplate = loggedExercises.map(ex => ({
                        ...ex,
                        series: ex.series.map(s => ({
                            ...s,
                            concluido: false
                        }))
                    }));

                    try {
                        await updateTreino(treinoId, {
                            exercicios: exercisesForTemplate
                        });
                    } catch (e) {
                        console.error("[finishWorkout] Error updating template", e)
                    }
                }
            }

            // 3. Create Log
            const newLog: Partial<Log> = {
                usuarioId: user.id,
                treino: {
                    id: finalTreinoId!,
                    fichaId: (fichaId || null) as any,
                    nome: workoutName,
                    usuarioId: user.id,
                    exercicios: loggedExercises,
                    diasSemana: [],
                    intervalo: { min: 0, seg: 0 },
                    ordem: 0,
                    descricao: ''
                },
                exercicios: loggedExercises,
                horarioInicio: startTime,
                horarioFim: finalEndTime,
                status: 'concluido',
                cargaAcumulada: totalLoad,
                exerciciosFeitos: loggedExercises.filter(ex => ex.series.some(s => s.concluido)),
                nomeTreino: workoutName,
                observacoes: loggedExercises.map((ex) => ex.notes).filter(Boolean).join('; '),
            };

            const newLogId = await addLog(newLog);

            // 4. Cleanup
            if (currentActivityId && Platform.OS === 'ios') {
                await NotificationsLiveActivity.endActivity(currentActivityId);
            }
            await cacheActiveWorkoutLog(null);

            router.replace({ pathname: '/(treino)/treinoCompleto', params: { logId: newLogId } });

        } catch (error) {
            console.error('[finishWorkout] Erro ao salvar o log do treino:', error);
            Alert.alert('Erro', 'Não foi possível salvar o log do treino.');
        } finally {
            setIsSaving(false);
        }
    };

    const cancelWorkout = async (currentActivityId?: string | null) => {
        setIsSaving(true);
        try {
            if (currentActivityId && Platform.OS === 'ios') {
                await NotificationsLiveActivity.endActivity(currentActivityId);
            }
            await cacheActiveWorkoutLog(null);
            router.back();
        } catch (error) {
            console.error('[cancelWorkout] Erro ao cancelar o treino:', error);
            Alert.alert('Erro', 'Não foi possível cancelar o treino.');
        } finally {
            setIsSaving(false);
        }
    };

    return {
        saveTreino,
        finishWorkout,
        cancelWorkout,
        isSaving
    };
}
