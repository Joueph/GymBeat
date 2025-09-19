const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// --- INICIALIZAÇÃO DO FIREBASE ---
// Substitua pelo caminho para o seu arquivo de chave de conta de serviço
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  // Substitua pelo seu storageBucket do firebaseConfig.ts
  storageBucket: "gs://gymbeat-4c3ff.firebasestorage.app" 
});

const db = admin.firestore();
const bucket = admin.storage().bucket();
const exerciciosCollection = db.collection('exerciciosModelos');

// --- CAMINHO PARA A PASTA PRINCIPAL ---
// Coloque o caminho para a pasta que contém os grupos musculares (ex: 'Costas', 'Peito')
const baseFolderPath = path.join(__dirname, 'Imagens em MP4'); // Adapte o nome da pasta se necessário

async function uploadExercicios() {
  if (!fs.existsSync(baseFolderPath)) {
    console.error(`❌ ERRO: A pasta principal não foi encontrada em: ${baseFolderPath}`);
    return;
  }

  try {
    const muscleGroupFolders = fs.readdirSync(baseFolderPath, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

    if (muscleGroupFolders.length === 0) {
        console.error(`❌ ERRO: Nenhuma subpasta de grupo muscular foi encontrada dentro de "${path.basename(baseFolderPath)}".`);
        return;
    }

    console.log(`✅ Grupos musculares encontrados: ${muscleGroupFolders.join(', ')}`);

    for (const groupFolder of muscleGroupFolders) {
      const groupFolderPath = path.join(baseFolderPath, groupFolder);
      const files = fs.readdirSync(groupFolderPath);
      let filesProcessed = 0;

      for (const file of files) {
        const fileExtension = path.extname(file).toLowerCase();
        
        // Verifica se o arquivo é .webm OU .mp4
        if (fileExtension === '.webm' || fileExtension === '.mp4') {
          filesProcessed++;
          const filePath = path.join(groupFolderPath, file);
          const exerciseName = path.basename(file, fileExtension).replace(/L /g, '');
          const muscleGroup = groupFolder;

          console.log(`  -> Processando: "${exerciseName}" (${muscleGroup})`);
          
          // Define o tipo de conteúdo com base na extensão
          const contentType = fileExtension === '.webm' ? 'video/webm' : 'video/mp4';

          // 1. Upload do vídeo para o Firebase Storage
          const destination = `exercicios/${muscleGroup}/${file}`;
          await bucket.upload(filePath, {
            destination: destination,
            metadata: { contentType: contentType },
          });

          // 2. Obter a URL de download pública
          const fileRef = bucket.file(destination);
          const [url] = await fileRef.getSignedUrl({
              action: 'read',
              expires: '03-09-2491'
          });

          // 3. Adicionar o novo exercício ao Firestore
          await exerciciosCollection.add({
            nome: exerciseName,
            imagemUrl: url,
            grupoMuscular: muscleGroup,
            tipo: 'Academia'
          });

          console.log(`     ✅ Upload e registro concluídos para "${exerciseName}".`);
        }
      }
      if (filesProcessed === 0) {
        console.warn(`  ⚠️ AVISO: Nenhum arquivo .webm ou .mp4 encontrado na pasta "${groupFolder}".`);
      }
    }
    console.log('\n🎉 Processo finalizado!');
  } catch (error) {
    console.error('❌ Ocorreu um erro durante a execução:', error);
  }
}

uploadExercicios();