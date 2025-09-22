const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// --- CONFIGURAÇÃO ---
// 1. Coloque o caminho para o seu arquivo de chave de conta de serviço
const serviceAccount = require('./serviceAccountKey.json');
// 2. Coloque o caminho para o seu arquivo JSON de fichas
const fichasJsonPath = path.join(__dirname, 'fichas_com_treinos.json'); // Arquivo JSON com as fichas

// --- INICIALIZAÇÃO DO FIREBASE ---
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

/**
 * Busca todos os exercícios modelo do Firestore e os retorna em um Map
 * para acesso rápido e eficiente.
 * @returns {Promise<Map<string, object>>} Um Map onde a chave é o nome do exercício
 * e o valor é o objeto do exercício com seu ID.
 */
async function fetchAllExerciciosModelos() {
    console.log('Buscando todos os exercícios modelo do Firestore...');
    const exerciciosModelosMap = new Map();
    const snapshot = await db.collection('exerciciosModelos').get();
    snapshot.forEach(doc => {
        // Normaliza o nome para minúsculas para busca case-insensitive
        const normalizedName = doc.data().nome.trim().toLowerCase();
        exerciciosModelosMap.set(normalizedName, { id: doc.id, ...doc.data() });
    });
    console.log(`✅ ${exerciciosModelosMap.size} exercícios modelo carregados na memória.`);
    return exerciciosModelosMap;
}

/**
 * Processa e faz o upload de fichas de treino a partir de um arquivo JSON.
 */
async function uploadFichas() {
    if (!fs.existsSync(fichasJsonPath)) {
        console.error(`❌ ERRO: O arquivo de fichas JSON não foi encontrado em: ${fichasJsonPath}`);
        return;
    }

    // Pré-carrega todos os exercícios para evitar múltiplas queries
    const exerciciosModelosMap = await fetchAllExerciciosModelos();

    try {
        const fileContent = fs.readFileSync(fichasJsonPath, 'utf-8');
        const fichasArray = JSON.parse(fileContent);

        if (!Array.isArray(fichasArray) || fichasArray.length === 0) {
            console.warn(`⚠️ AVISO: Nenhum dado de ficha encontrado ou o formato é inválido em "${path.basename(fichasJsonPath)}". O arquivo deve conter um array de fichas.`);
            return;
        }

        console.log(`\nIniciando processamento de ${fichasArray.length} ficha(s) do arquivo JSON...`);

        for (const fichaData of fichasArray) {
            console.log(`\n--- Processando Ficha: "${fichaData.Nome}" ---`);

            // 1. Criar o documento da Ficha Modelo com seus metadados
            const fichaMetadata = {
                nome: fichaData.Nome,
                dificuldade: fichaData.Dificuldade,
                sexo: fichaData['Gênero da ficha'] || 'Ambos',
                tempo_ficha: fichaData['Tempo para expiração'] || '2',
                tipo: fichaData['Tipo de Ficha'] || 'Criado pela GymBeat',
            };

            const fichaDocRef = await db.collection('fichasModelos').add(fichaMetadata);
            console.log(`✅ Ficha "${fichaMetadata.nome}" criada com ID: ${fichaDocRef.id}`);

            // 2. Iterar sobre os treinos da ficha
            if (!fichaData.Treinos || !Array.isArray(fichaData.Treinos)) {
                console.warn(`  ⚠️ AVISO: Ficha "${fichaData.Nome}" não contém treinos ou o formato está incorreto. Pulando treinos.`);
                continue;
            }

            const treinoIds = [];

            for (const treinoData of fichaData.Treinos) {
                console.log(`  -> Preparando Treino: "${treinoData.Nome}"`);

                // 3. Mapear dias da semana
                const diasSemana = treinoData['Dias Da Semana']
                    .split(',')
                    .map(d => d.trim().toLowerCase())
                    .filter(d => d); // Filtra strings vazias

                if (diasSemana.length === 0) {
                    console.warn(`     ⚠️ Treino "${treinoData.Nome}" não tem dias da semana definidos. Pulando.`);
                    continue;
                }

                // 4. Processar cada exercício do treino
                const exerciciosParaFirestore = [];
                for (const nomeExercicio of treinoData.Exercícios) {
                    const trimmedName = nomeExercicio.trim();
                    const modelo = exerciciosModelosMap.get(trimmedName.toLowerCase());

                    if (modelo) {
                        exerciciosParaFirestore.push({
                            modelo: modelo,
                            modeloId: modelo.id,
                            series: 3, // Valor padrão
                            repeticoes: '10-12', // Valor padrão
                            carga: 'N/A', // Valor padrão
                            peso: 0, // Padrão do app
                        });
                    } else {
                        console.warn(`     ❌ Exercício "${trimmedName}" não encontrado no banco de dados e será ignorado.`);
                    }
                }

                if (exerciciosParaFirestore.length > 0) {
                    // 5. Criar o documento do Treino na coleção raiz 'treinosModelos'
                    const intervaloSeg = parseInt(treinoData.Intervalo, 10) || 60;
                    const treinoDocRef = await db.collection('treinosModelos').add({
                        nome: treinoData.Nome,
                        diasSemana: diasSemana,
                        intervalo: {
                            min: Math.floor(intervaloSeg / 60),
                            seg: intervaloSeg % 60
                        },
                        exercicios: exerciciosParaFirestore,
                    });
                    treinoIds.push(treinoDocRef.id);
                    console.log(`     ✅ Treino Modelo "${treinoData.Nome}" criado com ID: ${treinoDocRef.id}.`);
                } else {
                    console.log(`     ℹ️ Treino "${treinoData.Nome}" não continha exercícios válidos e não foi adicionado.`);
                }
            }

            // 6. Atualizar a ficha modelo com os IDs dos treinos
            await fichaDocRef.update({ treinos: treinoIds });
            console.log(`  -> ✅ Ficha atualizada com ${treinoIds.length} referência(s) de treino.`);
        }
        console.log('\n🎉 Processo de upload de fichas finalizado com sucesso!');
    } catch (error) {
        console.error('❌ Ocorreu um erro durante a execução do script:', error);
    }
}

uploadFichas();