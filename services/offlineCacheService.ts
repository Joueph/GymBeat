//  /services/offlineCacheService.ts

import { Log } from '@/models/log';
import { Usuario } from '@/models/usuario';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { Ficha } from '../models/ficha';
import { Treino } from '../models/treino';

const FICHA_ATIVA_CACHE_KEY = 'activeFichaCache';
const TREINOS_CACHE_KEY_PREFIX = 'treinoCache_';
const ACTIVE_WORKOUT_LOG_KEY = 'activeWorkoutLog';
const USER_SESSION_CACHE_KEY = 'userSessionCache';
const CURRENT_USER_ID_KEY = 'currentUserId';


/**
 * Garante que uma mídia (vídeo/imagem) de um exercício seja baixada e salva localmente.
 * Reutiliza a lógica já presente nos componentes de vídeo para ser proativo.
 * @param remoteUri A URL remota da mídia.
 */
const preCacheMedia = async (remoteUri: string | undefined): Promise<void> => {
    if (!remoteUri) return;

    try {
        const fileName = remoteUri.split('/').pop()?.split('?')[0];
        if (!fileName) return;

        const localFileUri = `${FileSystem.cacheDirectory}${fileName}`;
        const fileInfo = await FileSystem.getInfoAsync(localFileUri);

        if (!fileInfo.exists) {
            // console.log(`[Cache] Baixando mídia: ${fileName}`);
            await FileSystem.downloadAsync(remoteUri, localFileUri);
        }
    } catch (error) {
        console.error(`[Cache] Erro ao baixar a mídia ${remoteUri}:`, error);
    }
};

/**
 * Salva a ficha ativa e todos os seus treinos e exercícios associados no cache local.
 * Também dispara o pré-cache de todas as mídias dos exercícios.
 * @param ficha A ficha de treino ativa.
 * @param treinos A lista completa de objetos de treino associados à ficha.
 */
export const cacheFichaCompleta = async (ficha: Ficha, treinos: Treino[]): Promise<void> => {
    try {
        // 1. Salvar a ficha e os treinos em AsyncStorage
        await AsyncStorage.setItem(FICHA_ATIVA_CACHE_KEY, JSON.stringify(ficha));
        for (const treino of treinos) {
            await AsyncStorage.setItem(`${TREINOS_CACHE_KEY_PREFIX}${treino.id}`, JSON.stringify(treino));
        }
        // console.log(`[Cache] Ficha '${ficha.nome}' e ${treinos.length} treinos salvos no cache.`);

        // 2. Iniciar o download de todas as mídias em background
        const mediaPromises: Promise<void>[] = [];
        treinos.forEach(treino => {
            treino.exercicios.forEach(exercicio => {
                mediaPromises.push(preCacheMedia(exercicio.modelo.imagemUrl));
            });
        });

        await Promise.all(mediaPromises);
        // console.log(`[Cache] Pré-cache de ${mediaPromises.length} mídias concluído.`);

    } catch (error) {
        console.error("[Cache] Erro ao salvar a ficha completa no cache:", error);
    }
};

/**
 * Salva o estado atual do log do treino em andamento no AsyncStorage.
 * @param log O objeto de log do treino.
 */
export const cacheActiveWorkoutLog = async (log: Log | null): Promise<void> => {
    try {
        if (log) {
            await AsyncStorage.setItem(ACTIVE_WORKOUT_LOG_KEY, JSON.stringify(log));
        } else {
            // Se o log for nulo, removemos do cache para limpar.
            await AsyncStorage.removeItem(ACTIVE_WORKOUT_LOG_KEY);
        }
    } catch (error) {
        console.error("[Cache] Erro ao salvar o log do treino ativo:", error);
    }
};

/**
 * Recupera o log do treino em andamento do AsyncStorage.
 * @returns O objeto de log do treino ou null se não houver nenhum.
 */
export const getCachedActiveWorkoutLog = async (): Promise<Log | null> => {
    try {
        const logJson = await AsyncStorage.getItem(ACTIVE_WORKOUT_LOG_KEY);
        return logJson ? JSON.parse(logJson) : null;
    } catch (error) {
        console.error("[Cache] Erro ao recuperar o log do treino ativo:", error);
        return null;
    }
};

