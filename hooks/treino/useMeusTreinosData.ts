import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../app/authprovider';
import { Ficha } from '../../models/ficha';
import { Treino } from '../../models/treino';
import { getFichaAtiva, getFichasByUsuarioId } from '../../services/fichaService';
import { getCachedFichaAtiva, getCachedUserFichas, getCachedUserTreinos } from '../../services/offlineCacheService';
import { getTreinosByUsuarioId } from '../../services/treinoService';
import { DisplayItem, Folder } from './types';

export function useMeusTreinosData() {
    const { user, initialized: authInitialized } = useAuth();
    const [folders, setFolders] = useState<Folder[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [expandedFolderId, setExpandedFolderId] = useState<string | null>(null);
    const [activeFicha, setActiveFicha] = useState<Ficha | null>(null);
    const isInitialMount = useRef(true);

    const processData = useCallback((fichas: Ficha[], treinos: Treino[], fichaAtiva: Ficha | null) => {
        setActiveFicha(fichaAtiva);

        if (isInitialMount.current) {
            if (fichaAtiva) {
                setExpandedFolderId(fichaAtiva.id);
            } else {
                setExpandedFolderId('unassigned');
            }
        }

        const treinosMap = new Map(treinos.map((t: Treino) => [t.id, t]));
        const fichaFolders: Folder[] = fichas.map((ficha: Ficha) => {
            const treinosDaFicha = (ficha.treinos || [])
                .map(treinoId => treinosMap.get(treinoId))
                .filter((t): t is Treino => !!t);
            return { id: ficha.id, type: 'ficha', nome: ficha.nome, treinos: treinosDaFicha };
        });

        const treinosAvulsos = treinos.filter((treino: Treino) => !treino.fichaId);
        fichaFolders.sort((a, b) => {
            if (fichaAtiva && a.id === fichaAtiva.id) return -1;
            if (fichaAtiva && b.id === fichaAtiva.id) return 1;
            return a.nome.localeCompare(b.nome);
        });
        const pastaAvulsa: Folder = { id: 'unassigned', type: 'unassigned', nome: 'Meus Treinos', treinos: treinosAvulsos };
        const allFolders = [...fichaFolders, pastaAvulsa];

        setFolders(allFolders);
        // Note: isInitialMount is set to false in fetchData finally block usually, but here processData is pure-ish state update.
    }, []);

    const fetchData = useCallback(async (isBackgroundRefresh = false) => {
        if (!user) {
            setLoading(false);
            return;
        }

        if (isInitialMount.current && !isBackgroundRefresh) {
            try {
                console.log('[treinoHoje] Loading from cache first...');
                const [cachedFichas, cachedTreinos, cachedFichaAtiva] = await Promise.all([
                    getCachedUserFichas(user.id),
                    getCachedUserTreinos(user.id),
                    getCachedFichaAtiva()
                ]);

                if (cachedFichas.length > 0 || cachedTreinos.length > 0) {
                    processData(cachedFichas, cachedTreinos, cachedFichaAtiva);
                    setLoading(false);
                }
            } catch (e) {
                console.warn('[treinoHoje] Failed to load cache:', e);
            }
        }

        if (loading && !isInitialMount.current) {
            // Already loading or showing cache
        } else if (isInitialMount.current) {
            // Only initial mount and no cache shown yet -> keep loading true
        } else if (isBackgroundRefresh) {
            setRefreshing(true);
        }

        try {
            const [todasAsFichasDoUsuario, todosOsTreinosDoUsuario, fichaAtivaDoUsuario] = await Promise.all([
                getFichasByUsuarioId(user.id),
                getTreinosByUsuarioId(user.id),
                getFichaAtiva(user.id),
            ]);

            processData(todasAsFichasDoUsuario, todosOsTreinosDoUsuario, fichaAtivaDoUsuario);

        } catch (err) {
            console.error("[treinoHoje] Erro ao carregar dados online:", err);
        } finally {
            setLoading(false);
            setRefreshing(false);
            isInitialMount.current = false;
        }
    }, [user, loading, processData]);

    useFocusEffect(
        useCallback(() => {
            if (authInitialized) {
                fetchData(true);
            }
        }, [authInitialized, fetchData])
    );

    const displayItems = useMemo(() => {
        const items: DisplayItem[] = [];
        folders.forEach(folder => {
            const isExpanded = folder.id === expandedFolderId;
            const isPrincipal = folder.type === 'ficha' && activeFicha?.id === folder.id;

            if (!isPrincipal) {
                items.push({ type: 'folder', id: folder.id, data: folder, isExpanded, isPrincipal });
            }

            if (isExpanded) {
                folder.treinos.forEach(treino => {
                    items.push({ type: 'workout', id: treino.id, data: treino });
                });
            }
        });
        return items;
    }, [folders, expandedFolderId, activeFicha]);

    const activeFichaFolder = useMemo(() => {
        return folders.find(f => f.type === 'ficha' && activeFicha?.id === f.id);
    }, [folders, activeFicha]);

    return {
        user,
        folders,
        setFolders,
        refreshing,
        loading,
        expandedFolderId,
        setExpandedFolderId,
        activeFicha,
        setActiveFicha,
        fetchData,
        displayItems,
        activeFichaFolder
    };
}
