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
        console.log("[Cache] Sessão do usuário limpa.");
    } catch (error) {
        console.error("[Cache] Erro ao limpar a sessão do usuário:", error);
    }
};