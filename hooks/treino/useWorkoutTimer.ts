import { useTimer } from '@/contexts/TimerContext';
import { LoggedExercise, SerieEdit } from '@/types/logging';
import { useEffect, useState } from 'react';
import { useSharedValue, withTiming } from 'react-native-reanimated';

export const useWorkoutTimer = (
    loggedExercises: LoggedExercise[],
    setLoggedExercises: (exercises: LoggedExercise[]) => void
) => {
    const {
        startTimer: ctxStartTimer,
        stopTimer: ctxStopTimer,
        skipTimer: ctxSkipTimer,
        timerState,
        elapsedTime: timerElapsed,
        duration: timerDuration,
        type: timerType,
    } = useTimer();

    const [setBeingTimed, setSetBeingTimed] = useState<{ exerciseIndex: number; setIndex: number } | null>(null);
    const progress = useSharedValue(0);

    const isResting = timerState === 'running' && timerType === 'rest';
    const isDoingExercise = timerState === 'running' && timerType === 'exercise';

    const restCountdown = isResting ? Math.max(0, timerDuration - timerElapsed) : 0;
    const exerciseCountdown = isDoingExercise ? Math.max(0, timerDuration - timerElapsed) : 0;

    const currentTimerProgress = timerDuration > 0 ? timerElapsed / timerDuration : 0;

    useEffect(() => {
        progress.value = withTiming(Math.min(1, currentTimerProgress), { duration: 300 });
    }, [currentTimerProgress]);

    const startTimer = async (
        duration: number,
        isExerciseTimer: boolean,
        timedSetInfo?: { exerciseIndex: number; setIndex: number },
        completedSetInfo?: { exerciseIndex: number; setIndex: number }
    ) => {
        let metadata: any = {};

        if (timedSetInfo) {
            const ex = loggedExercises[timedSetInfo.exerciseIndex];
            const s = ex.series[timedSetInfo.setIndex];
            metadata = {
                exerciseIndex: timedSetInfo.exerciseIndex,
                setIndex: timedSetInfo.setIndex,
                exerciseName: ex.modelo.nome,
                weight: `${s.peso}kg`,
                reps: `${s.repeticoes}`,
                totalSets: ex.series.length,
            };
            setSetBeingTimed(timedSetInfo);
        } else if (completedSetInfo) {
            const ex = loggedExercises[completedSetInfo.exerciseIndex];
            const nextSetIndex = completedSetInfo.setIndex + 1;
            const totalSets = ex.series.length;

            if (nextSetIndex < totalSets) {
                const nextSet = ex.series[nextSetIndex];
                metadata = {
                    exerciseName: 'Descanso',
                    setIndex: nextSetIndex,
                    totalSets: totalSets,
                    weight: `${nextSet.peso}kg`,
                    reps: `${nextSet.repeticoes}`,
                    nextExerciseName: ex.modelo.nome,
                };
            } else {
                metadata = {
                    exerciseName: 'Descanso',
                    totalSets: totalSets,
                    setIndex: completedSetInfo.setIndex,
                };
            }
            setSetBeingTimed(null);
        }

        ctxStartTimer(duration, isExerciseTimer ? 'exercise' : 'rest', metadata);
    };

    useEffect(() => {
        if (timerState === 'finished') {
            if (timerType === 'exercise' && setBeingTimed) {
                const { exerciseIndex, setIndex } = setBeingTimed;
                const updatedExercises = [...loggedExercises];
                const exercise = updatedExercises[exerciseIndex];
                if (exercise && exercise.series[setIndex]) {
                    (exercise.series as SerieEdit[])[setIndex].concluido = true;
                    setLoggedExercises(updatedExercises);
                    startTimer(exercise.restTime || 60, false);
                }
                setSetBeingTimed(null);
            }
        }
    }, [timerState, timerType]);

    const handleSkipRest = async () => {
        ctxSkipTimer();
    };

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    return {
        startTimer,
        stopTimer: ctxStopTimer, // Expose raw stop if needed
        handleSkipRest,
        isResting,
        isDoingExercise,
        restCountdown,
        exerciseCountdown,
        progress,
        formatTime,
        timerState // Expose state if needed
    };
};
