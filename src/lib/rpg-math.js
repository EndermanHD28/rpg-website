import { LINHAGENS_DATA, RESPIRACOES_DATA } from '../constants/gameData';

const GLOBAL_PAT_MULTIPLIER = 0.6;

export function getStatBuffs(char, statName) {
  if (!char) return [];
  const buffs = [];

  // 1. Lineage Buffs
  // In the DB/state it's called 'bloodline', but the user prompt called it 'lineage'.
  // Looking at BioGrid.js: field="bloodline"
  const lineageName = char.bloodline || char.lineage;
  const lineageData = LINHAGENS_DATA[lineageName];
  if (lineageData && lineageData.stat_boosts) {
    lineageData.stat_boosts.forEach(boost => {
      let applies = false;
      // Normalized stat names for comparison
      const targetStat = statName.toLowerCase();
      const boostStat = boost.stat.toLowerCase();

      if (boostStat === targetStat || boostStat === 'all' || (boostStat === 'all_other' && targetStat !== 'precision')) {
        applies = true;
      }

      if (applies && boost.condition) {
        if (boost.condition.type === 'breathing_keyword') {
          const breathing = char.breathing_style;
          const breathingData = RESPIRACOES_DATA[breathing];
          if (!breathingData || !breathingData.keywords.includes(boost.condition.value)) {
            applies = false;
          }
        } else if (boost.condition.type === 'breathing_style') {
          if (char.breathing_style !== boost.condition.value) {
            applies = false;
          }
        }
      }

      if (applies) {
        buffs.push({ source: 'Linhagem', amount: boost.amount });
      }
    });
  }

  // 2. Anomaly Buffs (Placeholder for now)
  // 3. Nichirin Buffs (Placeholder for now)
  // 4. Class Buffs (Placeholder for now)

  return buffs;
}

export function calculateStatWithBuffs(char, statName, baseValue) {
  const buffs = getStatBuffs(char, statName);
  const totalMultiplier = buffs.reduce((acc, buff) => acc + buff.amount, 0);
  return {
    total: Math.floor(baseValue * (1 + totalMultiplier)),
    buffs: buffs,
    multiplier: totalMultiplier
  };
}

export function calculateDisarmedPAT(char) {
  if (!char) return 0;
  const strength = calculateStatWithBuffs(char, 'strength', Number(char.strength) || 0).total;
  const resistance = calculateStatWithBuffs(char, 'resistance', Number(char.resistance) || 0).total;
  // Soco / Improviso Formula: (1.0 * Força + 0.35 * Resistência) * 4
  return ((1.0 * strength + 0.35 * resistance) * 4 * GLOBAL_PAT_MULTIPLIER).toFixed(1);
}

export function calculateAcerto(char) {
  if (!char) return 0;
  const sPrecision = calculateStatWithBuffs(char, 'precision', Number(char.precision) || 0).total;
  const sAgility = calculateStatWithBuffs(char, 'agility', Number(char.agility) || 0).total;
  const sAptitude = calculateStatWithBuffs(char, 'aptitude', Number(char.aptitude) || 0).total;
  const sStrength = calculateStatWithBuffs(char, 'strength', Number(char.strength) || 0).total;

  return Math.round(10 + Math.pow(
    (
      (sPrecision * 0.5) +
      sAgility +
      (sAptitude * 0.25) +
      (sStrength * 0.15)
    ) * 3,
    0.82
  ));
}

export function calculateDesvio(char) {
  if (!char) return 0;
  const sAgility = calculateStatWithBuffs(char, 'agility', Number(char.agility) || 0).total;
  const sResistance = calculateStatWithBuffs(char, 'resistance', Number(char.resistance) || 0).total;
  const sAptitude = calculateStatWithBuffs(char, 'aptitude', Number(char.aptitude) || 0).total;

  return Math.round(11 + Math.pow(
    (
      (sAgility * 1.2) +
      (sResistance * 0.2) +
      (sAptitude * 0.3)
    ) * 3,
    0.82
  ));
}

export function calculateBloqueio(char) {
  if (!char) return 0;
  const sResistance = calculateStatWithBuffs(char, 'resistance', Number(char.resistance) || 0).total;
  const sStrength = calculateStatWithBuffs(char, 'strength', Number(char.strength) || 0).total;
  const sAptitude = calculateStatWithBuffs(char, 'aptitude', Number(char.aptitude) || 0).total;

  // Formula baseada em Resistência, Força e Aptidão
  return Math.round(4 + Math.pow(
    (
      (sResistance * 1.3) +
      (sStrength * 0.4) +
      (sAptitude * 1.0)
    ) * 1.3,
    0.82
  ));
}

