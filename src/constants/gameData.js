export const MASTER_DISCORD_ID = "501767960646647818";
export const RANKS = ["E - Recruta", "D - Soldado", "C - Veterano", "B - Tenente", "A - Sargento", "S - Capitão"];

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
  "Tamayo": "+100% **Inteligência** ao produzir misturas (exceto Inibidores).\nCaso contrário: +10% **Inteligência**",
  "Lireou": "+20% **Carisma**",
  "Kuwajima": "Imunidade à <⚡️ Eletrificação>",
  "Kazan": "Imunidade à **qualquer temperatura**",
  "Akiko": "Treinamentos garantem +15% **Pontos de Status** extras",
  "Tomioka": "+15% **Precisão** se a Respiração for {Fluxo}",
  
  // Raros
  "Shinomiya": "+100% **Inteligência** ao produzir Inibidores.\nCaso contrário: +15% **Agilidade**",
  "Kochou": "+15% **Agilidade** se a Respiração for {Natural}.\nChance de envenenar com lâminas envenenadas é **100%**.\nImunidade a **Venenos**",
  "Shinazugawa (Sanemi)": "+20% **Força**\n+10% **Agilidade** se a Respiração for {Natural}\n**100%** de chance de receber a anomalia [⭐🩸 Marechi]",
  "Uzui": "Permite **omitir efeitos sonoros** fora de combate\nImunidade a **Venenos**",
  "Agatsuma": "+20% **Agilidade**\n+10% **Força** se a Respiração for {Energia}\nAnomalia [⚡ Despertar] torna-se [⚡💤 Despertar Agatsuma]",
  "Hashibira": "+25% **Força** se a Respiração for {Brutal}\nTentativas de causar <🩸 Sangramento>, ao invés disso, causam <🩸🔺 Sangramento Intenso>",
  "Urokodaki": "+20% **Precisão** se a Respiração for {Fluxo}.\nAtaques físicos de Respirações {Fluxo} causam <🩸 Sangramento>",
  "Tsuyuri": "Ao adquirir: Role 1d10 (8+) para receber [👁‍🗨 Olho Superior].\n+15% **Precisão**",
  "Iguro": "+25% **Precisão** se a Respiração for {Fluxo} ou {Natural}.\n+15% **Inteligência**",

  // Épicos
  "Soyama": "+15% **Força** e **Agilidade**.\nPermite re-rolar dados de desvio (1x) se lutando desarmado",
  "Rengoku": "+15% **Dano Total** contra alvos com <🔥 Queimando>.\n+15% **Precisão** se a Respiração for {Incandescente}.\n+8% em **todos os outros Status**",
  "Kanroji": "+25% **Força**, +10% **Carisma**, -15% **Inteligência**",
  "Uzui (Tengen)": "+10% **Agilidade** se a Respiração for {Mecânica}\nOmitir sons próprios e tornar-se <✴️ Indetectável> nas sombras\n+20% **Força**\nImunidade a **Venenos**",
  "Tokito": "Torna-se <✴️ Indetectável> usando Respirações: {Brisa}, {Vento} ou {Névoa}\n+20% **Ganho de Pontos Status**",
  "Kamado": "+15% **Força** se a Respiração for **💥 Hinokami Kagura**.\nPermite aprender a **💥 Hinokami Kagura**",
  "Lireou (Douma)": "+50% **Dano Total** contra alvos com <🧊 Congelado>.\n+25% **Dano Total** contra alvos com <❄️ Resfriamento>.\n+15% **Carisma**",

  // Lendários
  "Shinazugawa (Genya)": "+25% **Dano com Escopetas**.\nGarante a anomalia [🩸🍽️ Devorador de Onis]",
  "Himejima": "Ao adquirir: Role 1d10 (5-) para receber a anomalia [🕶️ Cego].\n+30% **Força** se a Respiração for {Impacto}.\n+30% **Resistência**",
  "Kamado (Tanjiro)": "+25% **Precisão**, +15% **Agilidade** se a Respiração for {Fluxo}\n+25% **Força**, +15% **Resistência** se a Respiração for {Incandescente}\n+10% em **todos os Status** e +10% **Ganho de Pontos de Status**",
  "Tsugikuni": "+20% **Resistência e Agilidade** se a Respiração for {Celeste}\n+25% **Força e Resistência** se a Respiração for {Incandescente}\n+15% em **Todos os Status**"
};

export const RESPIRACOES = ["Nenhuma", "Água", "Chama", "Trovão", "Fera", "Inseto", "Sol", "Lua", "Névoa"];
export const CORES = ["Nenhuma", "Vermelha", "Azul", "Amarela", "Verde", "Cinza", "Preta", "Rosa", "Índigo", "Roxa"];
export const ANOMALIAS_LIST = ["Fúria Total", "Carateca", "Vampirismo", "Deus do Sol", "Marca do Caçador", "Mundo Transparente"];
export const CLASSES_LIST = ["Civil", "Aprendiz", "Caçador de Onis", "Tsuguko", "Hashira", "Exterminador"];
export const SKILLS_LIST = ["Olfacto Aguçado", "Audição Aguçada", "Visão Aguçada", "Tato Aguçado", "Paladar Aguçado", "Resistência à Venenos", "Flexibilidade Extrema", "Mestre em Esgrima"];

export const RARITY_CONFIG = {
  "Comum": { color: "text-gray-400" },
  "Raro": { color: "text-blue-400" },
  "Épico": { color: "text-purple-400" },
  "Lendário": { color: "text-orange-400" }
};

export const WEAPON_CATEGORIES = ["Arma de Fogo", "Arma Branca"];
export const WEAPON_SUBTYPES = {
  "Arma de Fogo": ["Sniper", "Pistola", "Revólver", "Escopeta / Metralhadora", "SMG (Submetralhadora)"],
  "Arma Branca": ["Faca / Adaga", "Katana (Espada Leve)", "Machado Leve", "Espada Pesada / Machado Pesado", "Martelo Pesado / Marreta", "Soco / Improviso (Tacos/Tábuas)"]
};
export const HANDS_OPTIONS = ["Uma Mão", "Duas Mãos"];
export const TIERS = [0, 1, 2, 3, 4];
export const DAMAGE_TYPES = ["Corte", "Impacto"];

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
  "eletrification": {
    name: "Eletrificação",
    emoji: "⚡",
    description: "Ao atingir 40% do HP ou menos, torna-se Eletrificação Avançada por 2 turnos. Reduz a vida em 5% por turno.",
    modifiers: { hpReductionTurn: 0.05, triggerAdvancedEletrification: 0.40 }
  },
  "advanced-eletrification": {
    name: "Eletrificação Avançada",
    emoji: "⚡🔺",
    description: "Todo desvio falho ou acerto sucedido reduz a vida em 10%. Reduz a vida em 10% por turno.",
    modifiers: { hpReductionTurn: 0.10, eventLifeReduction: 0.10 }
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
  "eletrification": "eletrification",
  "eletrificacao": "eletrification",
  "eletricidade": "eletrification",
  "choque": "eletrification",
  "shock": "eletrification",
  "advanced-eletrification": "advanced-eletrification",
  "eletrificacao-avancada": "advanced-eletrification"
};
