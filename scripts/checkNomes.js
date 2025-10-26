// checkNomes.js
import csv from 'csv-parser';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs, { readFileSync } from 'fs';

// --- CONFIGURAÇÃO ---
// 1. Altere para o caminho da sua chave de conta de serviço
const serviceAccount = JSON.parse(readFileSync('../serviceAccountKey.json', 'utf8'));// 2. Altere para o nome exato da sua coleção no Firestore

// 2. Altere para o nome exato da sua coleçãoA
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
 * Lê o CSV e retorna um Set de nomes únicos
 */
async function getNomesDoCSV(filePath) {
  const nomes = new Set();
  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv({ header: false, mapHeaders: ({ index }) => (index === 0 ? 'nome' : 'caracteristica') }))
      .on('data', (row) => {
        if (row.nome) {
          nomes.add(row.nome.trim());
        }
      })
      .on('end', () => resolve(nomes))
      .on('error', reject);
  });
}

/**
 * Busca todos os nomes de exercícios do Firestore
 */
async function getNomesDoFirestore(collectionName) {
  const nomes = new Set();
  const snapshot = await db.collection(collectionName).select('nome').get();
  snapshot.forEach(doc => {
    const nome = doc.data().nome;
    if (nome) {
      nomes.add(nome.trim());
    }
  });
  return nomes;
}

/**
 * Função Principal de Verificação
 */
async function verificarNomes() {
  try {
    console.log('Iniciando verificação...');
    console.log(`Lendo nomes do CSV: ${CSV_FILE_PATH}`);
    const nomesCSV = await getNomesDoCSV(CSV_FILE_PATH);
    console.log(`Total de ${nomesCSV.size} nomes únicos encontrados no CSV.`);

    console.log(`Buscando nomes do Firestore (Coleção: ${NOME_DA_COLECAO})...`);
    const nomesDB = await getNomesDoFirestore(NOME_DA_COLECAO);
    console.log(`Total de ${nomesDB.size} nomes únicos encontrados no Firestore.`);

    const nomesFaltantes = [];
    nomesCSV.forEach(nome => {
      if (!nomesDB.has(nome)) {
        nomesFaltantes.push(nome);
      }
    });

    console.log('-------------------------------------------');
    if (nomesFaltantes.length === 0) {
      console.log('✅ SUCESSO! Todos os nomes do CSV foram encontrados no banco de dados.');
    } else {
      console.error(`❌ ERRO: ${nomesFaltantes.length} nomes do CSV não foram encontrados no banco de dados:`);
      nomesFaltantes.forEach(nome => console.log(`  - ${nome}`));
      console.log('Corrija os nomes no CSV ou no banco de dados antes de rodar o script principal.');
    }
    console.log('-------------------------------------------');

  } catch (error) {
    console.error('Ocorreu um erro durante a verificação:', error);
  }
}

verificarNomes();