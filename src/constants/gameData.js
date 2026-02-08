export const MASTER_DISCORD_ID = "501767960646647818";
export const RANKS = ["E - Recruta", "D - Soldado", "C - Veterano", "B - Tenente", "A - Sargento", "S - Capitão"];
export const LINHAGENS = ["Nenhuma", "Kamado", "Agatsuma", "Hashibira", "Tsugikuni", "Rengoku"];
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
export const TIERS = ["T0", "T1", "T2", "T3", "T4"];
export const DAMAGE_TYPES = ["Corte", "Impacto"];

export const formatHeight = (val) => {
  const digits = val.replace(/\D/g, '');
  if (!digits) return "";
  if (digits.length <= 1) return digits;
  if (digits.length === 2) return `${digits[0]},${digits[1]}`;
  return `${digits[0]},${digits.slice(1, 3)}m`;
};