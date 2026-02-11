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
  
  // Life: Strength + (Resistance * 7)
  let life = (Number(char.strength) || 0) + ((Number(char.resistance) || 0) * 7);

  // Apply Max Life Modifiers from effects
  const effects = Array.isArray(char.effects) ? char.effects : [];
  effects.forEach(eff => {
    if (eff.modifiers?.maxLife) {
      life *= eff.modifiers.maxLife;
    }
  });
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
  
  const effects = Array.isArray(char.effects) ? char.effects : [];
  
  let strength = Number(char.strength) || 0;
  let precision = Number(char.precision) || 0;
  let agility = Number(char.agility) || 0;
  let resistance = Number(char.resistance) || 0;

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
  return (base * tierMult * upgradeMult * bloodlineMult).toFixed(1);
}

export function rollDice(expression, charContext = null) {
  let processedExpression = expression;
  let diceType = null;

  // 1. Extract Slash Command if present (e.g., /acerto)
  const slashMatch = processedExpression.match(/\/([a-zA-Záàâãéèêíïóôõöúç]+)/i);
  if (slashMatch) {
    const slash = slashMatch[1].toLowerCase();
    
    const types = {
      acerto: ["acerto", "acertar", "ataque", "atacar"],
      desvio: ["desvio", "esquiva", "desviar", "esquivar"],
      bloqueio: ["bloqueio", "bloquear", "defesa", "defender"],
      dano: ["dano"]
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

export const rollLoot = (lootTable) => {
  const results = [];
  
  // 1. Calculate rolls
  let rolls = Math.floor(Math.random() * (lootTable.max_rolls - lootTable.min_rolls + 1)) + lootTable.min_rolls;
  
  // 2. Extra rolls
  if (Math.random() * 100 < (lootTable.extra_roll_chance || 0)) {
    const extra = Math.floor(Math.random() * (lootTable.max_extra_rolls - lootTable.min_extra_rolls + 1)) + lootTable.min_extra_rolls;
    rolls += extra;
  }
  
  // 3. Roll for each slot
  for (let i = 0; i < rolls; i++) {
    for (const itemConfig of (lootTable.items || [])) {
      if (Math.random() * 100 < itemConfig.generalChance) {
        // Guaranteed at least 1
        let amount = 1;
        
        // Calculate extra quantities
        const possibleExtra = (itemConfig.maxQty || 1) - 1;
        if (possibleExtra > 0) {
          for (let q = 0; q < possibleExtra; q++) {
            if (Math.random() * 100 < (itemConfig.individualQtyChance || 0)) {
              amount++;
            }
          }
        }
        
        results.push({ item_id: itemConfig.item_id, amount });
      }
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
