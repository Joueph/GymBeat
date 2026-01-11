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

(async () => {
    let ok = 0;
    let missing = 0;

    for (const item of updates) {
        const ref = db.collection("exerciciosModelos").doc(item.id);
        const snap = await ref.get();

        if (!snap.exists) {
            console.log(`❌ NÃO EXISTE: ${item.id}`);
            missing++;
            continue;
        }

        console.log(`✔ OK: ${item.id} → ${item.aliases.length} aliases`);
        ok++;
    }

    console.log("\nResumo:");
    console.log(`✔ Válidos: ${ok}`);
    console.log(`❌ Ausentes: ${missing}`);
})();
