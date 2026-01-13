const fs = require("fs");
const path = require("path");

function normalize(text = "") {
    return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9 ]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

const PREPOSICOES = ["com", "de", "da", "do", "das", "dos", "em", "na", "no"];

const PT_EN = {
    "supino": "bench press",
    "agachamento": "squat",
    "levantamento terra": "deadlift",
    "rosca": "curl",
    "extensao": "extension",
    "flexao": "push up",
    "puxada": "lat pulldown",
    "remada": "row",
    "desenvolvimento": "shoulder press",

    "barra": "barbell",
    "halter": "dumbbell",
    "halteres": "dumbbells",
    "maquina": "machine",
    "cabo": "cable",
    "smith": "smith machine",

    "triceps": "triceps",
    "biceps": "biceps",
    "peito": "chest",
    "costas": "back",
    "ombro": "shoulder",
    "perna": "leg"
};

function gerarAliases(nome) {
    const base = normalize(nome);
    const palavras = base.split(" ");

    const aliases = new Set();

    // Português
    aliases.add(base);

    aliases.add(
        palavras.filter(p => !PREPOSICOES.includes(p)).join(" ")
    );

    // Inglês (substituição por dicionário)
    let ingles = base;
    Object.entries(PT_EN).forEach(([pt, en]) => {
        ingles = ingles.replace(new RegExp(`\\b${pt}\\b`, "g"), en);
    });

    if (ingles !== base) {
        aliases.add(ingles);
        aliases.add(
            ingles
                .split(" ")
                .slice(0, 2)
                .join(" ")
        );
    }

    // versão curta
    if (palavras.length > 1) {
        aliases.add(palavras[0]);
    }

    return [...aliases].filter(a => a.length > 2);
}

// ---- execução ----

const inputPath = path.resolve(__dirname, "exerciciosModelos.json");
const outputPath = path.resolve(
    __dirname,
    "exerciciosModelos_com_aliases.json"
);

const exercicios = JSON.parse(
    fs.readFileSync(inputPath, "utf-8")
);

const processados = exercicios.map(ex => ({
    ...ex, // 🔒 estrutura intacta
    aliases: gerarAliases(ex.nome)
}));

fs.writeFileSync(
    outputPath,
    JSON.stringify(processados, null, 2),
    "utf-8"
);

console.log(`✔ Aliases (PT + EN) gerados para ${processados.length} exercícios`);
