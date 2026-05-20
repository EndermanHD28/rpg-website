const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'components', 'CombatTab.js');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Update finishDiceRoll signature to accept optional category override
const oldSignature = "const finishDiceRoll = async (diceResult, originalInput, playerName, playerImage, targetPlayer = null, weaponCategory = null, weaponSubtype = null) => {";
const newSignature = "const finishDiceRoll = async (diceResult, originalInput, playerName, playerImage, targetPlayer = null, weaponCategory = null, weaponSubtype = null, categoryOverride = null) => {";

if (!content.includes(oldSignature)) {
  console.error('ERROR: Could not find finishDiceRoll signature');
  process.exit(1);
}
content = content.replace(oldSignature, newSignature);

// 2. Update category detection to use override if provided
const oldCategory = `    let category = "normal";
    const lowerInput = originalInput.toLowerCase();
    if (lowerInput.includes('pat') || diceResult.type === 'dano') {
      category = "combat";
    } else if (lowerInput.includes('convencimento') || lowerInput.includes('raciocínio') || lowerInput.includes('raciocinio') || ['acerto', 'desvio', 'bloqueio'].includes(diceResult.type)) {
      category = "secondary";
    } else if (lowerInput.includes('loot') || lowerInput.includes('prosperidade')) {
      category = "luck";
    }`;

const newCategory = `    let category = categoryOverride || "normal";
    if (!categoryOverride) {
      const lowerInput = originalInput.toLowerCase();
      if (lowerInput.includes('pat') || diceResult.type === 'dano') {
        category = "combat";
      } else if (lowerInput.includes('convencimento') || lowerInput.includes('raciocínio') || lowerInput.includes('raciocinio') || ['acerto', 'desvio', 'bloqueio'].includes(diceResult.type)) {
        category = "secondary";
      } else if (lowerInput.includes('loot') || lowerInput.includes('prosperidade')) {
        category = "luck";
      }
    }`;

if (!content.includes(oldCategory)) {
  console.error('ERROR: Could not find category detection block');
  process.exit(1);
}
content = content.replace(oldCategory, newCategory);

// 3. Add skill tree move handling after the breathing move block
// Find the end of the breathing move block and add skill tree handling after it
const breathingBlockEnd = `      }
    }

    const targetName = targetPlayer ? targetPlayer.char_name : "";`;

const replacement = `      }
    }

    // --- SKILL TREE MOVE POST-TARGET EFFECTS ---
    if (targetingRoll?.isSkillTreeMove) {
      const rollerChar = allPlayers.find(p => p.char_name === playerName) || allNPCs.find(n => n.name === playerName);
      if (rollerChar) {
        const skillId = targetingRoll.skillId;
        const skillName = targetingRoll.skillName;
        const effectDesc = targetingRoll.effectDesc || "";

        // Send the Skill Tree Move layout card NOW
        await supabase.from('messages').insert({
          player_name: "SISTEMA",
          content: 'SKILL_TREE_MOVE|' + skillId + '|' + skillName + '|' + effectDesc + '|' + (rollerChar.char_name || rollerChar.name),
          is_system: true
        });
      }
    }

    const targetName = targetPlayer ? targetPlayer.char_name : "";`;

if (!content.includes(replacement)) {
  content = content.replace(breathingBlockEnd, replacement);
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated CombatTab.js');
