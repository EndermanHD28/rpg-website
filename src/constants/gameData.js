import { tempestade } from './breathing_styles/tempestade';

export const MASTER_DISCORD_ID = "501767960646647818";
export const RANKS = ["E - Recruta", "D - Soldado", "C - Veterano", "B - Tenente", "A - Sargento", "S - Capitão"];

export const STAT_LABELS = {
  strength: 'Força',
  resistance: 'Resistência',
  aptitude: 'Aptidão',
  agility: 'Agilidade',
  precision: 'Precisão',
  concentration: 'Concentração',
  intelligence: 'Inteligência',
  luck: 'Sorte',
  charisma: 'Carisma'
};

export const LINHAGENS_RARITIES = {
  "Mitoka": "Comum", "Tamayo": "Comum", "Lireou": "Comum", "Kuwajima": "Comum", "Kazan": "Comum", "Akiko": "Comum", "Tomioka": "Comum",
  "Shinomiya": "Raro", "Kochou": "Raro", "Shinazugawa (Sanemi)": "Raro", "Uzui": "Raro", "Agatsuma": "Raro", "Hashibira": "Raro", "Urokodaki": "Raro", "Tsuyuri": "Raro", "Iguro": "Raro",
  "Soyama": "Épico", "Rengoku": "Épico", "Kanroji": "Épico", "Uzui (Tengen)": "Épico", "Tokito": "Épico", "Kamado": "Épico", "Lireou (Douma)": "Épico",
  "Shinazugawa (Genya)": "Lendário", "Himejima": "Lendário", "Kamado (Tanjiro)": "Lendário", "Tsugikuni": "Lendário"
};

export const SLOT_MACHINE_RARITY_PERCENTAGES = {
  "Comum": 60,
  "Raro": 25,
  "Épico": 12,
  "Lendário": 3
};

export const LINHAGENS = [
  "Nenhuma", 
  "Mitoka", "Tamayo", "Lireou", "Kuwajima", "Kazan", "Akiko", "Tomioka",
  "Shinomiya", "Kochou", "Shinazugawa (Sanemi)", "Uzui", "Agatsuma", "Hashibira", "Urokodaki", "Tsuyuri", "Iguro",
  "Soyama", "Rengoku", "Kanroji", "Uzui (Tengen)", "Tokito", "Kamado", "Lireou (Douma)",
  "Shinazugawa (Genya)", "Himejima", "Kamado (Tanjiro)", "Tsugikuni"
];