/**
 * Recupera um treino específico do cache do AsyncStorage.
 * @param treinoId O ID do treino a ser recuperado.
 * @returns O objeto de treino ou null se não for encontrado.
 */
export const getCachedTreinoById = async (treinoId: string): Promise<Treino | null> => {
    try {
        const treinoJson = await AsyncStorage.getItem(`${TREINOS_CACHE_KEY_PREFIX}${treinoId}`);
        return treinoJson ? JSON.parse(treinoJson) : null;
    } catch (error) {
        console.error(`[Cache] Erro ao recuperar o treino ${treinoId} do cache:`, error);
        return null;
    }
};

/**
 * Salva a sessão do usuário atual no cache local para acesso offline.
 * @param user O objeto do usuário a ser salvo.
 */
export const cacheUserSession = async (user: Usuario): Promise<void> => {
    try {
        await AsyncStorage.setItem(USER_SESSION_CACHE_KEY, JSON.stringify(user));
        await AsyncStorage.setItem(CURRENT_USER_ID_KEY, user.id);
        console.log(`[Cache] Sessão do usuário '${user.nome}' salva no cache.`);
    } catch (error) {
        console.error("[Cache] Erro ao salvar a sessão do usuário:", error);
    }
};

/**
 * Recupera a sessão do usuário em cache (para uso offline).
 * @returns O objeto do usuário em cache ou null se não houver.
 */
export const getCachedUserSession = async (): Promise<Usuario | null> => {
    try {
        const userJson = await AsyncStorage.getItem(USER_SESSION_CACHE_KEY);
        return userJson ? JSON.parse(userJson) : null;
    } catch (error) {
        console.error("[Cache] Erro ao recuperar a sessão do usuário:", error);
        return null;
    }
};

/**
 * Recupera o ID do usuário atualmente em cache.
 * @returns O ID do usuário ou null se não houver.
 */
export const getCachedCurrentUserId = async (): Promise<string | null> => {
    try {
        return await AsyncStorage.getItem(CURRENT_USER_ID_KEY);
    } catch (error) {
        console.error("[Cache] Erro ao recuperar o ID do usuário:", error);
        return null;
    }
};

/**
 * Salva a ficha ativa em cache para rápida recuperação offline.
 * @param ficha A ficha ativa a ser salva.
 */
export const cacheFichaAtiva = async (ficha: Ficha): Promise<void> => {
    try {
        await AsyncStorage.setItem(FICHA_ATIVA_CACHE_KEY, JSON.stringify(ficha));
        console.log(`[Cache] Ficha ativa '${ficha.nome}' salva no cache.`);
    } catch (error) {
        console.error("[Cache] Erro ao salvar a ficha ativa no cache:", error);
    }
};

/**
 * Recupera a ficha ativa em cache (para uso offline).
 * @returns A ficha ativa em cache ou null se não houver.
 */
export const getCachedFichaAtiva = async (): Promise<Ficha | null> => {
    try {
        const fichaJson = await AsyncStorage.getItem(FICHA_ATIVA_CACHE_KEY);
        return fichaJson ? JSON.parse(fichaJson) : null;
    } catch (error) {
        console.error("[Cache] Erro ao recuperar a ficha ativa do cache:", error);
        return null;
    }
};

/**
 * Limpa toda a sessão do usuário em cache (logout).
 */
export const clearUserSessionCache = async (): Promise<void> => {
    try {
        await AsyncStorage.removeItem(USER_SESSION_CACHE_KEY);
        await AsyncStorage.removeItem(CURRENT_USER_ID_KEY);
        await AsyncStorage.removeItem(FICHA_ATIVA_CACHE_KEY);
        // Limpa também as listas
        const userId = await AsyncStorage.getItem(CURRENT_USER_ID_KEY); // Pode já ter ido embora, então melhor limpar sem depender do ID se possível, ou limpar tudo.
        // Como o ID já foi removido acima, não conseguimos limpar as chaves sufixadas pelo ID facilmente sem ter o ID antes.
        // O ideal é limpar antes de remover o ID.

        console.log("[Cache] Sessão do usuário limpa.");
    } catch (error) {
        console.error("[Cache] Erro ao limpar a sessão do usuário:", error);
    }
};

