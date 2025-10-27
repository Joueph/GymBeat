/*
 * Este arquivo é um ESBOÇO de como você pode implementar a lógica
 * de atualização do documento de estatísticas no banco de dados.
 *
 * Estou usando o FIREBASE/FIRESTORE como exemplo, pois é muito
 * comum em apps React Native e se encaixa na descrição de "documento".
 */

// Importações de exemplo (adapte ao seu setup do Firebase)
import { EmailAuthProvider, getAuth, linkWithCredential, signInAnonymously } from 'firebase/auth';
import { doc, getFirestore, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { app } from '../firebaseconfig'; // Seu arquivo de config do Firebase
import { EstatisticasOnboarding } from '../models/EstatisticasOnboarding';

// Instâncias de exemplo
const db = getFirestore(app);
const auth = getAuth(app);

/**
 * Retorna a referência do documento de estatísticas para o usuário atual.
 * O ID do documento será o mesmo ID do usuário (uid).
 */
const getEstatisticasDocRef = () => {
  const userId = auth.currentUser?.uid;
  if (!userId) {
    console.error("Usuário não autenticado para o serviço de onboarding. A autenticação anônima pode ter falhado.");
    return null;
  }
  return doc(db, 'estatisticasOnboarding', userId); // Coleção 'estatisticasOnboarding'
};

/**
 * Inicia o onboarding: autentica o usuário anonimamente e cria o documento de estatísticas.
 * Deve ser chamado quando o usuário clica em "Vamos lá".
 */
export const iniciarOnboarding = async () => {
  try {
    // 1. Autentica o usuário anonimamente
    if (!auth.currentUser) {
      await signInAnonymously(auth);
      console.log("Usuário anônimo autenticado.");
    } else {
      console.log("Usuário já autenticado (anônimo ou permanente).");
    }

    const docRef = getEstatisticasDocRef();
    if (!docRef) return;

    const dadosIniciais: Partial<EstatisticasOnboarding> = {
      horarioInicioOnboarding: serverTimestamp(),
      horarioRegistro: null,
      ondeOuviuGymBeat: null,
      tentouOutrosApps: null,
      objetivoPrincipal: null,
      maiorProblemaTreinar: null,
      problemasParaTreinar: null,
      localTreino: null,
      possuiEquipamentosCasa: null,
      nivelExperiencia: null,
      compromissoSemanal: null,
      metaSemanas: null,
      nomePreferido: null,
      genero: null,
      alturaCm: null,
      pesoKg: null,
      dataNascimento: null,
      adicionouFotoPerfil: null,
    };

    // 2. Cria o documento de estatísticas no Firestore
    // Usamos 'setDoc' com 'merge: true' para criar o documento
    // ou mesclar, caso ele já exista (sem sobrescrever dados).
    await setDoc(docRef, dadosIniciais, { merge: true });
    console.log("Documento de estatísticas do Onboarding iniciado no Firestore.");
  } catch (error) {
    console.error("Erro ao iniciar estatísticas do onboarding: ", error);
  }
};

/**
 * Atualiza um ou mais campos no documento de estatísticas.
 * Deve ser chamado toda vez que o usuário avança um passo (clica em "Continuar").
 *
 * @param dadosParaAtualizar Um objeto parcial com os campos a serem atualizados.
 * (Ex: { objetivoPrincipal: 'Perder peso' })
 */
export const atualizarPassoOnboarding = async (
  dadosParaAtualizar: Partial<EstatisticasOnboarding>
) => {
  const docRef = getEstatisticasDocRef();
  if (!docRef) return;

  try {
    // 'updateDoc' atualiza apenas os campos fornecidos.
    await updateDoc(docRef, dadosParaAtualizar);
    console.log("Estatísticas do Onboarding atualizadas no Firestore: ", dadosParaAtualizar);
  } catch (error) {
    console.error("Erro ao atualizar passo do onboarding: ", error);
  }
};

/**
 * Converte a conta anônima em uma conta permanente com e-mail e senha.
 * @param email O e-mail do usuário.
 * @param senha A senha do usuário.
 */
export const converterContaAnonima = async (email: string, senha: string) => {
  const currentUser = auth.currentUser;
  if (!currentUser || !currentUser.isAnonymous) {
    throw new Error("Nenhum usuário anônimo encontrado para converter.");
  }
  
  const credential = EmailAuthProvider.credential(email, senha);
  await linkWithCredential(currentUser, credential);
  console.log("Conta anônima convertida para conta permanente.");
};

/**
 * Finaliza o onboarding, marcando a hora de registro no documento de estatísticas.
 * Deve ser chamado após a conversão da conta.
 */
export const finalizarOnboarding = async () => {
  const docRef = getEstatisticasDocRef();
  if (!docRef) return;
  try {
    await updateDoc(docRef, { horarioRegistro: serverTimestamp() });
    console.log("Onboarding finalizado e horário de registro salvo.");
  } catch (error) {
    console.error("Erro ao finalizar onboarding: ", error);
  }
};