export const LINHAGEM_DESCRIPTIONS = {
  "Nenhuma": "Sem linhagem definida.",
  // Comuns
  "Mitoka": "+10% **Precisão**",
  "Tamayo": "+90% **Inteligência** ao produzir misturas (exceto Inibidores).\n+10% **Inteligência**",
  "Lireou": "+20% **Carisma**",
  "Kuwajima": "Imunidade à <⚡️ Eletrificação>",
  "Kazan": "Imunidade à **qualquer temperatura**",
  "Akiko": "Treinamentos garantem +15% **Pontos de Status** extras",
  "Tomioka": "+15% **Precisão** se a Respiração for {Fluxo}",
  "Concentração": "+10% **Resistência**",
  
  // Raros
  "Shinomiya": "+100% **Inteligência** ao produzir Inibidores.\n+15% **Agilidade**",
  "Kochou": "+15% **Agilidade** se a Respiração for {Natural}.\nChance de envenenar com lâminas envenenadas é **100%**.\nImunidade a **Venenos**",
  "Shinazugawa (Sanemi)": "+20% **Força**|+10% **Agilidade** se a Respiração for {Natural}\n**100%** de chance de receber a anomalia [⭐🩸 Marechi]",
  "Uzui": "Permite **omitir efeitos sonoros** fora de combate\nImunidade a **Venenos**",
  "Agatsuma": "+15% **Agilidade**|+10% **Força** se a Respiração for {Energia}\n+15% **Agilidade**\nAnomalia [⚡ Despertar] torna-se [⚡💤 Despertar Agatsuma]",
  "Hashibira": "+25% **Força** se a Respiração for {Brutal}\nTentativas de causar <🩸 Sangramento>, ao invés disso, causam <🩸🔺 Sangramento Intenso>",
  "Urokodaki": "+20% **Precisão** se a Respiração for {Fluxo}.\nAtaques físicos de Respirações {Fluxo} causam <🩸 Sangramento>",
  "Tsuyuri": "Ao adquirir: Role 1d10 (8+) para receber [👁‍🗨 Olho Superior].\n+15% **Precisão**",
  "Iguro": "+25% **Precisão** se a Respiração for {Fluxo} ou {Natural}.\n+15% **Inteligência**",

  // Épicos
  "Soyama": "+15% **Força** e **Agilidade**.\nPermite re-rolar dados de desvio (1x) se lutando desarmado",
  "Rengoku": "+15% **Dano Total** contra alvos com <🔥 Queimando>.\n+15% **Precisão** se a Respiração for {Incandescente}.\n+8% em **todos os outros Status**",
  "Kanroji": "+25% **Força**, +15% **Resistência**, +10% **Carisma**, -15% **Inteligência**",
  "Uzui (Tengen)": "+10% **Agilidade** e +20% **Força** se a Respiração for {Mecânica}\nPermitir omitir sons próprios.\nImunidade a **Venenos**",
  "Tokito": "Torna-se <✴️ Indetectável> usando Respiração da Brisa, Vento ou Névoa\n+15% **Ganho de Pontos Status**",
  "Kamado": "+15% **Força** se a Respiração for **💥 Hinokami Kagura**.\nPermite aprender a **💥 Hinokami Kagura**",
  "Lireou (Douma)": "+50% **Dano Total** contra alvos com <🧊 Congelado>.\n+25% **Dano Total** contra alvos com <❄️ Resfriamento>.\n+15% **Carisma**",

  // Lendários
  "Shinazugawa (Genya)": "+25% **Dano com Escopetas**.\nGarante a anomalia [🩸🍽️ Devorador de Onis]",
  "Himejima": "Ao adquirir: Role 1d10 (5-) para receber a anomalia [🕶️ Cego].\n+30% **Força** se a Respiração for {Impacto}.\n+30% **Resistência**",
  "Kamado (Tanjiro)": "+25% **Precisão**, +15% **Agilidade** se a Respiração for {Fluxo}\n+25% **Força**, +15% **Resistência** se a Respiração for {Incandescente}\n+5% em **todos os Status** e +10% **Ganho de Pontos de Status**",
  "Tsugikuni": "+20% **Resistência e Agilidade** se a Respiração for {Celeste}\n+25% **Força e Resistência** se a Respiração for {Incandescente}\n+15% em **Todos os Status**"
};