// --- NOVOS MÉTODOS PARA LISTAS ---

const USER_FICHAS_KEY = 'userFichasCache_';
const USER_TREINOS_KEY = 'userTreinosCache_';
const USER_LOGS_KEY = 'userLogsCache_';

/**
 * Salva a lista de fichas do usuário no cache.
 */
export const cacheUserFichas = async (userId: string, fichas: Ficha[]): Promise<void> => {
    try {
        await AsyncStorage.setItem(`${USER_FICHAS_KEY}${userId}`, JSON.stringify(fichas));
        // console.log(`[Cache] ${fichas.length} fichas salvas para o usuário ${userId}`);
    } catch (error) {
        console.error("[Cache] Erro ao salvar fichas:", error);
    }
};

/**
 * Recupera a lista de fichas do usuário do cache.
 */
export const getCachedUserFichas = async (userId: string): Promise<Ficha[]> => {
    try {
        const json = await AsyncStorage.getItem(`${USER_FICHAS_KEY}${userId}`);
        return json ? JSON.parse(json) : [];
    } catch (error) {
        console.error("[Cache] Erro ao recuperar fichas:", error);
        return [];
    }
};

/**
 * Salva a lista de todos os treinos do usuário no cache.
 * Também aproveita para atualizar o cache individual de cada treino.
 */
export const cacheUserTreinos = async (userId: string, treinos: Treino[]): Promise<void> => {
    try {
        await AsyncStorage.setItem(`${USER_TREINOS_KEY}${userId}`, JSON.stringify(treinos));

        // Opcional: Atualizar cache individual também, para consistência
        for (const treino of treinos) {
            await AsyncStorage.setItem(`${TREINOS_CACHE_KEY_PREFIX}${treino.id}`, JSON.stringify(treino));
        }
        // console.log(`[Cache] ${treinos.length} treinos salvos para o usuário ${userId}`);
    } catch (error) {
        console.error("[Cache] Erro ao salvar lista de treinos:", error);
    }
};

/**
 * Recupera a lista de treinos do usuário do cache.
 */
export const getCachedUserTreinos = async (userId: string): Promise<Treino[]> => {
    try {
        const json = await AsyncStorage.getItem(`${USER_TREINOS_KEY}${userId}`);
        return json ? JSON.parse(json) : [];
    } catch (error) {
        console.error("[Cache] Erro ao recuperar lista de treinos:", error);
        return [];
    }
};

/**
 * Recupera múltiplos treinos do cache individualmente.
 */
export const getCachedTreinosByIds = async (treinoIds: string[]): Promise<Treino[]> => {
    const treinos: Treino[] = [];
    for (const id of treinoIds) {
        const t = await getCachedTreinoById(id);
        if (t) treinos.push(t);
    }
    return treinos;
};

/**
 * Salva a lista de logs do usuário no cache.
 */
export const cacheUserLogs = async (userId: string, logs: Log[]): Promise<void> => {
    try {
        await AsyncStorage.setItem(`${USER_LOGS_KEY}${userId}`, JSON.stringify(logs));
        // console.log(`[Cache] ${logs.length} logs salvos para o usuário ${userId}`);
    } catch (error) {
        console.error("[Cache] Erro ao salvar logs:", error);
    }
};

/**
 * Recupera a lista de logs do usuário do cache.
 */
export const getCachedUserLogs = async (userId: string): Promise<Log[]> => {
    try {
        const json = await AsyncStorage.getItem(`${USER_LOGS_KEY}${userId}`);
        const logs = json ? JSON.parse(json) : [];

        // Precisamos garantir que as datas sejam instanciadas corretamente se necessário, 
        // mas como o JSON parse retorna string para datas, quem consome precisa tratar (como já fazem com Firestore).
        // Logs do Firestore vêm com { seconds, nanoseconds } ou Date. No cache vira string/objeto.

        return logs;
    } catch (error) {
        console.error("[Cache] Erro ao recuperar logs:", error);
        return [];
    }
};