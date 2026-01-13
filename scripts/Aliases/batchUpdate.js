const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

admin.initializeApp({
    credential: admin.credential.cert(
        require("./gymbeat-4c3ff-firebase-adminsdk-fbsvc-0974968e23.json")
    ),
});

const db = admin.firestore();

const updates = JSON.parse(
    fs.readFileSync(
        path.resolve(__dirname, "aliases_update.json"),
        "utf-8"
    )
);

const BATCH_SIZE = 400;

(async () => {
    let batch = db.batch();
    let counter = 0;
    let total = 0;

    for (const item of updates) {
        const ref = db.collection("exerciciosModelos").doc(item.id);

        const snap = await ref.get();
        if (!snap.exists) {
            console.log(`❌ Ignorado (não existe): ${item.id}`);
            continue;
        }

        const existing = snap.data().aliases || [];
        const merged = Array.from(
            new Set([...existing, ...item.aliases])
        );

        batch.update(ref, { aliases: merged });
        counter++;
        total++;

        if (counter === BATCH_SIZE) {
            await batch.commit();
            console.log(`✔ Batch commitado (${total})`);
            batch = db.batch();
            counter = 0;
        }
    }

    if (counter > 0) {
        await batch.commit();
        console.log(`✔ Batch final commitado (${total})`);
    }

    console.log(`🚀 Update concluído: ${total} documentos`);
})();
