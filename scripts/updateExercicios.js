// Importe os pacotes necessários do Firebase Admin SDK
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

// --- CONFIGURAÇÃO ---
// 1. Altere para o caminho da sua chave de conta de serviço
// Nova linha
// Nova linha
const serviceAccount = JSON.parse(readFileSync('../serviceAccountKey.json', 'utf8'));// 2. Altere para o nome exato da sua coleção no Firestore
const NOME_DA_COLECAO = 'exerciciosModelos'; // Ex: 'exercicios', 'modelosExercicios', etc.
// --------------------

// Inicializa o app Firebase Admin
initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

// O objeto que queremos mesclar em cada documento
const defaultCaracteristicas = {
  caracteristicas: {
    isPesoCorporal: false,
    isPesoBilateral: false,
    usaBarra: false
  }
};

/**
 * Função principal para atualizar os documentos
 */
async function adicionarCaracteristicasPadrao() {
  console.log(`Iniciando atualização da coleção: "${NOME_DA_COLECAO}"...`);
  
  const collectionRef = db.collection(NOME_DA_COLECAO);
  const snapshot = await collectionRef.get();

  if (snapshot.empty) {
    console.log('Nenhum documento encontrado. Nada a fazer.');
    return;
  }

  console.log(`Encontrados ${snapshot.size} documentos para atualizar.`);

  // O Firebase tem um limite de 500 operações por batch
  const LIMITE_BATCH = 500;
  let batch = db.batch();
  let writeCount = 0;
  const commitPromises = []; // Para aguardar todos os commits

  snapshot.forEach((doc) => {
    const docRef = doc.ref;
    
    // Adiciona a operação de 'set' com 'merge' ao batch
    batch.set(docRef, defaultCaracteristicas, { merge: true });
    writeCount++;

    // Se o batch atingir o limite, faz o commit e cria um novo
    if (writeCount % LIMITE_BATCH === 0) {
      console.log(`Enviando batch de ${LIMITE_BATCH} operações... (Total: ${writeCount})`);
      commitPromises.push(batch.commit());
      batch = db.batch(); // Inicia um novo batch
    }
  });

  // Envia o batch final (com as operações restantes)
  if (writeCount % LIMITE_BATCH !== 0) {
    console.log(`Enviando batch final de ${writeCount % LIMITE_BATCH} operações...`);
    commitPromises.push(batch.commit());
  }

  // Aguarda todos os batches serem concluídos
  await Promise.all(commitPromises);

  console.log('--------------------------------------------------');
  console.log(`✅ Atualização concluída! ${snapshot.size} documentos processados.`);
  console.log('--------------------------------------------------');
}

// Executa a função
adicionarCaracteristicasPadrao().catch(error => {
  console.error('Ocorreu um erro durante a atualização:', error);
});