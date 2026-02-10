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

export function rollDice(expression) {
  // 1. Identify all dice notations (e.g., 1d20, 3d35, 1d(15+5))
  // We need to handle nested expressions like 1d(15 + 5)
  // First, let's solve any parentheses that are inside a 'd' notation
  // e.g. 1d(15+5) -> 1d20
  
  let processedExpression = expression;
  
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

  // Critical / Negative Critical logic
  let status = "Normal";
  let statusColor = "text-white";
  
  if (rolls.length === 1 && rolls[0].results.length === 1) {
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
      status = "Desastre Perfeito";
      statusColor = "text-red-600";
    } else if (rollValue <= negThreshold) {
      status = "Desastre";
      statusColor = "text-red-400";
    }
  }

  return {
    original: expression,
    total: total,
    rolls: rolls,
    status: status,
    statusColor: statusColor
  };
}
