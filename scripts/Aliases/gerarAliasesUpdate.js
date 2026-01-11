const fs = require("fs");
const path = require("path");

/* ========= NORMALIZAÇÃO ========= */

function normalize(text = "") {
    return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9 ]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

const PREPOSICOES = [
    "com", "de", "da", "do", "das", "dos", "em", "na", "no", "para"
];

const PT_EN = [
    ["levantamento terra", "deadlift"],
    ["supino inclinado", "incline bench press"],
    ["supino reto", "bench press"],
    ["supino", "bench press"],
    ["agachamento", "squat"],
    ["rosca", "curl"],
    ["extensao", "extension"],
    ["flexao", "push up"],
    ["puxada", "lat pulldown"],
    ["remada", "row"],
    ["desenvolvimento", "shoulder press"],
    ["barra", "barbell"],
    ["halteres", "dumbbells"],
    ["halter", "dumbbell"],
    ["maquina", "machine"],
    ["cabo", "cable"],
    ["smith", "smith machine"],
    ["triceps", "triceps"],
    ["biceps", "biceps"],
    ["peito", "chest"],
    ["costas", "back"],
    ["ombro", "shoulder"],
    ["perna", "leg"]
];

function gerarAliases(nome) {
    if (!nome) return [];

    const aliases = new Set();
    const base = normalize(nome);
    const palavras = base.split(" ");

    aliases.add(base);
    aliases.add(
        palavras.filter(p => !PREPOSICOES.includes(p)).join(" ")
    );
    aliases.add(palavras[0]);

    if (palavras.length >= 3) {
        aliases.add(palavras.slice(0, 2).join(" "));
    }

    let ingles = base;
    for (const [pt, en] of PT_EN) {
        ingles = ingles.replace(
            new RegExp(`\\b${pt}\\b`, "g"),
            en
        );
    }

    if (ingles !== base) {
        aliases.add(ingles);
        const enWords = ingles.split(" ");
        aliases.add(enWords[0]);
        if (enWords.length >= 2) {
            aliases.add(enWords.slice(0, 2).join(" "));
        }
    }

    return [...aliases].filter(a => a.length >= 3);
}

/* ========= EXECUÇÃO ========= */

const inputPath = path.resolve(
    __dirname,
    "exerciciosModelos.json"
);

const outputPath = path.resolve(
    __dirname,
    "aliases_update.json"
);

const exercicios = JSON.parse(
    fs.readFileSync(inputPath, "utf-8")
);

const updates = exercicios.map(ex => ({
    id: ex.id,
    aliases: gerarAliases(ex.nome)
}));

fs.writeFileSync(
    outputPath,
    JSON.stringify(updates, null, 2),
    "utf-8"
);

console.log(`✔ ${updates.length} registros preparados`);
console.log(`📄 Arquivo: ${outputPath}`);