export const LINHAGENS_DATA = {
  "Mitoka": {
    stat_boosts: [
      { stat: "precision", amount: 0.10 }
    ]
  },
  "Tamayo": {
    stat_boosts: [
      { stat: "intelligence", amount: 0.10 }
    ]
  },
  "Lireou": {
    stat_boosts: [
      { stat: "charisma", amount: 0.20 }
    ]
  },
  "Tomioka": {
    stat_boosts: [
      { stat: "precision", amount: 0.15, condition: { type: "breathing_keyword", value: "Fluxo" } }
    ]
  },
  "Shinomiya": {
    stat_boosts: [
      { stat: "agility", amount: 0.15 }
    ]
  },
  "Kochou": {
    stat_boosts: [
      { stat: "agility", amount: 0.15, condition: { type: "breathing_keyword", value: "Natural" } }
    ]
  },
  "Shinazugawa (Sanemi)": {
    stat_boosts: [
      { stat: "strength", amount: 0.20, condition: { type: "breathing_keyword", value: "Natural" } },
      { stat: "agility", amount: 0.10, condition: { type: "breathing_keyword", value: "Natural" } }
    ]
  },
  "Agatsuma": {
    stat_boosts: [
      { stat: "agility", amount: 0.15 },
      { stat: "agility", amount: 0.15, condition: { type: "breathing_keyword", value: "Energia" } },
      { stat: "strength", amount: 0.10, condition: { type: "breathing_keyword", value: "Energia" } }
    ]
  },
  "Hashibira": {
    stat_boosts: [
      { stat: "strength", amount: 0.25, condition: { type: "breathing_keyword", value: "Brutal" } }
    ]
  },
  "Urokodaki": {
    stat_boosts: [
      { stat: "precision", amount: 0.20, condition: { type: "breathing_keyword", value: "Fluxo" } }
    ]
  },
  "Tsuyuri": {
    stat_boosts: [
      { stat: "precision", amount: 0.15 }
    ]
  },
  "Iguro": {
    stat_boosts: [
      { stat: "precision", amount: 0.25, condition: { type: "breathing_keyword", value: "Fluxo" } },
      { stat: "precision", amount: 0.25, condition: { type: "breathing_keyword", value: "Natural" } },
      { stat: "intelligence", amount: 0.15 }
    ]
  },
  "Soyama": {
    stat_boosts: [
      { stat: "strength", amount: 0.15 },
      { stat: "agility", amount: 0.15 }
    ]
  },
  "Rengoku": {
    stat_boosts: [
      { stat: "precision", amount: 0.15, condition: { type: "breathing_keyword", value: "Incandescente" } },
      { stat: "all_other", amount: 0.08 }
    ]
  },
  "Kanroji": {
    stat_boosts: [
      { stat: "strength", amount: 0.25 },
      { stat: "resistance", amount: 0.15 },
      { stat: "charisma", amount: 0.10 },
      { stat: "intelligence", amount: -0.15 }
    ]
  },
  "Uzui (Tengen)": {
    stat_boosts: [
      { stat: "agility", amount: 0.10, condition: { type: "breathing_keyword", value: "Mecânica" } },
      { stat: "strength", amount: 0.20, condition: { type: "breathing_keyword", value: "Mecânica" } }
    ]
  },
  "Kamado": {
    stat_boosts: [
      { stat: "strength", amount: 0.15, condition: { type: "breathing_style", value: "💥 Hinokami Kagura" } }
    ]
  },
  "Lireou (Douma)": {
    stat_boosts: [
      { stat: "charisma", amount: 0.15 }
    ]
  },
  "Himejima": {
    stat_boosts: [
      { stat: "strength", amount: 0.30, condition: { type: "breathing_keyword", value: "Impacto" } },
      { stat: "resistance", amount: 0.30 }
    ]
  },
  "Kamado (Tanjiro)": {
    stat_boosts: [
      { stat: "precision", amount: 0.25, condition: { type: "breathing_keyword", value: "Fluxo" } },
      { stat: "agility", amount: 0.15, condition: { type: "breathing_keyword", value: "Fluxo" } },
      { stat: "strength", amount: 0.25, condition: { type: "breathing_keyword", value: "Incandescente" } },
      { stat: "resistance", amount: 0.15, condition: { type: "breathing_keyword", value: "Incandescente" } },
      { stat: "all", amount: 0.05 }
    ]
  },
  "Tsugikuni": {
    stat_boosts: [
      { stat: "resistance", amount: 0.20, condition: { type: "breathing_keyword", value: "Celeste" } },
      { stat: "agility", amount: 0.20, condition: { type: "breathing_keyword", value: "Celeste" } },
      { stat: "strength", amount: 0.25, condition: { type: "breathing_keyword", value: "Incandescente" } },
      { stat: "resistance", amount: 0.25, condition: { type: "breathing_keyword", value: "Incandescente" } },
      { stat: "all", amount: 0.15 }
    ]
  }
};

