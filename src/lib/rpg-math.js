export function calculateDisarmedPAT(char) {
  if (!char) return 0;
  const strength = Number(char.strength) || 0;
  const resistance = Number(char.resistance) || 0;
  // Soco / Improviso Formula: (1.0 * Força + 0.35 * Resistência) * 4
  return ((1.0 * strength + 0.35 * resistance) * 4).toFixed(1);
}

export function calculateDerivedStats(char) {
  // Presence: Sum of physical stats
  const presence = (Number(char.strength) || 0) + (Number(char.resistance) || 0) + (Number(char.aptitude) || 0) + (Number(char.agility) || 0) + (Number(char.precision) || 0);
  
  // Posture: (Resistance * 0.25) + Aptitude
  const posture = ((Number(char.resistance) || 0) * 0.25) + (Number(char.aptitude) || 0);
  
  // Life: (Strength + Resistance) * 4
  const life = (Number(char.strength) || 0) + ((Number(char.resistance) || 0) * 4);

  // Percentage stats (Cap at 100%)
  const calcPerc = (val) => presence > 0 ? Math.min((val / presence) * 100, 100).toFixed(1) : "0.0";

  return {
    presence,
    posture,
    life,
    intelligencePerc: calcPerc(char.intelligence),
    charismaPerc: calcPerc(char.charisma),
    luckPerc: calcPerc(char.luck)
  };
}

export function calculateWeaponPAT(weapon, char) {
  if (!weapon || !char) return 0;
  
  const strength = Number(char.strength) || 0;
  const precision = Number(char.precision) || 0;
  const agility = Number(char.agility) || 0;
  const resistance = Number(char.resistance) || 0;

  let base = 0;

  // EASY TO MODIFY FORMULAS
  const formulas = {
    // 🔫 Armas de Fogo
    'Sniper': (s, p, a, r) => (0.4 * s) + (2.4 * p),
    'Pistola': (s, p, a, r) => (0.6 * s) + (1.4 * p),
    'Revólver': (s, p, a, r) => (1.0 * s) + (1.6 * p),
    'Escopeta / Metralhadora': (s, p, a, r) => (1.2 * s) + (1.2 * p),
    'SMG (Submetralhadora)': (s, p, a, r) => (0.5 * s) + (1.1 * p) + (0.8 * a),

    // ⚔️ Armas Brancas e Impacto
    'Faca / Adaga': (s, p, a, r) => (0.4 * s) + (1.2 * p) + (1.0 * a),
    'Katana (Espada Leve)': (s, p, a, r) => (1.2 * s) + (1.2 * p),
    'Machado Leve': (s, p, a, r) => (1.5 * s) + (0.7 * p),
    'Espada Pesada / Machado Pesado': (s, p, a, r) => (2.2 * s) + (0.4 * r),
    'Martelo Pesado / Marreta': (s, p, a, r) => (2.0 * s) + (1.0 * r),
    'Soco / Improviso (Tacos/Tábuas)': (s, p, a, r) => (1.0 * s) + (0.35 * r)
  };

  const formula = formulas[weapon.subtype];
  base = formula ? formula(strength, precision, agility, resistance) : (1.0 * strength);

  // Multiply by 4 as per instruction: ((Atributos) * 4)
  base = base * 4;

  // TIER MULTIPLIERS: T0(0.8x), T1(1.0x), T2(1.2x), T3(1.5x), T4(2.0x)
  const tierMults = { 'T0': 0.8, 'T1': 1.0, 'T2': 1.2, 'T3': 1.5, 'T4': 2.0 };
  const tierMult = tierMults[weapon.tier] || 1.0;

  // UPGRADE CALC: 'linear +10%' + 'exponential +5%'
  // We assume level 1 is +1, level 2 is +2 etc.
  const upgradeLvl = Number(weapon.upgrade) || 0;
  let upgradeMult = 1.0;
  if (upgradeLvl > 0) {
    const linear = 1 + (upgradeLvl * 0.10);
    const exponential = Math.pow(1.05, upgradeLvl);
    upgradeMult = linear * exponential;
  }

  // BLOODLINE MULTIPLIER (Placeholder for now, can be expanded if gameData provides it)
  const bloodlineMult = 1.0;

  return (base * tierMult * upgradeMult * bloodlineMult).toFixed(1);
}
