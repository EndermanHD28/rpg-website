const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'components', 'Combat', 'CombatManager.js');
let content = fs.readFileSync(filePath, 'utf8');

// Find the handleCombatantSelect function
const startMarker = '  const handleCombatantSelect = async (target) => {';
const startIdx = content.indexOf(startMarker);
if (startIdx === -1) {
  console.error('ERROR: Could not find handleCombatantSelect start');
  process.exit(1);
}

// Find the end of the function - we need to find the matching "  };"
// The function ends at "  };" followed by a blank line and then the next function/statement
// Let's find it by looking for the pattern after the function body
const afterStart = content.substring(startIdx);

// The function should end with "  };" — find the correct one
// We know the function body contains setSelectedWeapon(null); before the closing
const endPattern = '    }\n  };';
const endIdx = afterStart.indexOf(endPattern);
if (endIdx === -1) {
  console.error('ERROR: Could not find handleCombatantSelect end');
  process.exit(1);
}

const fullEndIdx = startIdx + endPattern.length;

const newFunction = `  const handleCombatantSelect = async (target) => {
    if (targetingRoll) {
      const actorId = isActingAsMaster ? selectedCombatantId : user?.id;
      if (target.id === actorId) return;

      const actor = targetingRoll.charContext || combatants.find(c => c.id === actorId) || (allPlayers.find(p => p.id === actorId));
      if (!actor) return;

      // Handle skill tree active moves that don't need weapon selection
      if (targetingRoll.isSkillTreeMove) {
        finishDiceRoll(targetingRoll.diceResult, targetingRoll.input, targetingRoll.playerName, targetingRoll.playerImage, target, null, null);
        setTargetingRoll(null);
        setSelectedWeapon(null);
        return;
      }

      // ENFORCE WEAPON SELECTION for normal combat targeting rolls and breathing moves
      if (!selectedWeapon) {
        if (showToast) {
          showToast("Selecione uma arma primeiro!", "warning");
        } else {
          alert("Selecione uma arma primeiro!");
        }
        return;
      }

      // Tiros Verification for Arma de Fogo
      let tirosValue = 0;
      if (selectedWeapon.category === 'Arma de Fogo' && !selectedWeapon.isSimple) {
        tirosValue = parseInt(tirosInput);
        const wStats = calculateWeaponPAT(selectedWeapon, actor);
        const maxTpT = (actor.category === 'Master' || isActingAsMaster) ? 999 : (wStats.tpt || 1);

        if (isNaN(tirosValue) || tirosValue < 1 || tirosValue > maxTpT) {
          const msg = 'O número de tiros deve ser entre 1 e ' + maxTpT + '!';
          if (showToast) {
            showToast(msg, "warning");
          } else {
            alert(msg);
          }
          return;
        }

        const ammoId = getAmmoIdForSubtype(selectedWeapon.subtype);
        if (ammoId) {
          const availableAmmo = actor.ammunition?.[ammoId] || 0;
          if (tirosValue > availableAmmo) {
            const msg = 'Você não tem balas suficientes! (Disponível: ' + availableAmmo + ', Necessário: ' + tirosValue + ')';
            if (showToast) {
              showToast(msg, "warning");
            } else {
              alert(msg);
            }
            return;
          }

          // Reduce ammo
          const newAmmoState = {
            ...(actor.ammunition || {}),
            [ammoId]: Math.max(0, availableAmmo - tirosValue)
          };
          const table = actor.is_npc ? 'npcs' : 'characters';
          const { error: ammoError } = await supabase.from(table).update({ ammunition: newAmmoState }).eq('id', actor.id);
          if (ammoError) {
            console.error("Error reducing ammo:", ammoError);
          }
        }
      }

      // Re-roll/Update dice result based on selected weapon if it's an attack/damage roll
      let finalDiceResult = targetingRoll.diceResult;
      let finalInput = targetingRoll.input;

      if (actor && (targetingRoll.diceResult.type === 'dano' || targetingRoll.diceResult.type === 'ataque')) {
        if (selectedWeapon.id === 'disarmed') {
          const dStats = calculateDisarmedPAT(actor);
          finalInput = '/dano ' + dStats.tpt + (dStats.dice > 0 ? 'd' + Math.floor(dStats.dice) : '') + (dStats.plus > 0 ? ' + ' + Math.floor(dStats.plus) : '');
        } else {
          const wStats = calculateWeaponPAT(selectedWeapon, actor);
          const tptValue = selectedWeapon.category === 'Arma de Fogo' ? tirosValue : wStats.tpt;
          const weaponPAT = selectedWeapon.id === 'armed_attack_simple1' ? actor.armed_pat : (selectedWeapon.id === 'armed_attack_simple2' ? actor.sec_armed_pat : null);
          
          if (actor.is_npc && actor.type === 'Simple' && weaponPAT && weaponPAT !== '0') {
             finalInput = '/dano ' + weaponPAT;
          } else {
             finalInput = '/dano ' + tptValue + 'd' + Math.floor(wStats.dice) + ' + ' + Math.floor(wStats.plus);
          }
        }
        finalDiceResult = rollDice(finalInput, { ...actor, equipped_weapon: selectedWeapon });
      } else if (actor && targetingRoll.diceResult.type === 'acerto') {
        finalDiceResult = rollDice(targetingRoll.input, { ...actor, equipped_weapon: selectedWeapon });
      }

      finishDiceRoll(finalDiceResult, finalInput, targetingRoll.playerName, targetingRoll.playerImage, target, selectedWeapon.category, selectedWeapon.subtype);
      setTargetingRoll(null);
      setSelectedWeapon(null);
    }
  };`;

const newContent = content.substring(0, startIdx) + newFunction + '\n' + content.substring(startIdx + fullEndIdx);
fs.writeFileSync(filePath, newContent, 'utf8');
console.log('Successfully replaced handleCombatantSelect in CombatManager.js');