export const RESPIRACOES_DATA = {
  "Água": { keywords: ["Fluxo"] },
  "Chama": { keywords: ["Incandescente"] },
  "Trovão": { keywords: ["Energia"] },
  "Fera": { keywords: ["Brutal"] },
  "Inseto": { keywords: ["Natural"] },
  "Névoa": { keywords: ["Brisa"] },
  "Vento": { keywords: ["Natural"] },
  "Pedra": { keywords: ["Impacto"] },
  "Som": { keywords: ["Mecânica"] },
  "Lua": { keywords: ["Celeste"] },
  "Sol": { keywords: ["Incandescente"] },
  "Flor": { keywords: ["Natural"] },
  "Serpente": { keywords: ["Fluxo"] },
  "Amor": { keywords: ["Brutal"] },
  "Tempestade": { keywords: ["Natural", "Energia"] },
};

export const RESPIRACOES = ["Nenhuma", "Água", "Chama", "Trovão", "Fera", "Inseto", "Sol", "Lua", "Névoa", "Tempestade", "Vento", "Pedra", "Serpente", "Amor", "Som", "Flor"];

export const BREATHING_TREES = {
  "Tempestade": tempestade
};

export const CORES = ["Nenhuma", "Vermelha", "Azul", "Amarela", "Verde", "Cinza", "Preta", "Rosa", "Índigo", "Roxa"];
export const ANOMALIAS_LIST = [
  "Super Audição", "Super Olfato", "Olho Superior", "Visão Térmica", "Densidade Óssea", "Despertar",
  "Processamento Metódico", "Hiper-Foco", "Psicose de Combate", "Estado Altruísta", "Devorador de Onis", "Marechi"
];

export const ANOMALIAS_DESCRIPTIONS = {
  "Super Audição": "🔊 Permite detectar sons através de paredes em um raio curto.\nImunidade aos debuffs de <🕶️ Cegueira>",
  "Super Olfato": "🌫️ Detecta a presença de Onis a quilômetros.\nNo combate, aumenta a janela de Crítico para 18-20",
  "Olho Superior": "👁‍🗨 O usuário processa o movimento em câmera lenta.\nPermite realizar um Parry no dado de Desvio.\nSe usado juntamento com <👁‍🗨/🔍 Mundo Transparente>, garante uma anulação de dado de Desvio, Bloqueio ou Ataque do adversário por combate.\nAo ser ativado 3 vezes, a anomalia torna-se <🕶️ Cego>",
  "Visão Térmica": "🔍 Mutação que permite enxergar o calor corporal.\nEssencial para snipers em bunkers escuros ou florestas.\nIgnora furtividade inimiga simples",
  "Densidade Óssea": "🧬 Seu esqueleto é duro como aço.\nRecebe um bônus fixo de +20% de Resistência.",
  "Despertar": "⚡ Ao chegar em Condição Crítica (12% HP), regenere 20% da Vida Máxima.\nA postura torna-se Infinita e o próximo dado de Ataque será um crítico perfeito",
  "Processamento Metódico": "👓 Se você observar um inimigo agir por 2 turnos, você aprende o padrão dele.\nGanha +20% de chance de Desvio contra aquele inimigo específico pelo resto da luta",
  "Hiper-Foco": "🌪️ Você aprende rápido.\nGanha +20% de Pontos de Status (PS) ao final de cada missão",
  "Psicose de Combate": "🧨 Em batalha, você perde o medo.\nImunidade a efeitos de atordoamento, terror, ilusões e dor leve ~ média",
  "Estado Altruísta": "🌲 Você não emite a intenção de matar",
  "Devorador de Onis": "🩸/🍽️ Permite comer carne de Oni (1x por combate)\n1d100 (90+): Recebe Kekkijutsu enfraquecido temporariamente\n1d100 (50-89): Regenera 15% da Vida\n1d100 (01-49): Recebe <Nocauteado> por 1 turno",
  "Marechi": "⭐/🩸 Seu sangue é um banquete para Onis.\nInimigos focam em você, mas recebem <Atordoado> por 1 turno a primeira vez que te morderem"
};

