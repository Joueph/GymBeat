import * as admin from 'firebase-admin';
import * as functions from "firebase-functions";
import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

admin.initializeApp();
const db = admin.firestore();

/**
 * Callable function that creates a pending friendship between two users.
 * @param request Callable request containing fromUserId and friendCode in request.data.
 * @returns Object with success=true after both user documents are updated.
 */
export const sendFriendRequest = onCall(async (request) => {
  functions.logger.info("Iniciando sendFriendRequest. Dados recebidos:", request.data);
  const { fromUserId, friendCode } = request.data;

  if (!fromUserId || !friendCode) {
    functions.logger.error("Argumentos inválidos: fromUserId ou friendCode faltando.");
    throw new HttpsError("invalid-argument", "Faltando fromUserId ou friendCode.");
  }

  const usersRef = db.collection("users");
  const querySnapshot = await usersRef.where("email", "==", friendCode).limit(1).get();

  if (querySnapshot.empty) {
    functions.logger.error(`Nenhum usuário encontrado com o email: '${friendCode}'`);
    throw new HttpsError("not-found", "Nenhum usuário encontrado com este código.");
  }

  const toUserDoc = querySnapshot.docs[0];
  const toUserId = toUserDoc.id;

  if (fromUserId === toUserId) {
    throw new HttpsError("invalid-argument", "Você não pode adicionar a si mesmo.");
  }

  const fromUserRef = db.collection("users").doc(fromUserId);
  const toUserRef = db.collection("users").doc(toUserId);
  const batch = db.batch();

  // Escreve o estado inicial da amizade em ambos os documentos
  batch.update(fromUserRef, { [`amizades.${toUserId}`]: true });
  batch.update(toUserRef, { [`amizades.${fromUserId}`]: false });

  await batch.commit();
  return { success: true };
});


/**
 * Firestore trigger that mirrors an accepted friend request back to the requester.
 * @param event users/{acceptingUserId} update event containing before/after amizade maps.
 * @returns null after processing, or early when no relevant friendship transition is found.
 */
export const onFriendRequestAccepted = onDocumentUpdated("users/{acceptingUserId}", async (event) => {
  if (!event.data) return;

  const beforeData = event.data.before.data();
  const afterData = event.data.after.data();
  const acceptingUserId = event.params.acceptingUserId;

  if (!beforeData?.amizades || !afterData?.amizades) {
    functions.logger.info("Dados de amizades ausentes ou incompletos.");
    return null;
  }

  // LÓGICA CORRIGIDA (SOLUÇÃO PARA O MOTIVO 2)
  // Encontra o ID do amigo cujo status mudou de 'false' para 'true'
  const afterFriendsMap = afterData.amizades;
  const beforeFriendsMap = beforeData.amizades;

  let acceptedFriendId: string | null = null;

  // Itera sobre as amizades no estado "depois"
  for (const friendId in afterFriendsMap) {
    // Verifica se a amizade é nova ou se mudou de false para true
    const wasFalse = beforeFriendsMap[friendId] === false;
    const isTrueNow = afterFriendsMap[friendId] === true;

    if (wasFalse && isTrueNow) {
      acceptedFriendId = friendId;
      break;
    }
  }

  if (acceptedFriendId) {
    functions.logger.info(`Detectada aceitação de amizade. ${acceptingUserId} aceitou ${acceptedFriendId}.`);
    const requesterUserRef = db.collection("users").doc(acceptedFriendId);

    // Atualiza o documento do solicitante (Usuário A) para confirmar a amizade mútua.
    await requesterUserRef.update({
      [`amizades.${acceptingUserId}`]: true
    });
    functions.logger.info(`Documento de ${acceptedFriendId} atualizado com sucesso.`);
  }

  return null;
});

/**
 * Sincroniza dados essenciais para as regras de segurança (amizades e configurações de privacidade)
 * para uma subcoleção pública sempre que o documento do usuário for atualizado.
 * @param event users/{userId} update event containing before/after user data.
 * @returns null after syncing when privacy/friend data changed.
 */
export const syncPublicProfile = onDocumentUpdated("users/{userId}", async (event) => {
  if (!event.data) return;

  const afterData = event.data.after.data();
  const beforeData = event.data.before.data();
  const userId = event.params.userId;

  const amizadesChanged = JSON.stringify(afterData.amizades) !== JSON.stringify(beforeData.amizades);
  const settingsChanged = JSON.stringify(afterData.settings) !== JSON.stringify(beforeData.settings);

  if (amizadesChanged || settingsChanged) {
    const publicProfileRef = db.collection("users").doc(userId).collection("publicProfile").doc("data");

    const publicData = {
      amizades: afterData.amizades || {},
      profileVisibility: afterData.settings?.privacy?.profileVisibility || 'amigos',
    };

    functions.logger.info(`Sincronizando perfil público para ${userId}`, publicData);
    await publicProfileRef.set(publicData, { merge: true });
  }

  return null;
});

// Nenhuma alteração necessária aqui, pois é tratado no cliente.
/**
 * Placeholder trigger for rejected friend requests.
 * @param event users/{rejectingUserId} update event.
 * @returns null because rejection cleanup is handled on the client.
 */
export const onFriendRequestRejected = onDocumentUpdated("users/{rejectingUserId}", async (event) => {
  return null;
});


/**
 * Callable function that returns a friend's profile and last-seven-days workout logs.
 * @param request Callable request containing friendId in request.data and auth context.
 * @returns Friend profile plus weeklyLogs ordered by horarioFim descending.
 */
export const getFriendActivity = onCall(async (request) => {
  const { friendId } = request.data;
  const auth = request.auth;

  if (!friendId) {
    throw new HttpsError("invalid-argument", "friendId é obrigatório.");
  }

  // Verificação básica de autenticação
  if (!auth) {
    throw new HttpsError("unauthenticated", "Usuário deve estar autenticado.");
  }

  try {
    const userDoc = await db.collection("users").doc(friendId).get();

    if (!userDoc.exists) {
      throw new HttpsError("not-found", "Usuário não encontrado.");
    }

    // Busca logs dos últimos 7 dias na coleção RAIZ 'logs'
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const logsSnapshot = await db.collection("logs")
      .where("usuarioId", "==", friendId)
      .where("horarioFim", ">=", sevenDaysAgo)
      .orderBy("horarioFim", "desc")
      .get();

    const weeklyLogs = logsSnapshot.docs.map(doc => {
      const data = doc.data();
      // Convert timestamps to string/number if needed for serialization, but Firestore SDK usually handles it.
      // However, onCall usually serializes dates to ISO strings.
      return { id: doc.id, ...data };
    });

    return {
      profile: { id: userDoc.id, ...userDoc.data() },
      weeklyLogs
    };
  } catch (error) {
    functions.logger.error("Erro em getFriendActivity:", error);
    throw new HttpsError("internal", "Erro ao buscar atividade.");
  }
});