export function calculateSecondaryStat(perc, char = null) {
  const p = parseFloat(perc) || 0;
  let power = 0.45;
  if (p < 8.5) {
    power = 0.5;
  } else if (p > 20) {
    power = 0.4;
  } else if (p > 11.5) {
    power = 0.55;
  }
  
  // Base sum to reach 20 when perc is 11.11... (which happens when all 9 stats are 3)
  // Input: p = 11.1111...
  // Requirement: result = 20
  // Formula: X + Math.pow(p, power) = 20
  // With p=11.11 and power=0.45: Math.pow(11.11, 0.45) ≈ 2.97
  // So X ≈ 20 - 2.97 ≈ 17.03
  // Since user said it "currently starts at 13 but should start at 20", 
  // and we want it to result in 1d20 base (which is 20 in this context of flat values).
  let baseValue = Math.round(17.03 + Math.pow(p, power));

  // Special Case: Convencimento buff from Lireou
  // If this is called for Convencimento (Carisma), we check for the bloodline.
  // Note: Since this function only takes 'perc', we might need to pass the char context.
  if (char) {
    const lineageName = char.bloodline || char.lineage;
    if (lineageName === 'Lireou') {
      baseValue = Math.floor(baseValue * 1.20);
    } else if (lineageName === 'Lireou (Douma)') {
      baseValue = Math.floor(baseValue * 1.15);
    }
  }

  return baseValue;
}

export function calculateLootDie(luckPerc) {
  const p = parseFloat(luckPerc) || 0;
  return Math.round(15 + (5 * Math.pow(p / 15, 0.8)));
}

export function calculateDerivedStats(char) {
  if (!char) return null;

  // Apply Buffs from Lineage etc.
  const strengthWithBuffs = calculateStatWithBuffs(char, 'strength', Number(char.strength) || 0).total;
  const resistanceWithBuffs = calculateStatWithBuffs(char, 'resistance', Number(char.resistance) || 0).total;
  const aptitudeWithBuffs = calculateStatWithBuffs(char, 'aptitude', Number(char.aptitude) || 0).total;
  const agilityWithBuffs = calculateStatWithBuffs(char, 'agility', Number(char.agility) || 0).total;
  const precisionWithBuffs = calculateStatWithBuffs(char, 'precision', Number(char.precision) || 0).total;
  const intelligenceWithBuffs = calculateStatWithBuffs(char, 'intelligence', Number(char.intelligence) || 0).total;
  const charismaWithBuffs = calculateStatWithBuffs(char, 'charisma', Number(char.charisma) || 0).total;
  const luckWithBuffs = calculateStatWithBuffs(char, 'luck', Number(char.luck) || 0).total;

  const rawPresence = (Number(char.strength) || 0) + (Number(char.resistance) || 0) + (Number(char.aptitude) || 0) + (Number(char.agility) || 0) + (Number(char.precision) || 0);
  const presence = rawPresence * 2; // Matching the sheet's calculation for percentage base
  
  // Posture: Complex formula matches CombatManager and is used in the sheet
  const isComplex = !char.is_npc || char.type === 'Complex';
  const posture = isComplex 
    ? Math.floor(2 * (resistanceWithBuffs * 1.2) + (aptitudeWithBuffs * 3.4))
    : Math.floor((strengthWithBuffs + resistanceWithBuffs * 7) / 2);
  
  // Life: Strength + (Resistance * 7)
  let life = strengthWithBuffs + (resistanceWithBuffs * 7);

  // Apply Max Life Modifiers from effects
  const effects = Array.isArray(char.effects) ? char.effects : [];
  effects.forEach(eff => {
    if (eff.modifiers?.maxLife) {
      life *= eff.modifiers.maxLife;
    }
  });

  // Percentage stats (Cap at 100%)
  const calcPerc = (val) => presence > 0 ? Math.min((val / presence) * 100, 100).toFixed(1) : "0.0";
  
  const stats = {
    presence,
    rawPresence,
    posture,
    life: Math.floor(life),
    strengthPerc: calcPerc(strengthWithBuffs),
    resistancePerc: calcPerc(resistanceWithBuffs),
    aptitudePerc: calcPerc(aptitudeWithBuffs),
    agilityPerc: calcPerc(agilityWithBuffs),
    precisionPerc: calcPerc(precisionWithBuffs),
    intelligencePerc: calcPerc(intelligenceWithBuffs),
    charismaPerc: calcPerc(charismaWithBuffs),
    luckPerc: calcPerc(luckWithBuffs)
  };

  if (char.inventory) {
    const equippedBackpack = char.inventory.find(item => item.isBackpack && item.equipped);
    stats.weight_limit = 6 + (equippedBackpack ? (Number(equippedBackpack.cargaIncrease) || 10) : 0);
  } else {
    stats.weight_limit = 6;
  }

  return stats;
}