export const CLASSES_LIST = ["Vanguarda", "Artista", "Atirador", "Assaltante", "Infiltrador"];
export const SKILLS_LIST = ["Computação", "Programação", "Eletrônica", "Mecânica", "Medicina", "Química"];

export const SKILLS_DESCRIPTIONS = {
  "Computação": "Sem descrição.",
  "Programação": "Sem descrição.",
  "Eletrônica": "Sem descrição.",
  "Mecânica": "Sem descrição.",
  "Medicina": "Sem descrição.",
  "Química": "Sem descrição.",
};

export const RARITY_CONFIG = {
  "Comum": { color: "text-gray-400" },
  "Raro": { color: "text-blue-400" },
  "Épico": { color: "text-purple-400" },
  "Lendário": { color: "text-orange-400" }
};

export const WEAPON_CATEGORIES = ["Arma de Fogo", "Arma Branca"];
export const WEAPON_SUBTYPES = {
  "Arma de Fogo": ["Rifle", "Pistola", "Revólver", "Escopeta", "Metralhadora", "Submetralhadora"],
  "Arma Branca": ["Lâmina Curta", "Arma de Impacto Leve", "Espada Leve", "Machado/Porrete Leve", "Espada/Machado Pesado", "Martelo Pesado", "Soco / Improviso"]
};
export const HANDS_OPTIONS = ["Uma Mão", "Duas Mãos"];
export const TIERS = [0, 1, 2, 3, 4];
export const DAMAGE_TYPES = ["Corte", "Impacto"];

export const AMMUNITION_TYPES = [
  { id: "ammo_rifle", name: "Munição de Rifle", weight: 0.05, description: "Munição de alta precisão e longo alcance para rifles." },
  { id: "ammo_pistola", name: "Munição de Pistola", weight: 0.015, description: "Munição padrão para pistolas semi-automáticas." },
  { id: "ammo_revolver", name: "Munição de Revólver", weight: 0.03, description: "Munição de alto calibre para revólveres." },
  { id: "ammo_escopeta", name: "Munição de Escopeta", weight: 0.03, description: "Cartuchos de fragmentação para espingardas e escopetas." },
  { id: "ammo_metralhadora", name: "Munição de Metralhadora", weight: 0.0075, description: "Munição em cinturão para armas automáticas pesadas." },
  { id: "ammo_submetralhadora", name: "Munição de Submetralhadora", weight: 0.005, description: "Munição compacta para submetralhadora de alta cadência." }
];

export const formatHeight = (val) => {
  const digits = val.replace(/\D/g, '');
  if (!digits) return "";
  if (digits.length <= 1) return digits;
  if (digits.length === 2) return `${digits[0]},${digits[1]}`;
  return `${digits[0]},${digits.slice(1, 3)}m`;
};

