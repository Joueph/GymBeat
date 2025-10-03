import * as admin from 'firebase-admin';
import * as functions from "firebase-functions";
import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

admin.initializeApp();
const db = admin.firestore();

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
  const toUserData = toUserDoc.data();

  if (fromUserId === toUserId) {
    throw new HttpsError("invalid-argument", "Você não pode adicionar a si mesmo.");
  }

  const toUserRef = db.collection("users").doc(toUserId);
  const fromUserRef = db.collection("users").doc(fromUserId);
  const autoAccept = toUserData?.settings?.notifications?.autoAcceptFriendRequests === true;
  const batch = db.batch();

  if (autoAccept) {
    // ALTERAÇÃO AQUI: Usando notação de ponto para criar um mapa em vez de arrayUnion
    batch.update(toUserRef, {
      [`amizades.${fromUserId}`]: true, // Cria a chave com o ID do amigo
      solicitacoesRecebidas: admin.firestore.FieldValue.arrayRemove(fromUserId)
    });
    batch.update(fromUserRef, {
      [`amizades.${toUserId}`]: true, // Cria a chave com o ID do amigo
      solicitacoesEnviadas: admin.firestore.FieldValue.arrayRemove(toUserId)
    });
  } else {
    batch.update(toUserRef, {
      solicitacoesRecebidas: admin.firestore.FieldValue.arrayUnion(fromUserId)
    });
  }

  await batch.commit();
  return { success: true, autoAccepted: autoAccept };
});


export const onFriendRequestAccepted = onDocumentUpdated("users/{acceptingUserId}", async (event) => {
  if (!event.data) return;

  const beforeData = event.data.before.data();
  const afterData = event.data.after.data();
  const acceptingUserId = event.params.acceptingUserId;

  if (!beforeData || !afterData) return;

  // ALTERAÇÃO AQUI: Lógica para detectar novo amigo em um mapa
  const beforeFriends = beforeData.amizades ? Object.keys(beforeData.amizades) : [];
  const afterFriends = afterData.amizades ? Object.keys(afterData.amizades) : [];

  if (afterFriends.length > beforeFriends.length) {
    const requesterId = afterFriends.find((id: string) => !beforeFriends.includes(id));

    if (requesterId) {
      const requesterUserRef = db.collection("users").doc(requesterId);
      // ALTERAÇÃO AQUI: Atualiza o documento do solicitante usando a estrutura de mapa
      await requesterUserRef.update({
        [`amizades.${acceptingUserId}`]: true
      });
    }
  }
  return null;
});

/**
 * Sincroniza dados essenciais para as regras de segurança (amizades e configurações de privacidade)
 * para uma subcoleção pública sempre que o documento do usuário for atualizado.
 */
export const syncPublicProfile = onDocumentUpdated("users/{userId}", async (event) => {
  if (!event.data) return;

  const afterData = event.data.after.data();
  const beforeData = event.data.before.data();
  const userId = event.params.userId;

  // Verifica se as amizades ou as configurações de privacidade mudaram.
  const amizadesChanged = JSON.stringify(afterData.amizades) !== JSON.stringify(beforeData.amizades);
  const settingsChanged = JSON.stringify(afterData.settings) !== JSON.stringify(beforeData.settings);

  if (amizadesChanged || settingsChanged) {
    const publicProfileRef = db.collection("users").doc(userId).collection("publicProfile").doc("data");

    const publicData = {
      amizades: afterData.amizades || {},
      profileVisibility: afterData.settings?.privacy?.profileVisibility || 'amigos', // 'amigos' como padrão
    };

    functions.logger.info(`Sincronizando perfil público para ${userId}`, publicData);
    await publicProfileRef.set(publicData, { merge: true });
  }

  return null;
});


// Nenhuma alteração necessária aqui, pois é tratado no cliente.
export const onFriendRequestRejected = onDocumentUpdated("users/{rejectingUserId}", async (event) => {
  return null;
});