export function calculateWeaponPAT(weapon, char) {
  if (!weapon || !char) return 0;
  
  const effects = Array.isArray(char.effects) ? char.effects : [];
  
  let strength = calculateStatWithBuffs(char, 'strength', Number(char.strength) || 0).total;
  let precision = calculateStatWithBuffs(char, 'precision', Number(char.precision) || 0).total;
  let agility = calculateStatWithBuffs(char, 'agility', Number(char.agility) || 0).total;
  let resistance = calculateStatWithBuffs(char, 'resistance', Number(char.resistance) || 0).total;

  // Apply Stat Modifiers from effects
  effects.forEach(eff => {
    if (eff.modifiers?.precision) precision *= eff.modifiers.precision;
    if (eff.modifiers?.strength) strength *= eff.modifiers.strength;
    if (eff.modifiers?.agility) agility *= eff.modifiers.agility;
    if (eff.modifiers?.resistance) resistance *= eff.modifiers.resistance;
  });
  let base = 0;
  // EASY TO MODIFY FORMULAS
  const formulas = {
    // 🔫 Armas de Fogo
    'Sniper': (s, p, a, r) => (0.6 * s) + (2.4 * p),
    'Pistola': (s, p, a, r) => (0.7 * s) + (1.4 * p),
    'Revólver': (s, p, a, r) => (0.85 * s) + (1.3 * p),
    'Escopeta / Metralhadora': (s, p, a, r) => (1.2 * s) + (1.2 * p),
    'Submetralhadora': (s, p, a, r) => (0.5 * s) + (1.1 * p) + (0.8 * a),
    // ⚔️ Armas Brancas e Impacto
    'Arma de Impacto Leve': (s, p, a, r) => (1.15 * s) + (0.35 * r),
    'Lâmina Curta': (s, p, a, r) => (0.4 * s) + (1.2 * p) + (1.0 * a),
    'Espada Leve': (s, p, a, r) => (1.2 * s) + (1.2 * p),
    'Machado/Porrete Leve': (s, p, a, r) => (1.5 * s) + (0.7 * p),
    'Espada/Machado Pesado': (s, p, a, r) => (2.2 * s) + (0.4 * r),
    'Martelo Pesado': (s, p, a, r) => (2.0 * s) + (1.0 * r),
    'Soco / Improviso': (s, p, a, r) => (1.0 * s) + (0.45 * r)
  };
  const formula = formulas[weapon.subtype];
  base = formula ? formula(strength, precision, agility, resistance) : (1.0 * strength);
  // Multiply by 4 as per instruction: ((Atributos) * 4)
  base = base * 4;
  // TIER MULTIPLIERS: 0(0.8x), 1(1.0x), 2(1.2x), 3(1.5x), 4(2.0x)
  const tierMults = { 0: 0.8, 1: 1.0, 2: 1.2, 3: 1.5, 4: 2.0 };
  const tierValue = typeof weapon.tier === 'string' ? parseInt(weapon.tier.replace(/\D/g, '')) : weapon.tier;
  const tierMult = tierMults[tierValue] || 1.0;
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
  const customDamageMulti = typeof weapon.damage_multi === 'number' ? weapon.damage_multi : 1.0;
  return (base * tierMult * upgradeMult * bloodlineMult * customDamageMulti * GLOBAL_PAT_MULTIPLIER).toFixed(1);
}