export const EFFECTS = {
  "cooling": {
    name: "Resfriamento",
    emoji: "❄️",
    description: "Reduz o dado de acerto e desvio em 12%. Reduz o dano causado em 15%.",
    modifiers: { acerto: 0.88, desvio: 0.88, dano: 0.85 }
  },
  "frozen": {
    name: "Congelado",
    emoji: "🧊",
    description: "Reduz o dado de desvio em 35%. Todo dado de acerto resultará em 1 (Desastre).",
    modifiers: { desvio: 0.65, forceAcertoDesastre: true }
  },
  "poisoning": {
    name: "Envenenamento",
    emoji: "🟢",
    description: "Reduz a vida máxima em 10%. Reduz a vida em 10% por turno.",
    modifiers: { maxLife: 0.90, hpReductionTurn: 0.10 }
  },
  "intense-poisoning": {
    name: "Envenenamento Intenso",
    emoji: "🟢🔺",
    description: "Reduz a vida máxima em 25%. Reduz a vida em 15% por turno.",
    modifiers: { maxLife: 0.75, hpReductionTurn: 0.15 }
  },
  "bleeding": {
    name: "Sangramento",
    emoji: "🩸",
    description: "Reduz a vida em 7% por turno. Aumenta o dano tomado em 10%.",
    modifiers: { hpReductionTurn: 0.07, damageTaken: 1.10 }
  },
  "intense-bleeding": {
    name: "Sangramento Intenso",
    emoji: "🩸🔺",
    description: "Reduz a vida em 15% por turno. Aumenta o dano tomado em 25%.",
    modifiers: { hpReductionTurn: 0.15, damageTaken: 1.25 }
  },
  "blindness": {
    name: "Cegueira",
    emoji: "🕶️",
    description: "15% chance do dado de desvio tornar-se 1 (Desastre). Reduz o dado de acerto em 35%.",
    modifiers: { acerto: 0.65, desvioDesastreChance: 0.15 }
  },
  "burning": {
    name: "Queimando",
    emoji: "🔥",
    description: "Reduz a vida em 10% por turno. Reduz a Precisão em 15%.",
    modifiers: { hpReductionTurn: 0.10, precision: 0.85 }
  },
  "electrification": {
    name: "Eletrificação",
    emoji: "⚡",
    description: "Ao atingir 40% do HP ou menos, torna-se Eletrificação Avançada por 2 turnos. Reduz a vida em 5% por turno.",
    modifiers: { hpReductionTurn: 0.05, triggerAdvancedelectrification: 0.40 }
  },
  "advanced-electrification": {
    name: "Eletrificação Avançada",
    emoji: "⚡🔺",
    description: "Todo desvio falho ou acerto sucedido reduz a vida em 10%. Reduz a vida em 10% por turno.",
    modifiers: { hpReductionTurn: 0.10 }
  },
  "stunned": {
    name: "Atordoado",
    emoji: "💤",
    description: "Todo ataque com o usuário como alvo é garantido. O usuário perde seu turno.",
    modifiers: { }
  },
  "fury": {
    name: "Fúria",
    emoji: "💢",
    description: "Reduz o Dado de Acerto e o Dado de Desvio em 15%. Aumenta o Dado Final em 25%. Reduz o Dado Tomado em 25%.",
    modifiers: { acerto: 0.85, desvio: 0.85, damage: 1.25, damageTaken: 0.75 }
  },
  "inspiration": {
    name: "Inspiração",
    emoji: "✨",
    description: "Aumenta o Dado de Acerto em 10%. Aumenta a Vida e a Vida Máxima em 15%. Aumenta o Foco Máximo em 15%. Aumenta o Foco em 25.",
    modifiers: { acerto: 1.1, maxLife: 1.15, hpRegen: 0.15, maxFocus: 1.15, fixedFocusRegen: 25 }
  }
};

export const EFFECT_ALIASES = {
  "poison": "poisoning",
  "poisoned": "poisoning",
  "envenenamento": "poisoning",
  "envenenado": "poisoning",
  "intense-poison": "intense-poisoning",
  "poison-intense": "intense-poisoning",
  "envenenamento-intenso": "intense-poisoning",
  "cooling": "cooling",
  "resfriamento": "cooling",
  "resfriado": "cooling",
  "cold": "cooling",
  "frozen": "frozen",
  "congelado": "frozen",
  "gelo": "frozen",
  "bleeding": "bleeding",
  "sangramento": "bleeding",
  "sangrando": "bleeding",
  "bleed": "bleeding",
  "intense-bleeding": "intense-bleeding",
  "sangramento-intenso": "intense-bleeding",
  "blindness": "blindness",
  "cegueira": "blindness",
  "cego": "blindness",
  "blind": "blindness",
  "burning": "burning",
  "queimando": "burning",
  "queimadura": "burning",
  "fogo": "burning",
  "fire": "burning",
  "electrification": "electrification",
  "eletrificacao": "electrification",
  "eletricidade": "electrification",
  "choque": "electrification",
  "shock": "electrification",
  "advanced-electrification": "advanced-electrification",
  "eletrificacao-avancada": "advanced-electrification"
};
