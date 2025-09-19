const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// --- CONFIGURAÇÃO ---
// 1. Coloque o caminho para o seu arquivo de chave de conta de serviço
const serviceAccount = require('./serviceAccountKey.json');
// 2. Coloque o caminho para a pasta que contém os arquivos JSON das fichas
const fichasJsonPath = path.join(__dirname, 'fichas_modelos'); // Pasta para colocar os JSONs

// --- INICIALIZAÇÃO DO FIREBASE ---
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// Mapeamento dos dias da semana do JSON para o formato do app ('seg', 'ter', etc.)
const dayMapping = {
    'segunda': 'seg',
    'terça': 'ter',
    'quarta': 'qua',
    'quinta': 'qui',
    'sexta': 'sex',
    'sábado': 'sab',
    'domingo': 'dom',
};

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
        const normalizedName = doc.data().nome.trim();
        exerciciosModelosMap.set(normalizedName, { id: doc.id, ...doc.data() });
    });
    console.log(`✅ ${exerciciosModelosMap.size} exercícios modelo carregados na memória.`);
    return exerciciosModelosMap;
}

/**
 * Processa e faz o upload de fichas de treino a partir de arquivos JSON.
 */
async function uploadFichas() {
    if (!fs.existsSync(fichasJsonPath)) {
        console.error(`❌ ERRO: A pasta de fichas JSON não foi encontrada em: ${fichasJsonPath}`);
        console.log('Crie a pasta e coloque seus arquivos .json de ficha de treino dentro dela.');
        return;
    }

    // Pré-carrega todos os exercícios para evitar múltiplas queries
    const exerciciosModelosMap = await fetchAllExerciciosModelos();

    try {
        const jsonFiles = fs.readdirSync(fichasJsonPath).filter(file => path.extname(file).toLowerCase() === '.json');

        if (jsonFiles.length === 0) {
            console.warn(`⚠️ AVISO: Nenhum arquivo .json encontrado na pasta "${fichasJsonPath}".`);
            return;
        }

        console.log(`\nIniciando processamento de ${jsonFiles.length} arquivo(s) JSON...`);

        for (const jsonFile of jsonFiles) {
            const filePath = path.join(fichasJsonPath, jsonFile);
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            const fichaData = JSON.parse(fileContent);

            const fichaKey = Object.keys(fichaData)[0];
            const fichaContent = fichaData[fichaKey];
            
            console.log(`\n--- Processando Ficha: "${fichaKey}" ---`);

            // 1. Criar o documento da Ficha Modelo com seus metadados
            const fichaMetadata = {
                nome: fichaContent.nome || fichaKey.replace(/_/g, ' '), // Usa o nome do JSON ou a chave do arquivo
                nivel: fichaContent.nivel || 'N/A',
                sexo: fichaContent.sexo || 'N/A',
                dificuldade: fichaContent.dificuldade || 'N/A',
                tipo_plano: fichaContent.tipo_plano || 'free',
                tempo_ficha: fichaContent.tempo_ficha || 'N/A',
            };

            const fichaDocRef = await db.collection('fichasModelos').add(fichaMetadata);
            console.log(`✅ Ficha "${fichaMetadata.nome}" criada com ID: ${fichaDocRef.id}`);

            // 2. Iterar sobre os treinos (ex: "Treino AB", "Treino AB2")
            const treinoKeys = Object.keys(fichaContent).filter(k => typeof fichaContent[k] === 'object' && !['nivel', 'sexo', 'dificuldade', 'tipo_plano', 'tempo_ficha'].includes(k));

            for (const treinoKey of treinoKeys) {
                const treinoContent = fichaContent[treinoKey];

                // 3. Iterar sobre os dias (ex: "segunda", "quarta")
                // Cada dia será um documento de 'treino' separado na subcoleção da ficha
                for (const diaKey of Object.keys(treinoContent)) {
                    const mappedDay = dayMapping[diaKey.toLowerCase()];
                    if (!mappedDay) {
                        console.warn(`  ⚠️ Dia "${diaKey}" ignorado (mapeamento não encontrado).`);
                        continue;
                    }

                    const treinoNome = `${treinoKey} (${diaKey})`;
                    console.log(`  -> Preparando Treino: "${treinoNome}"`);

                    const exerciciosDoDia = treinoContent[diaKey];
                    const exerciciosParaFirestore = [];

                    // 4. Processar cada exercício daquele dia
                    for (const exercicioJson of exerciciosDoDia) {
                        const nomeExercicio = exercicioJson['EXERCÍCIO'].trim();
                        const modelo = exerciciosModelosMap.get(nomeExercicio);

                        if (modelo) {
                            exerciciosParaFirestore.push({
                                modelo: modelo,
                                modeloId: modelo.id,
                                series: parseInt(exercicioJson['SÉRIES'], 10) || 3,
                                repeticoes: exercicioJson['REPETIÇÕES'] || '10-12',
                                carga: exercicioJson['CARGA'] || 'N/A', // Preserva o campo 'CARGA' do JSON
                                peso: 0, // Padrão do app
                            });
                        } else {
                            console.warn(`     ❌ Exercício "${nomeExercicio}" não encontrado no banco de dados e será ignorado.`);
                        }
                    }

                    if (exerciciosParaFirestore.length > 0) {
                        // 5. Criar o documento do Treino na subcoleção da Ficha
                        await fichaDocRef.collection('treinos').add({
                            nome: treinoNome,
                            diasSemana: [mappedDay],
                            intervalo: { min: 1, seg: 30 }, // Intervalo padrão
                            exercicios: exerciciosParaFirestore,
                        });
                        console.log(`     ✅ Treino "${treinoNome}" com ${exerciciosParaFirestore.length} exercícios adicionado à ficha.`);
                    }
                }
            }
        }
        console.log('\n🎉 Processo de upload de fichas finalizado com sucesso!');
    } catch (error) {
        console.error('❌ Ocorreu um erro durante a execução do script:', error);
    }
}

uploadFichas();