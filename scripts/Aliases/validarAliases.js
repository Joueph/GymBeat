const fs = require("fs");
const path = require("path");

const inputPath = path.resolve(__dirname, "aliases_update.json");

if (!fs.existsSync(inputPath)) {
    console.error("❌ aliases_update.json não encontrado");
    process.exit(1);
}

const updates = JSON.parse(
    fs.readFileSync(inputPath, "utf-8")
);

const errors = [];
const warnings = [];

updates.forEach((item, index) => {
    if (!item.id) {
        errors.push(`Registro ${index}: id ausente`);
    }

    if (!Array.isArray(item.aliases)) {
        errors.push(`Registro ${item.id}: aliases não é array`);
        return;
    }

    if (item.aliases.length === 0) {
        warnings.push(`Registro ${item.id}: aliases vazio`);
    }

    const invalid = item.aliases.filter(
        a => typeof a !== "string" || a.length < 3
    );

    if (invalid.length > 0) {
        warnings.push(
            `Registro ${item.id}: aliases inválidos -> ${invalid.join(", ")}`
        );
    }

    const unique = new Set(item.aliases);
    if (unique.size !== item.aliases.length) {
        warnings.push(`Registro ${item.id}: aliases duplicados`);
    }
});

console.log("✔ Validação concluída");
console.log(`Total registros: ${updates.length}`);
console.log(`⚠️ Avisos: ${warnings.length}`);
console.log(`❌ Erros: ${errors.length}`);

if (errors.length > 0) {
    console.log("\n❌ ERROS:");
    errors.forEach(e => console.log(" -", e));
    process.exit(1);
}

if (warnings.length > 0) {
    console.log("\n⚠️ AVISOS:");
    warnings.forEach(w => console.log(" -", w));
}
