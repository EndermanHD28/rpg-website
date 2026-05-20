const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'components', 'Combat', 'CombatManager.js');
let content = fs.readFileSync(filePath, 'utf8');

// Fix: remove the extra 8th parameter from finishDiceRoll call for ability targeting
const oldLine = "finishDiceRoll(targetingRoll.diceResult, targetingRoll.input, targetingRoll.playerName, targetingRoll.playerImage, target, null, null, targetingRoll.isBreathingMove ? 'breathing' : 'skilltree');";
const newLine = "finishDiceRoll(targetingRoll.diceResult, targetingRoll.input, targetingRoll.playerName, targetingRoll.playerImage, target, null, null);";

if (content.includes(oldLine)) {
  content = content.replace(oldLine, newLine);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Fixed finishDiceRoll call in CombatManager.js');
} else {
  console.error('ERROR: Could not find the line to fix in CombatManager.js');
  process.exit(1);
}
