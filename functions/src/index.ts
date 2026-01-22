import * as admin from 'firebase-admin';
import * as functions from "firebase-functions";
import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { HttpsError, onCall, onRequest } from "firebase-functions/v2/https";

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
export const onFriendRequestRejected = onDocumentUpdated("users/{rejectingUserId}", async (event) => {
  return null;
});


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

// ============================================================================
// SISTEMA DE AFILIADOS / AFFILIATE SYSTEM
// ============================================================================

/**
 * Ativa um código de afiliado para o usuário atual.
 * - Valida se o código existe e está ativo
 * - Garante que o usuário ainda não foi indicado (regra de 1 indicação apenas)
 * - Cria registro na coleção `referrals`
 */
export const activateAffiliateCode = onCall(async (request) => {
  // 1. Verificação de Autenticação
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "O usuário deve estar logado.");
  }
  const userId = request.auth.uid;
  const { code } = request.data; // Espera { code: "GYM20" }

  if (!code || typeof code !== "string") {
    throw new HttpsError("invalid-argument", "O código de afiliado é obrigatório.");
  }

  const normalizedCode = code.toUpperCase().trim();

  // 2. Executar Transação no Firestore
  try {
    const result = await db.runTransaction(async (transaction) => {
      // 2a. Verificar se usuário já tem indicação
      const referralRef = db.collection("referrals").doc(userId);
      const referralDoc = await transaction.get(referralRef);

      if (referralDoc.exists) {
        throw new HttpsError("already-exists", "Você já ativou um código de convite.");
      }

      // 2b. Verificar validade do código
      const codeRef = db.collection("affiliate_codes").doc(normalizedCode);
      const codeDoc = await transaction.get(codeRef);

      if (!codeDoc.exists) {
        throw new HttpsError("not-found", "Código de convite inválido.");
      }

      const codeData = codeDoc.data();
      if (!codeData?.isActive) {
        throw new HttpsError("failed-precondition", "Este código de convite expirou ou está inativo.");
      }

      // 2c. Preparar dados da indicação
      const newReferral = {
        id: userId,
        userId: userId,
        code: normalizedCode,
        influencerId: codeData.influencerId,
        activatedAt: admin.firestore.FieldValue.serverTimestamp(),
        status: "active",
        metadata: {
          source: "app_activation",
        },
      };

      // 2d. Gravar indicação
      transaction.set(referralRef, newReferral);

      // 2e. Atualizar estatísticas do Influenciador (Incremento Atômico)
      const influencerRef = db.collection("influencers").doc(codeData.influencerId);
      transaction.update(influencerRef, {
        "stats.totalReferrals": admin.firestore.FieldValue.increment(1),
      });

      return { success: true, code: normalizedCode, discount: codeData.discountConfig };
    });

    functions.logger.info(`Código ${normalizedCode} ativado para usuário ${userId}`);
    return result;

  } catch (error: any) {
    // Repassa HttpsError se for um erro conhecido
    if (error instanceof HttpsError) {
      throw error;
    } else if (error.code === 10 || error.code === "aborted") { // Firestore transaction abort
      throw new HttpsError("aborted", "Conflito na transação. Tente novamente.");
    }

    functions.logger.error("Erro ao ativar código de afiliado:", error);
    // Mascara erros internos genéricos
    throw new HttpsError("internal", "Não foi possível ativar o código no momento.");
  }
});

/**
 * Webhook para receber eventos do RevenueCat.
 * Gera comissão para o influenciador se a compra vier de um usuário indicado.
 * URL do Webhook será: https://<region>-<project>.cloudfunctions.net/handleRevenueCatEvent
 */
export const handleRevenueCatEvent = onRequest(async (req, res) => {
  // Nota: Configure autenticação por Header no RevenueCat se necessário para segurança extra.
  // const authHeader = req.headers.authorization; 

  const event = req.body && req.body.event;
  if (!event) {
    functions.logger.warn("Payload inválido recebido no webhook RevenueCat");
    res.status(400).send("Invalid payload");
    return;
  }

  const { type, app_user_id, currency, price, transaction_id, original_transaction_id, product_id } = event;

  // Apenas processamos Primeira Compra e Renovação
  if (!["INITIAL_PURCHASE", "RENEWAL"].includes(type)) {
    // Responder 200 para o RC saber que recebemos, mas ignoramos eventos como CANCELLATION/TEST
    res.status(200).send("Event ignored");
    return;
  }

  functions.logger.info(`Processando evento RC: ${type} para user ${app_user_id}`);

  try {
    // 1. Buscar se o usuário tem um Referral
    const referralRef = db.collection("referrals").doc(app_user_id);
    const referralDoc = await referralRef.get();

    if (!referralDoc.exists) {
      functions.logger.info(`Nenhum referral encontrado para ${app_user_id}. Venda orgânica.`);
      res.status(200).send("No referral found");
      return;
    }

    const referralData = referralDoc.data();
    const influencerId = referralData?.influencerId;
    const code = referralData?.code;

    // 2. Buscar configurações atuais do código (para pegar a taxa de comissão)
    // Poderíamos usar a taxa "snapshot" da referral se quiséssemos travar a % no momento do cadastro.
    // Aqui assumimos que vale a taxa ATUAL do código.
    const codeRef = db.collection("affiliate_codes").doc(code);
    const codeDoc = await codeRef.get();

    // Se código foi deletado, talvez não geramos comissão? Ou geramos com padrão?
    // Vamos assumir segurança: se código não existe, falha silenciosa por enquanto.
    if (!codeDoc.exists) {
      functions.logger.warn(`Código ${code} não encontrado, mas referral existe. Ignorando.`);
      res.status(200).send("Code not found");
      return;
    }

    const codeData = codeDoc.data();
    const rate = codeData?.commissionConfig?.rate || 0; // Ex: 0.20

    // Calcular valor da comissão em centavos
    // RC geralmente manda 'price' como float (19.90). Multiplicar por 100 e arredondar.
    const commissionAmount = Math.floor((price * rate) * 100);

    if (commissionAmount <= 0) {
      res.status(200).send("Commission amount zero");
      return;
    }

    // 3. Criar registro de Comissão
    const commissionData = {
      influencerId,
      referralId: app_user_id,
      sourceTransactionId: transaction_id, // ID da transação no RC/Loja
      originalTransactionId: original_transaction_id,
      productId: product_id,
      amount: commissionAmount,
      currency: currency || "BRL",
      status: "pending", // Pode ser liberado após X dias
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      eventParams: { // Guarda dados brutos caso precise debugar
        price,
        rate,
        type
      }
    };

    await db.collection("commissions").add(commissionData);

    // 4. Atualizar métricas do Influenciador
    await db.collection("influencers").doc(influencerId).update({
      "stats.totalCommissionsValue": admin.firestore.FieldValue.increment(commissionAmount)
    });

    functions.logger.info(`Comissão de ${commissionAmount} centavos gerada para influenciador ${influencerId}`);
    res.status(200).send("Commission created");

  } catch (error) {
    functions.logger.error("Erro interno no Webhook RevenueCat", error);
    res.status(500).send("Internal Server Error");
  }
});

