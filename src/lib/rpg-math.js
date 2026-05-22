import { LINHAGENS_DATA, RESPIRACOES_DATA, AMMUNITION_TYPES, BREATHING_TREES, SKILL_TREES } from '../constants/gameData';

const GLOBAL_PAT_MULTIPLIER = 0.6;

export function getSkillBuffs(char, targetStat) {
  if (!char || !char.class_skills) return [];
  const buffs = [];
  const learnedSkills = Array.isArray(char.class_skills) ? char.class_skills : [];
  
  // Iterate through all skill trees to find learned skills
  Object.values(SKILL_TREES).forEach(tree => {
    tree.skills.forEach(skill => {
      if (learnedSkills.includes(skill.id) && skill.logic?.stat_boosts) {
        skill.logic.stat_boosts.forEach(boost => {
          const boostStat = boost.stat.toLowerCase();
          const target = targetStat.toLowerCase();
          
          if (boostStat === target || boostStat === 'all') {
            buffs.push({ source: skill.name, amount: boost.amount });
          }
        });
      }
    });
  });
  
  return buffs;
}

export function getStatBuffs(char, statName) {
  if (!char) return [];
  const buffs = [];

  // 1. Lineage Buffs
  const lineageName = char.bloodline || char.lineage;
  const lineageData = LINHAGENS_DATA[lineageName];
  if (lineageData && lineageData.stat_boosts) {
    lineageData.stat_boosts.forEach(boost => {
      let applies = false;
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

  // 2. Skill Tree Buffs
  const skillBuffs = getSkillBuffs(char, statName);
  buffs.push(...skillBuffs);

  // 3. Anomaly Buffs (Placeholder for now)
  // 4. Nichirin Buffs (Placeholder for now)

  return buffs;
}

export function calculateStatWithBuffs(char, statName, baseValue) {
  const buffs = getStatBuffs(char, statName);
  // MULTIPLICATIVE LOGIC: (1 + b1) * (1 + b2) * ...
  const totalMultiplier = buffs.reduce((acc, buff) => acc * (1 + buff.amount), 1);
  return {
    total: Math.floor(baseValue * totalMultiplier),
    buffs: buffs,
    multiplier: totalMultiplier - 1
  };
}

export function calculateDisarmedPAT(char) {
  if (!char) return { dice: 0, plus: 0, tpt: 1 };
  const strength = calculateStatWithBuffs(char, 'strength', Number(char.strength) || 0).total;
  const resistance = calculateStatWithBuffs(char, 'resistance', Number(char.resistance) || 0).total;
  // Soco / Improviso Formula: (1.0 * Força + 0.45 * Resistência) * 4
  const dice = (1.0 * strength + 0.45 * resistance) * 4 * GLOBAL_PAT_MULTIPLIER;
  const plus = (0.3 * strength + 0.15 * resistance) * 4 * GLOBAL_PAT_MULTIPLIER;
  return {
    dice: parseFloat(dice.toFixed(1)),
    plus: parseFloat(plus.toFixed(1)),
    tpt: 1
  };
}

export function calculateAcerto(char) {
  if (!char) return 0;
  const sPrecision = calculateStatWithBuffs(char, 'precision', Number(char.precision) || 0).total;
  const sAgility = calculateStatWithBuffs(char, 'agility', Number(char.agility) || 0).total;
  const sAptitude = calculateStatWithBuffs(char, 'aptitude', Number(char.aptitude) || 0).total;
  const sStrength = calculateStatWithBuffs(char, 'strength', Number(char.strength) || 0).total;

  return Math.round(10 + Math.pow(
    (
      (sPrecision * 0.7) +
      sAgility * 2 +
      (sAptitude * 0.35) +
      (sStrength * 0.35)
    ) * 3,
    0.85
  ));
}

export function calculateDesvio(char) {
  if (!char) return 0;
  const sAgility = calculateStatWithBuffs(char, 'agility', Number(char.agility) || 0).total;
  const sResistance = calculateStatWithBuffs(char, 'resistance', Number(char.resistance) || 0).total;
  const sAptitude = calculateStatWithBuffs(char, 'aptitude', Number(char.aptitude) || 0).total;
  const sConcentration = calculateStatWithBuffs(char, 'concentration', Number(char.concentration) || 0).total;

  return Math.round(8 + Math.pow(
    (
      (sAgility * 1.5) +
      (sConcentration * 0.55) +
      (sResistance * 0.2) +
      (sAptitude * 0.3)
    ) * 2,
    0.85
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
    ) * 0.85,
    0.82
  ));
}

export function calculateSecondaryStat(perc, char = null, isCharisma = false) {
  const p = parseFloat(perc) || 0;
  
  // Define tiers similar to "Imposto de Renda" (Progressive Taxation)
  // Each tier has a limit and a power (exponent)
  const tiers = [
    { limit: 8.5, power: 0.5 },
    { limit: 11.5, power: 0.45 },
    { limit: 20, power: 0.55 },
    { limit: Infinity, power: 0.4 }
  ];

  let accumulatedValue = 0;
  let remainingP = p;
  let lastLimit = 0;

  for (const tier of tiers) {
    const range = tier.limit - lastLimit;
    const amountInTier = Math.min(remainingP, range);
    
    if (amountInTier > 0) {
      accumulatedValue += Math.pow(amountInTier, tier.power);
      remainingP -= amountInTier;
      lastLimit = tier.limit;
    }
    
    if (remainingP <= 0) break;
  }

  // Base constant adjusted to keep the starting point around 20 for typical early-game stats
  // With p=11.11, the sum was 20. Let's see what we get now:
  // Tier 1 (8.5): Math.pow(8.5, 0.5) ≈ 2.915
  // Tier 2 (11.11 - 8.5 = 2.61): Math.pow(2.61, 0.45) ≈ 1.543
  // Total ≈ 4.458
  // 20 - 4.458 ≈ 15.542
  let baseValue = Math.round(15.54 + accumulatedValue);

  // Special Case: Convencimento buff from Lireou
  if (char && isCharisma) {
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
  return Math.round(15 + (5 * Math.pow(p / 10, 0.7)));
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

  const rawPresence = (Number(char.strength) || 0) + (Number(char.resistance) || 0) + (Number(char.aptitude) || 0) + (Number(char.agility) || 0) + (Number(char.precision) || 0) + (Number(char.concentration) || 0);
  const presence = rawPresence * 2; // Matching the sheet's calculation for percentage base
  
  // Posture: Complex formula matches CombatManager and is used in the sheet
  const isComplex = !char.is_npc || char.type === 'Complex';
  const posture = Math.floor((resistanceWithBuffs * 1.6) + (aptitudeWithBuffs * 4.2));
  
  // Life: Strength + (Resistance * 7)
  let life = strengthWithBuffs * 3 + (resistanceWithBuffs * 12);

  // Focus: Based on Breathing Style Skill 0
  let maxFocus = 0;
  const learnedSkills = Array.isArray(char.breathing_skills) ? char.breathing_skills : [];
  const bLvl = Number(char.breathing_lvl) || 0;

  if (learnedSkills.includes('skill_0')) {
    if (char.breathing_style && BREATHING_TREES[char.breathing_style]) {
      const tree = BREATHING_TREES[char.breathing_style];
      // Get skill_0 logic
      const skill0 = tree.skills.find(s => s.id === 'skill_0');
      const config = skill0?.skillLogic;
      
      if (config) {
        maxFocus = (config.maxFocus || 100) + (Math.max(0, bLvl - 1) * (config.extraMaxFocusPerLevel || 0));
      } else {
        maxFocus = 100;
      }
    } else {
      // Default fallback if focus unlocked but style logic missing
      maxFocus = 100;
    }
  }

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
    concentrationPerc: calcPerc(Number(char.concentration) || 0),
    intelligencePerc: calcPerc(intelligenceWithBuffs),
    charismaPerc: calcPerc(charismaWithBuffs),
    luckPerc: calcPerc(luckWithBuffs),
    maxFocus,
    currentFocus: Number(char.current_focus) || 0
  };

  if (char.inventory) {
    const equippedBackpack = char.inventory.find(item => item.isBackpack && item.equipped);
    stats.weight_limit = 6 + (equippedBackpack ? (Number(equippedBackpack.cargaIncrease) || 10) : 0);
  } else {
    stats.weight_limit = 6;
  }

  return stats;
}

export function calculateCurrentWeight(inventory, ammunition = {}) {
  let itemWeight = 0;
  if (inventory) {
    itemWeight = inventory.reduce((acc, item) => {
      if (item.isBackpack && item.equipped) return acc;
      return acc + (Number(item.amount) || 1) * (Number(item.carga) || 1);
    }, 0);
  }

  let ammoWeight = 0;
  if (ammunition) {
    AMMUNITION_TYPES.forEach(type => {
      const qty = Number(ammunition[type.id]) || 0;
      ammoWeight += qty * (type.weight || 0);
    });
  }

  return {
    total: Math.floor(itemWeight + ammoWeight),
    precise: parseFloat((itemWeight + ammoWeight).toFixed(4)),
    items: itemWeight,
    ammo: parseFloat(ammoWeight.toFixed(4))
  };
}

export function calculateWeaponPAT(weapon, char) {
  if (!weapon) {
    return { dice: 0, plus: 0, tpt: 1 };
  }
  if (!char) return { dice: 0, plus: 0, tpt: 1 };
  
  const effects = Array.isArray(char.effects) ? char.effects : [];
  
  let strength = calculateStatWithBuffs(char, 'strength', Number(char.strength) || 0).total;
  let precision = calculateStatWithBuffs(char, 'precision', Number(char.precision) || 0).total;
  let agility = calculateStatWithBuffs(char, 'agility', Number(char.agility) || 0).total;
  let resistance = calculateStatWithBuffs(char, 'resistance', Number(char.resistance) || 0).total;
  let concentration = calculateStatWithBuffs(char, 'concentration', Number(char.concentration) || 0).total;

  // Apply Stat Modifiers from effects
  effects.forEach(eff => {
    if (eff.modifiers?.precision) precision *= eff.modifiers.precision;
    if (eff.modifiers?.strength) strength *= eff.modifiers.strength;
    if (eff.modifiers?.agility) agility *= eff.modifiers.agility;
    if (eff.modifiers?.resistance) resistance *= eff.modifiers.resistance;
    if (eff.modifiers?.concentration) concentration *= eff.modifiers.concentration;
  });
  let baseDice = 0;
  let basePlus = 0;

  // EASY TO MODIFY FORMULAS
  const formulas = {
    // 🔫 Armas de Fogo
    'Rifle': (s, p, a, r, c) => ({
      dice: (0.4 * s) + (1.6 * p) + (1.9 * c),
      plus: (0.1 * s) + (0.6 * p) + (0.3 * c)
    }),
    'Pistola': (s, p, a, r, c) => ({
      dice: (0.16 * s) + (0.36 * p) + (0.16 * c),
      plus: (0.2 * s) + (0.3 * p) + (0.4 * c)
    }),
    'Revólver': (s, p, a, r, c) => ({
      dice: (0.2 * s) + (0.33 * p) + (0.21 * c),
      plus: (0.3 * s) + (0.4 * p) + (0.5 * c)
    }),
    'Escopeta': (s, p, a, r, c) => ({
      dice: (0.4 * s) + (1.0 * p) + (0.5 * c),
      plus: (0.4 * s) + (0.4 * p) + (0.3 * c)
    }),
    'Metralhadora': (s, p, a, r, c) => ({
      dice: (0.04 * s) + (0.07 * p) + (0.02 * a) + (0.04 * c),
      plus: (0.2 * s) + (0.3 * p) + (0.3 * a) + (0.2 * c)
    }),
    'Submetralhadora': (s, p, a, r, c) => ({
      dice: (0.01 * s) + (0.03 * p) + (0.02 * a) + (0.01 * c),
      plus: (0.1 * s) + (0.3 * p) + (0.2 * a) + (0.2 * c)
    }),
    // ⚔️ Armas Brancas e Impacto
    'Arma de Impacto Leve': (s, p, a, r, c) => ({
      dice: (1.1 * s) + (0.3 * r) + (0.1 * c),
      plus: (0.35 * s) + (0.1 * r) + (0.05 * c)
    }),
    'Lâmina Curta': (s, p, a, r, c) => ({
      dice: (0.3 * s) + (0.71 * p) + (0.9 * a) + (0.1 * c),
      plus: (0.1 * s) + (0.35 * p) + (0.25 * a) + (0.1 * c)
    }),
    'Espada Leve': (s, p, a, r, c) => ({
      dice: (1.1 * s) + (1.1 * p) + (0.8 * a)+ (0.2 * c),
      plus: (0.35 * s) + (0.35 * p) + (0.4 * a)+ (0.1 * c)
    }),
    'Machado/Porrete Leve': (s, p, a, r, c) => ({
      dice: (1.4 * s) + (0.6 * p) + (0.55 * r) + (0.2 * c),
      plus: (0.45 * s) + (0.15 * p) + (0.3 * r) + (0.1 * c)
    }),
    'Espada/Machado Pesado': (s, p, a, r, c) => ({
      dice: (1.7 * s) + (1.1 * r) + (0.65 * a) + (0.1 * c),
      plus: (0.65 * s) + (0.1 * r) + (0.4 * a) + (0.05 * c)
    }),
    'Martelo Pesado': (s, p, a, r, c) => ({
      dice: (1.9 * s) + (1.45 * r) + (0.55 * a) + (0.2 * c),
      plus: (0.55 * s) + (0.25 * r) + (0.6 * a) + (0.1 * c)
    }),
    'Soco / Improviso': (s, p, a, r, c) => ({
      dice: (1.2 * s) + (0.51 * r) + (0.25 * c),
      plus: (0.25 * s) + (0.12 * r) + (0.8 * c)
    })
  };
  
  const formula = formulas[weapon.subtype];
  const results = formula ? formula(strength, precision, agility, resistance, concentration) : { dice: (1.0 * strength), plus: (0.3 * strength) };
  
  baseDice = results.dice;
  basePlus = results.plus;

  // Multiply by 4 as per instruction: ((Atributos) * 4)
  baseDice = baseDice * 4;
  basePlus = basePlus * 4;

  // TIER MULTIPLIERS: 0(0.8x), 1(1.0x), 2(1.2x), 3(1.5x), 4(2.0x)
  const tierMults = { 0: 0.8, 1: 1.0, 2: 1.2, 3: 1.5, 4: 2.0 };
  const tierValue = typeof weapon.tier === 'string' ? parseInt(weapon.tier.replace(/\D/g, '')) : weapon.tier;
  const tierMult = tierMults[tierValue] || 1.0;
  
  const upgradeLvl = Number(weapon.upgrade) || 0;
  let upgradeMult = 1.0;
  if (upgradeLvl > 0) {
    const linear = 1 + (upgradeLvl * 0.10);
    const exponential = Math.pow(1.05, upgradeLvl);
    upgradeMult = linear * exponential;
  }

  // BLOODLINE MULTIPLIER (Placeholder for now)
  const bloodlineMult = 1.0;
  let customDamageMulti = typeof weapon.damage_multi === 'number' ? weapon.damage_multi : 1.0;

  // Skill Tree Damage Multipliers (Applied directly to Weapon PAT)
  if (char?.class_skills) {
    const learnedSkills = Array.isArray(char.class_skills) ? char.class_skills : [];
    Object.entries(SKILL_TREES).forEach(([treeName, tree]) => {
      if (treeName === 'Artista') return;
      tree.skills.forEach(skill => {
        if (learnedSkills.includes(skill.id) && skill.logic?.damage_boosts) {
          skill.logic.damage_boosts.forEach(boost => {
            let applies = true;
            if (boost.condition) {
              if (boost.condition.type === 'weapon_subtype' && weapon.subtype !== boost.condition.value) applies = false;
              if (boost.condition.type === 'weapon_category' && weapon.category !== boost.condition.value) applies = false;
            }
            if (applies) {
              customDamageMulti *= (1 + boost.amount);
            }
          });
        }
      });
    });
  }
  
  const finalDice = (baseDice * tierMult * upgradeMult * bloodlineMult * customDamageMulti * GLOBAL_PAT_MULTIPLIER);
  const finalPlus = (basePlus * tierMult * upgradeMult * bloodlineMult * customDamageMulti * GLOBAL_PAT_MULTIPLIER);
  
  return {
    dice: parseFloat(finalDice.toFixed(1)),
    plus: parseFloat(finalPlus.toFixed(1)),
    baseDice: baseDice * GLOBAL_PAT_MULTIPLIER,
    basePlus: basePlus * GLOBAL_PAT_MULTIPLIER,
    rawDice: finalDice,
    rawPlus: finalPlus,
    tpt: Number(weapon.tpt) || 1,
    tierMult,
    upgradeMult,
    damageMulti: customDamageMulti
  };
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
  // Handle multiple dice rolls if tpt > 1 (e.g., 3d25)
  // The system now supports tpt in the notation directly from UI
  
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
        // MULTIPLICATIVE
        total *= mod;
      }
    });

    // Skill Tree Dice Modifiers
    if (charContext?.class_skills) {
      const learnedSkills = Array.isArray(charContext.class_skills) ? charContext.class_skills : [];
      Object.values(SKILL_TREES).forEach(tree => {
        tree.skills.forEach(skill => {
          if (learnedSkills.includes(skill.id) && skill.logic?.dice_boosts) {
            skill.logic.dice_boosts.forEach(boost => {
              if (boost.type === diceType || boost.type === 'all') {
                // Condition Check
                let applies = true;
                if (boost.condition) {
                  if (boost.condition.type === 'weapon_category' && charContext.equipped_weapon?.category !== boost.condition.value) {
                    applies = false;
                  }
                  if (boost.condition.type === 'weapon_subtype' && charContext.equipped_weapon?.subtype !== boost.condition.value) {
                    applies = false;
                  }
                }
                
                if (applies) {
                  total *= (1 + boost.amount);
                }
              }
            });
          }
        });
      });
    }

    // Special case: Precision impacts "dano" type if requested
    if (diceType === 'dano') {
      effects.forEach(eff => {
        if (eff.modifiers?.precision) {
          total *= eff.modifiers.precision;
        }
      });
    }
    // Final rounding if modified
    if (total % 1 !== 0) total = parseFloat(total.toFixed(1));
  }

  // Apply Focus Buff to Damage
  if (diceType === 'dano') {
    const tree = BREATHING_TREES[charContext.breathing_style];
    const skill0 = tree?.skills.find(s => s.id === 'skill_0');
    const config = skill0?.skillLogic;
    if (config) {
      const amount = config.eachXFocusMultiplyDamage || 5;
      const mult = config.damageMultiplierPerXFocus || 0.01;
      const focusBuff = 1 + (Math.floor((charContext.current_focus || 0) / amount) * mult);
      total *= focusBuff;
    } else {
      const focusBuff = 1 + (Math.floor((charContext.current_focus || 0) / 5) / 100);
      total *= focusBuff;
    }
    
    // Apply Skill Tree Final Damage Boosts
    if (charContext?.class_skills) {
      const learnedSkills = Array.isArray(charContext.class_skills) ? charContext.class_skills : [];
      Object.values(SKILL_TREES).forEach(tree => {
        tree.skills.forEach(skill => {
          if (learnedSkills.includes(skill.id) && skill.logic?.damage_boosts) {
            skill.logic.damage_boosts.forEach(boost => {
              // Condition Check (e.g., weapon type)
              let applies = true;
              if (boost.condition) {
                // If it's a weapon subtype boost, we only apply it here if it's NOT already applied to the weapon PAT
                if (boost.condition.type === 'weapon_subtype' || boost.condition.type === 'weapon_category') {
                  applies = false;
                }
              }
              if (applies) {
                total *= (1 + boost.amount);
              }
            });
          }
        });
      });
    }

    // Apply Breathing Tree Passive Logic for Damage
    if (charContext.breathing_style && BREATHING_TREES[charContext.breathing_style]) {
        const tree = BREATHING_TREES[charContext.breathing_style];
        const learnedSkills = Array.isArray(charContext.breathing_skills) ? charContext.breathing_skills : [];
        const bLvlBonus = Math.max(0, (charContext.breathing_lvl || 1) - 1);
        
        learnedSkills.forEach(skillId => {
            const skill = tree.skills.find(s => s.id === skillId);
            if (skill?.logic?.passiveBuffs) {
                const buffs = skill.logic.passiveBuffs(charContext, bLvlBonus);
                if (buffs?.damageBonus) {
                    total *= (1 + buffs.damageBonus);
                }
            }
        });
    }
  }

  // Handle Focus Skills Slash Commands
  // Format: /focus-skill-ID (e.g., /focus-skill-skill_1a)
  const focusSkillMatch = expression.match(/\/focus-skill-([a-zA-Z0-9_]+)/i);
  if (focusSkillMatch && charContext) {
    const skillId = focusSkillMatch[1];
    const { BREATHING_TREES } = require('../constants/gameData');
    const tree = BREATHING_TREES[charContext.breathing_style];
    const skill = tree?.skills.find(s => s.id === skillId);

    if (skill && skill.effect) {
      // Focus cost check is handled in CombatLog/UI usually, 
      // but here we can add notes to the dice result
      // The prompt says "immediately attack", so this might be called on top of a PAT roll
    }
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
  } else if (rolls.length === 1 && rolls[0].results.length === 1 && diceType !== 'dano') {
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