export function rollDice(expression, charContext = null) {
  let processedExpression = expression;
  let diceType = null;

  // 1. Extract Slash Command if present (e.g., /acerto)
  const slashMatch = processedExpression.match(/\/([a-zA-Záàâãéèêíïóôõöúç]+)/i);
  if (slashMatch) {
    const slash = slashMatch[1].toLowerCase();
    
    const types = {
      acerto: ["acerto", "acertar", "ataque", "atacar", "ac", "at", "ace", "ata"],
      desvio: ["desvio", "esquiva", "desviar", "esquivar", "des", "es", "esq"],
      bloqueio: ["bloqueio", "bloquear", "defesa", "defender", "bl", "def", "blo"],
      dano: ["dano", "da"]
    };

    for (const [key, aliases] of Object.entries(types)) {
      if (aliases.includes(slash)) {
        diceType = key;
        break;
      }
    }
    
    // Only remove if it was a valid dice type
    if (diceType) {
      processedExpression = processedExpression.replace(slashMatch[0], "").trim();
    } else {
      // If it wasn't a recognized dice type, don't treat it as one (per user feedback)
      diceType = null;
    }
  }

  // 2. Identify all dice notations (e.g., 1d20, 3d35, 1d(15+5))
  // Handle d(expr) pattern
  const nestedDiceRegex = /(\d+)d\(([^)]+)\)/g;
  processedExpression = processedExpression.replace(nestedDiceRegex, (match, count, innerExpr) => {
    try {
      // Safe eval for the inner expression
      const safeInner = innerExpr.replace(/[^-+*/().0-9\s]/g, '');
      // eslint-disable-next-line no-eval
      const result = eval(safeInner);
      return `${count}d${Math.floor(result)}`;
    } catch (e) {
      return match;
    }
  });
  const diceRegex = /(\d+)d(\d+)/g;
  const rolls = [];
  
  processedExpression = processedExpression.replace(diceRegex, (match, count, sides) => {
    count = parseInt(count);
    sides = parseInt(sides);
    if (isNaN(count) || isNaN(sides) || count <= 0 || sides <= 0) return match;
    if (count > 100) count = 100; // Cap to prevent abuse
    const individualRolls = [];
    let sum = 0;
    
    for (let i = 0; i < count; i++) {
      const roll = Math.floor(Math.random() * sides) + 1;
      individualRolls.push(roll);
      sum += roll;
    }
    
    rolls.push({
      notation: match,
      results: individualRolls,
      sum: sum
    });
    
    return `(${sum})`;
  });
  // Security: Only allow mathematical characters
  const safeExpression = processedExpression.replace(/[^-+*/().0-9\s]/g, '');
  
  let total;
  try {
    // eslint-disable-next-line no-eval
    total = eval(safeExpression);
    if (total % 1 !== 0) total = parseFloat(total.toFixed(1));
  } catch (e) {
    return null; // Not a valid dice/math expression
  }
  if (rolls.length === 0 && !expression.includes('d')) {
    return null; // Just a math expression without dice, ignore unless it was explicitly a dice roll request
  }
  // Apply Effect Modifiers to Dice Result
  const effects = Array.isArray(charContext?.effects) ? charContext.effects : [];
  if (diceType) {
    effects.forEach(eff => {
      const mod = eff.modifiers?.[diceType];
      if (mod) {
        // Precision impacts PAT (Dano) for some weapons, but here we apply it to the dice roll if it's the requested type
        total *= mod;
      }
    });

    // Special case: Precision impacts "dano" type if requested
    if (diceType === 'dano') {
      effects.forEach(eff => {
        if (eff.modifiers?.precision) {
          // If the player has a precision debuff, it also affects damage (as per user request)
          total *= eff.modifiers.precision;
        }
      });
    }
    // Final rounding if modified
    if (total % 1 !== 0) total = parseFloat(total.toFixed(1));
  }

  // Critical / Negative Critical logic
  let status = "Normal";
  let statusColor = "text-white";

  // Check for forced Desastre (Frozen)
  const forceDesastre = effects.some(eff => eff.modifiers?.forceAcertoDesastre && diceType === 'acerto');
  const desvioDesastreChance = effects.reduce((acc, eff) => acc + (diceType === 'desvio' ? (eff.modifiers?.desvioDesastreChance || 0) : 0), 0);

  if (forceDesastre) {
    status = "Desastre";
    statusColor = "text-red-600";
    total = 1;
    // If it was a roll, override the first result
    if (rolls.length > 0 && rolls[0].results.length > 0) {
      rolls[0].results[0] = 1;
      rolls[0].sum = 1;
    }
  } else if (desvioDesastreChance > 0 && Math.random() < desvioDesastreChance) {
    status = "Desastre";
    statusColor = "text-red-600";
    total = 1;
    if (rolls.length > 0 && rolls[0].results.length > 0) {
      rolls[0].results[0] = 1;
      rolls[0].sum = 1;
    }
  } else if (rolls.length === 1 && rolls[0].results.length === 1) {
    const rollValue = rolls[0].results[0];
    const sides = parseInt(rolls[0].notation.split('d')[1]);
    
    // Calculate thresholds
    const pCritThreshold = Math.ceil(sides * 0.95);
    const critThreshold = Math.ceil(sides * 0.90);
    const pNegThreshold = Math.floor(sides * 0.05) || 1;
    const negThreshold = Math.floor(sides * 0.10) || 1;
    if (rollValue >= pCritThreshold) {
      status = "Crítico Perfeito";
      statusColor = "text-yellow-400";
    } else if (rollValue >= critThreshold) {
      status = "Crítico";
      statusColor = "text-orange-400";
    } else if (rollValue <= pNegThreshold) {
      status = "Desastre";
      statusColor = "text-red-600";
    } else if (rollValue <= negThreshold) {
      status = "Crítico Negativo";
      statusColor = "text-red-400";
    }
  }
  return {
    original: diceType ? processedExpression : expression,
    total: total,
    rolls: rolls,
    status: status,
    statusColor: statusColor,
    type: diceType
  };
}

