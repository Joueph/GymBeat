const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

// Inicializa Firebase Admin
admin.initializeApp({
    credential: admin.credential.cert(
        require("./gymbeat-4c3ff-firebase-adminsdk-fbsvc-0974968e23.json")
    ),
});

const db = admin.firestore();

async function exportExercicios() {
    const snapshot = await db
        .collection("exerciciosModelos")
        .get();

    const exercicios = [];

    snapshot.forEach(doc => {
        exercicios.push({
            id: doc.id,
            ...doc.data(), // 🔥 exatamente como está no Firestore
        });
    });

    const outputPath = path.resolve(
        __dirname,
        "exerciciosModelos.json"
    );

    fs.writeFileSync(
        outputPath,
        JSON.stringify(exercicios, null, 2),
        "utf-8"
    );

    console.log(
        `✔ ${exercicios.length} documentos exportados`
    );
    console.log(`📄 Arquivo: ${outputPath}`);
}

exportExercicios().catch(err => {
    console.error("❌ Erro ao exportar:", err);
});
