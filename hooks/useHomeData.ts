import { useAuth } from '@/app/authprovider';
import { usePremiumStatus } from '@/hooks/usePremiumStatus';
import { Ficha } from '@/models/ficha';
import { Log } from '@/models/log';
import { Treino } from '@/models/treino';
import { Usuario } from '@/models/usuario';
import { getFichaAtiva, getFichasByUsuarioId } from '@/services/fichaService';
import { getLogsByUsuarioId } from '@/services/logService';
import {
    cacheFichaAtiva,
    cacheUserFichas,
    cacheUserLogs,
    getCachedActiveWorkoutLog,
    getCachedFichaAtiva,
    getCachedTreinosByIds,
    getCachedUserFichas,
    getCachedUserLogs,
    getCachedUserSession,
} from '@/services/offlineCacheService';
import { getTreinosByIds } from '@/services/treinoService';
import { widgetService } from '@/services/widgetService';
import { getUserProfile, updateUserProfile } from '@/userService';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';

export const useHomeData = () => {
    const { user } = useAuth();
    const { isPremium } = usePremiumStatus();
    const [treinos, setTreinos] = useState<Treino[]>([]);
    const [logs, setLogs] = useState<Log[]>([]);
    const [activeFicha, setActiveFicha] = useState<Ficha | null>(null);
    const [allFichas, setAllFichas] = useState<Ficha[]>([]);
    const [userProfile, setUserProfile] = useState<Usuario | null>(null);
    const [isWeightDrawerVisible, setWeightDrawerVisible] = useState(false);
    const [isFeatureUpvoteModalVisible, setFeatureUpvoteModalVisible] = useState(false);
    const [isFichaSelectorVisible, setFichaSelectorVisible] = useState(false);
    const [isLayoutConfigVisible, setLayoutConfigVisible] = useState(false);
    const [layout, setLayout] = useState<{ key: string; visible: boolean }[]>([]);
    const [metricsLayout, setMetricsLayout] = useState<{ key: string; visible: boolean; fullWidth: boolean; graphType?: 'bar' | 'line' }[]>([]);
    const isInitialMount = useRef(true);

    const DEFAULT_LAYOUT = [
        { key: 'weeklyCalendar', visible: true },
        { key: 'streak', visible: true },
        { key: 'quickActions', visible: true },
        { key: 'weeklyProgress', visible: true },
        { key: 'todayWorkout', visible: true },
        { key: 'metrics', visible: true },
        { key: 'friends', visible: true },
        { key: 'pastWorkouts', visible: true },
    ];

    const DEFAULT_METRICS = [
        { key: 'weight', visible: true, fullWidth: false, graphType: 'bar' as const },
        { key: 'time', visible: true, fullWidth: false, graphType: 'bar' as const },
        { key: 'sets', visible: true, fullWidth: false, graphType: 'bar' as const },
        { key: 'volume', visible: true, fullWidth: false, graphType: 'bar' as const },
    ];

    /**
     * Aplica os dados carregados (do cache ou do Firestore) no estado da tela.
     */
    const applyData = useCallback((
        activeFichaResp: Ficha | null,
        allFichasResp: Ficha[],
        combinedLogs: Log[],
        profile: Usuario | null,
        currentTreinos: Treino[],
    ) => {
        setAllFichas(allFichasResp);
        setLogs(combinedLogs);
        setUserProfile(profile);

        // Layout Config - Only load custom if premium
        if (isPremium && profile?.homeScreenConfig?.layout) {
            const profileLayout = profile.homeScreenConfig.layout;
            const presentKeys = new Set(profileLayout.map((i: any) => i.key));
            const missingItems = DEFAULT_LAYOUT.filter(i => !presentKeys.has(i.key));
            setLayout([...profileLayout, ...missingItems]);
        } else {
            setLayout(DEFAULT_LAYOUT);
        }

        if (isPremium && profile?.homeScreenConfig?.metrics) {
            setMetricsLayout(profile.homeScreenConfig.metrics);
        } else {
            setMetricsLayout(DEFAULT_METRICS);
        }

        if (activeFichaResp) {
            setActiveFicha(activeFichaResp);
            setTreinos(currentTreinos);
        } else {
            setTreinos([]);
            setActiveFicha(null);
        }
    }, [isPremium]);

    const fetchData = useCallback(async () => {
        if (!user) return;

        // --- CACHE-FIRST: carrega dados do cache imediatamente na primeira montagem ---
        if (isInitialMount.current) {
            try {
                console.log('[HomeData] Carregando dados do cache primeiro...');
                const [cachedFicha, cachedFichas, cachedLogs, cachedProfile, cachedLog] = await Promise.all([
                    getCachedFichaAtiva(),
                    getCachedUserFichas(user.id),
                    getCachedUserLogs(user.id),
                    getCachedUserSession(),
                    getCachedActiveWorkoutLog(),
                ]);

                const hasCachedData = cachedFichas.length > 0 || cachedLogs.length > 0 || cachedProfile !== null;

                if (hasCachedData) {
                    let combinedLogs = cachedLogs;
                    if (cachedLog) {
                        combinedLogs = cachedLogs.filter(log => log.id !== cachedLog.id);
                        combinedLogs.push(cachedLog);
                    }

                    // Carrega treinos do cache baseados na ficha ativa
                    let cachedTreinos: Treino[] = [];
                    if (cachedFicha && cachedFicha.treinos.length > 0) {
                        cachedTreinos = await getCachedTreinosByIds(cachedFicha.treinos);
                    }

                    // Usa apenas o profile do cache se o ID corresponde ao usuário atual
                    const profileToUse = (cachedProfile && cachedProfile.id === user.id) ? cachedProfile : null;

                    applyData(cachedFicha, cachedFichas, combinedLogs, profileToUse, cachedTreinos);
                    console.log('[HomeData] Dados do cache aplicados com sucesso.');
                }
            } catch (e) {
                console.warn('[HomeData] Falha ao carregar cache:', e);
            }
        }

        // --- ONLINE FETCH: busca dados frescos do Firestore ---
        try {
            const [activeFichaResp, firestoreLogs, cachedLog, profile, allFichasResp] = await Promise.all([
                getFichaAtiva(user.id),
                getLogsByUsuarioId(user.id),
                getCachedActiveWorkoutLog(),
                getUserProfile(user.id),
                getFichasByUsuarioId(user.id)
            ]);

            let combinedLogs = firestoreLogs;
            if (cachedLog) {
                combinedLogs = firestoreLogs.filter(log => log.id !== cachedLog.id);
                combinedLogs.push(cachedLog);
            }

            let currentTreinos: Treino[] = [];
            if (activeFichaResp) {
                currentTreinos = activeFichaResp.treinos.length > 0 ? await getTreinosByIds(activeFichaResp.treinos) : [];
            }

            applyData(activeFichaResp, allFichasResp, combinedLogs, profile, currentTreinos);

            // --- Atualiza cache para próximo uso offline ---
            try {
                if (activeFichaResp) await cacheFichaAtiva(activeFichaResp);
                if (firestoreLogs.length > 0) await cacheUserLogs(user.id, firestoreLogs);
                if (allFichasResp.length > 0) await cacheUserFichas(user.id, allFichasResp);
            } catch (cacheErr) {
                console.warn('[HomeData] Erro ao atualizar cache:', cacheErr);
            }

            // --- Atualiza widgets (protegido para não bloquear a UI) ---
            try {
                await widgetService.updateAll(currentTreinos, combinedLogs);
            } catch (widgetErr) {
                console.warn('[HomeData] Erro ao atualizar widgets:', widgetErr);
            }

        } catch (error) {
            console.error("[HomeData] Erro ao buscar dados online:", error);
            // Se falhou e é a primeira montagem, os dados do cache já foram aplicados acima.
        } finally {
            isInitialMount.current = false;
        }
    }, [user, isPremium, applyData]);

    useFocusEffect(
        useCallback(() => {
            fetchData();
        }, [fetchData])
    );

    const weeklyMetrics = useMemo(() => {
        const today = new Date();
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());
        startOfWeek.setHours(0, 0, 0, 0);

        const weeklyLogs = logs.filter(log => {
            if (!log.horarioFim) return false;
            const time = log.horarioFim.seconds ? log.horarioFim.seconds * 1000 : new Date(log.horarioFim).getTime();
            return new Date(time) >= startOfWeek;
        });

        let totalSeconds = 0;
        let totalSets = 0;
        let totalVolume = 0;

        for (const log of weeklyLogs) {
            if (log.horarioInicio && log.horarioFim) {
                const start = log.horarioInicio.seconds || (new Date(log.horarioInicio).getTime() / 1000);
                const end = log.horarioFim.seconds || (new Date(log.horarioFim).getTime() / 1000);
                totalSeconds += end - start;
            }
            if (log.cargaAcumulada) {
                totalVolume += log.cargaAcumulada;
            }
            for (const exercicio of log.exercicios) {
                totalSets += exercicio.series?.filter(s => (s as any).concluido).length || 0;
            }
        }

        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const formattedTime = `${hours}h ${minutes}m`;
        const formattedVolume = totalVolume > 1000 ? `${(totalVolume / 1000).toFixed(1)} t` : `${Math.round(totalVolume)} kg`;

        return {
            tempoDeTreino: formattedTime,
            series: totalSets,
            volume: formattedVolume,
        };
    }, [logs]);

    const historyMetrics = useMemo(() => {
        const generateWeeklyHistory = (getValue: (log: Log) => number) => {
            const weeklyTotals = new Map<string, { total: number, weekStartDate: Date }>();
            const getWeekStart = (d: Date) => {
                const date = new Date(d);
                date.setHours(0, 0, 0, 0);
                date.setDate(date.getDate() - date.getDay());
                return date;
            };
            const fiveWeeksAgo = getWeekStart(new Date());
            const historyLenght = 12;
            fiveWeeksAgo.setDate(fiveWeeksAgo.getDate() - ((historyLenght - 1) * 7));

            const completedLogs = logs.filter(log => {
                const time = log.horarioFim?.seconds ? log.horarioFim.seconds * 1000 : (log.horarioFim ? new Date(log.horarioFim).getTime() : 0);
                if (!time) return false;
                return new Date(time) >= fiveWeeksAgo;
            });

            for (const log of completedLogs) {
                const time = log.horarioFim?.seconds ? log.horarioFim.seconds * 1000 : new Date(log.horarioFim).getTime();
                const weekStartDate = getWeekStart(new Date(time));
                const weekKey = weekStartDate.toISOString().split('T')[0];
                const current = weeklyTotals.get(weekKey) || { total: 0, weekStartDate: weekStartDate };
                current.total += getValue(log);
                weeklyTotals.set(weekKey, current);
            }

            const result: { valor: number; data: Date }[] = [];
            // historyLenght is already declared above
            for (let i = 0; i < historyLenght; i++) {
                const weekStartDate = getWeekStart(new Date());
                weekStartDate.setDate(weekStartDate.getDate() - ((historyLenght - 1 - i) * 7));
                const weekKey = weekStartDate.toISOString().split('T')[0];
                result.push({ data: weekStartDate, valor: weeklyTotals.get(weekKey)?.total || 0 });
            }
            return result;
        };

        const timeHistory = generateWeeklyHistory(log => {
            const start = log.horarioInicio?.seconds || (log.horarioInicio ? new Date(log.horarioInicio).getTime() / 1000 : 0);
            const end = log.horarioFim?.seconds || (log.horarioFim ? new Date(log.horarioFim).getTime() / 1000 : 0);
            if (start && end) return (end - start) / 60;
            return 0;
        });
        const seriesHistory = generateWeeklyHistory(log => log.exercicios.reduce((acc, ex) => acc + (ex.series?.filter(s => (s as any).concluido).length || 0), 0));
        const volumeHistory = generateWeeklyHistory(log => log.cargaAcumulada || 0);

        let weightHistory: { valor: number; data: Date }[] = [];
        if (userProfile?.historicoPeso && userProfile.historicoPeso.length > 0) {
            weightHistory = [...userProfile.historicoPeso]
                .map(h => {
                    const date = typeof (h.data as any)?.toDate === 'function' ? (h.data as any).toDate() : new Date(h.data as any);
                    return { valor: h.valor, data: date };
                })
                .sort((a, b) => a.data.getTime() - b.data.getTime());
        }

        return { tempoDeTreino: timeHistory, series: seriesHistory, volume: volumeHistory, pesoCorporal: weightHistory };
    }, [logs, userProfile]);

    const handleSaveWeight = async (newWeight: number) => {
        if (!user || !userProfile) return;
        const newWeightRecord = { valor: newWeight, data: new Date() };
        const updatedHistorico = [...(userProfile.historicoPeso || []), newWeightRecord];
        try {
            await updateUserProfile(user.id, { historicoPeso: updatedHistorico });
            setUserProfile(prev => prev ? { ...prev, historicoPeso: updatedHistorico } : null);
            setWeightDrawerVisible(false);
        } catch (error) {
            console.error("Erro ao salvar o novo peso:", error);
            Alert.alert("Erro", "Não foi possível salvar seu novo peso. Tente novamente.");
        }
    };

    const getLatestWeight = () => {
        if (!userProfile?.historicoPeso || userProfile.historicoPeso.length === 0) return 70;
        const sortedHistorico = [...userProfile.historicoPeso]
            .map(h => ({ ...h, data: typeof (h.data as any)?.toDate === 'function' ? (h.data as any).toDate() : new Date(h.data as any) }))
            .sort((a, b) => b.data.getTime() - a.data.getTime());
        return sortedHistorico[0].valor;
    };

    const saveLayout = async (newLayout: { key: string; visible: boolean }[]) => {
        if (!user) return;
        setLayout(newLayout);
        try {
            await updateUserProfile(user.id, {
                homeScreenConfig: { layout: newLayout, metrics: metricsLayout }
            });
        } catch (error) {
            console.error("Erro ao salvar configuração de layout:", error);
        }
    };

    const saveMetricsConfig = async (newMetricsLayout: { key: string; visible: boolean; fullWidth: boolean; graphType?: 'bar' | 'line' }[]) => {
        if (!user) return;
        setMetricsLayout(newMetricsLayout);
        try {
            await updateUserProfile(user.id, {
                homeScreenConfig: { layout: layout, metrics: newMetricsLayout }
            });
        } catch (error) {
            console.error("Erro ao salvar configuração das métricas:", error);
        }
    };

    return {
        user,
        treinos,
        logs,
        activeFicha,
        userProfile,
        isWeightDrawerVisible,
        setWeightDrawerVisible,
        isFeatureUpvoteModalVisible,
        setFeatureUpvoteModalVisible,
        weeklyMetrics,
        historyMetrics,
        handleSaveWeight,
        getLatestWeight,
        fetchData,
        allFichas,
        isFichaSelectorVisible,
        setFichaSelectorVisible,
        isLayoutConfigVisible,
        setLayoutConfigVisible,
        layout,
        saveLayout,
        metricsLayout,
        saveMetricsConfig,
    };
};
