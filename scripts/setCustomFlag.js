// scripts/setCustomFlag.js
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

// --- CONFIGURAÇÃO ---
// 1. Certifique-se de que o caminho para sua chave de conta de serviço está correto
const serviceAccount = JSON.parse(readFileSync('../serviceAccountKey.json', 'utf8'));

// 2. Nome da coleção no Firestore
const NOME_DA_COLECAO = 'exerciciosModelos';
// --------------------

// Inicializa o Firebase Admin
initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

/**
 * Função principal para atualizar os documentos
 */
async function setCustomFlag() {
  console.log(`Iniciando atualização da coleção: "${NOME_DA_COLECAO}"...`);
  
  const collectionRef = db.collection(NOME_DA_COLECAO);
  const snapshot = await collectionRef.get();

  if (snapshot.empty) {
    console.log('Nenhum documento encontrado. Nada a fazer.');
    return;
  }

  console.log(`Encontrados ${snapshot.size} documentos para atualizar.`);

  const LIMITE_BATCH = 500;
  let batch = db.batch();
  let writeCount = 0;
  const commitPromises = [];

  snapshot.forEach((doc) => {
    const docRef = doc.ref;
    
    // Adiciona a operação de 'update' ao batch
    batch.update(docRef, { isCustom: true });
    writeCount++;

    if (writeCount % LIMITE_BATCH === 0) {
      console.log(`Enviando batch de ${LIMITE_BATCH} operações... (Total: ${writeCount})`);
      commitPromises.push(batch.commit());
      batch = db.batch();
    }
  });

  if (writeCount % LIMITE_BATCH !== 0) {
    console.log(`Enviando batch final de ${writeCount % LIMITE_BATCH} operações...`);
    commitPromises.push(batch.commit());
  }

  await Promise.all(commitPromises);

  console.log('--------------------------------------------------');
  console.log(`✅ Atualização concluída! ${snapshot.size} documentos processados.`);
  console.log('--------------------------------------------------');
}

setCustomFlag().catch(error => {
  console.error('Ocorreu um erro durante a atualização:', error);
});