export const rollLoot = (lootTable, multiplier = 1) => {
  const results = [];
  
  const getAdjustedChance = (chance, mult) => {
    let mEff = mult;
    if (chance > 50) {
      mEff = mult + (1 - mult) * ((chance - 50) / 50);
    }
    return Math.min(100, Math.max(0, chance * mEff));
  };

  // 1. Calculate rolls
  let rolls = Math.floor(Math.random() * (lootTable.max_rolls - lootTable.min_rolls + 1)) + lootTable.min_rolls;
  
  // 2. Extra rolls
  if (Math.random() * 100 < getAdjustedChance(lootTable.extra_roll_chance || 0, multiplier)) {
    const extra = Math.floor(Math.random() * (lootTable.max_extra_rolls - lootTable.min_extra_rolls + 1)) + lootTable.min_extra_rolls;
    rolls += extra;
  }
  
  const items = lootTable.items || [];
  if (items.length === 0) return [];

  // Pre-calculate original relative chances to adjust weights
  const rawTotalWeight = items.reduce((sum, item) => sum + (Number(item.weight) || Number(item.generalChance) || 0), 0);
  
  const adjustedItems = items.map(item => {
    const rawWeight = Number(item.weight) || Number(item.generalChance) || 0;
    const relativeChance = rawTotalWeight > 0 ? (rawWeight / rawTotalWeight) * 100 : 0;
    const newWeight = getAdjustedChance(relativeChance, multiplier);
    return { ...item, _effectiveWeight: newWeight };
  });

  // 3. Roll for each slot (Weight-based selection)
  for (let i = 0; i < rolls; i++) {
    const totalWeight = adjustedItems.reduce((sum, item) => sum + item._effectiveWeight, 0);
    if (totalWeight <= 0) continue;

    let random = Math.random() * totalWeight;
    let selectedItem = null;

    for (const itemConfig of adjustedItems) {
      const weight = itemConfig._effectiveWeight;
      if (random < weight) {
        selectedItem = itemConfig;
        break;
      }
      random -= weight;
    }

    if (selectedItem) {
      // Guaranteed at least minQty
      let amount = selectedItem.minQty || 1;
      
      // Calculate extra quantities
      const possibleExtra = (selectedItem.maxQty || amount) - amount;
      if (possibleExtra > 0) {
        for (let q = 0; q < possibleExtra; q++) {
          if (Math.random() * 100 < getAdjustedChance(selectedItem.individualQtyChance || 0, multiplier)) {
            amount++;
          }
        }
      }
      
      results.push({ item_id: selectedItem.item_id, amount });
    }
  }
  
  // Group results
  const grouped = results.reduce((acc, curr) => {
    const existing = acc.find(x => x.item_id === curr.item_id);
    if (existing) existing.amount += curr.amount;
    else acc.push(curr);
    return acc;
  }, []);
  
  return grouped;
};
