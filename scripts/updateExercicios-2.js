// updateExercicios.js
import csv from 'csv-parser';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import { createRequire } from 'module';

// --- CONFIGURAÇÃO ---
// 1. Altere para o caminho da sua chave de conta de serviço
const require = createRequire(import.meta.url);
const serviceAccount = require('../serviceAccountKey.json');

// 2. Altere para o nome exato da sua coleção
const NOME_DA_COLECAO = 'exerciciosModelos';

// 3. Nome do arquivo CSV
const CSV_FILE_PATH = 'Lista_exs_Com_Características.csv';
// --------------------

// Inicializa o Firebase
initializeApp({
  credential: cert(serviceAccount)
});
const db = getFirestore();

/**
 * Lê o CSV e constrói o mapa de flags
 */
async function construirMapaDeFlags(filePath) {
  const exerciseMap = new Map();
  
  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv({ header: false, mapHeaders: ({ index }) => (index === 0 ? 'nome' : 'caracteristica') }))
      .on('data', (row) => {
        const nome = row.nome?.trim();
        const flag = row.caracteristica?.trim();

        if (nome && flag) {
          // Garante que o exercício exista no mapa
          if (!exerciseMap.has(nome)) {
            exerciseMap.set(nome, {
              isPesoCorporal: false,
              isPesoBilateral: false,
              usaBarra: false
            });
          }
          
          // Aplica o flag do CSV
          if (flag === 'isPesoCorporal' || flag === 'isPesoBilateral' || flag === 'usaBarra') {
            const flags = exerciseMap.get(nome);
            flags[flag] = true;
          }
        }
      })
      .on('end', () => {
        // Agora, aplica a regra lógica em todo o mapa
        console.log('CSV lido. Aplicando regra (usaBarra => isPesoBilateral)...');
        for (const [nome, flags] of exerciseMap.entries()) {
          if (flags.usaBarra) {
            if (!flags.isPesoBilateral) {
              console.log(`  - Regra aplicada: "${nome}" (usaBarra=true -> isPesoBilateral=true)`);
            }
            flags.isPesoBilateral = true;
          }
        }
        resolve(exerciseMap);
      })
      .on('error', reject);
  });
}

/**
 * Função Principal de Atualização
 */
async function atualizarExercicios() {
  try {
    console.log('Iniciando atualização...');
    const exerciseMap = await construirMapaDeFlags(CSV_FILE_PATH);
    console.log(`Mapa de ${exerciseMap.size} exercícios pronto para atualização.`);

    const collectionRef = db.collection(NOME_DA_COLECAO);
    const LIMITE_BATCH = 400; // Limite seguro por lote
    let batch = db.batch();
    let writeCount = 0;
    const commitPromises = [];
    let nomesNaoEncontrados = [];

    for (const [nome, flags] of exerciseMap.entries()) {
      // 1. Encontrar o documento pelo campo 'nome' - SINTAXE CORRETA DO FIREBASE ADMIN
      const querySnapshot = await collectionRef.where('nome', '==', nome).get();

      if (querySnapshot.empty) {
        nomesNaoEncontrados.push(nome);
      } else {
        // 2. Adicionar a atualização ao lote
        const docRef = querySnapshot.docs[0].ref;
        batch.set(docRef, { caracteristicas: flags }, { merge: true });
        writeCount++;
      }

      // 3. Fazer commit do lote se estiver cheio
      if (writeCount % LIMITE_BATCH === 0) {
        console.log(`Enviando lote de ${LIMITE_BATCH} operações...`);
        commitPromises.push(batch.commit());
        batch = db.batch();
      }
    }

    // 4. Fazer commit do lote final
    if (writeCount % LIMITE_BATCH !== 0) {
      console.log(`Enviando lote final de ${writeCount % LIMITE_BATCH} operações...`);
      commitPromises.push(batch.commit());
    }

    await Promise.all(commitPromises);

    console.log('-------------------------------------------');
    console.log(`✅ Atualização concluída! ${writeCount} documentos atualizados.`);
    if (nomesNaoEncontrados.length > 0) {
      console.warn(`⚠️ Atenção: ${nomesNaoEncontrados.length} nomes do CSV não foram encontrados:`);
      nomesNaoEncontrados.forEach(nome => console.warn(`  - ${nome}`));
    }
    console.log('-------------------------------------------');

  } catch (error) {
    console.error('Ocorreu um erro durante a atualização:', error);
  }
}

// Rode o script
atualizarExercicios();