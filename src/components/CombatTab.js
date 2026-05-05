"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import CombatLog from './Combat/CombatLog';
import CombatManager from './Combat/CombatManager';

import { calculateDerivedStats } from '../lib/rpg-math';

export default function CombatTab({ user, allPlayers, allNPCs = [], messages, isCombatActive, isSessionActive, isMaster, isActingAsMaster, setActiveTab, turn, sharedImage, lootTables, showToast }) {
  const [selectedCombatantId, setSelectedCombatantId] = useState(null);
  const [targetingRoll, setTargetingRoll] = useState(null); // { input, diceResult, playerName, playerImage }
  const [displayCombatants, setDisplayCombatants] = useState([]);

  const currentCombatants = [
    ...allPlayers.filter(p => p.is_in_combat && (p.discord_username !== 'EnderU' || p.rank !== 'Mestre')),
    ...allNPCs.filter(n => n.is_in_combat && n.is_enemy).map(n => ({
      ...n,
      id: `npc-${n.id}`,
      dbId: n.id,
      char_name: n.name,
      rank: n.rank || 'NPC',
      is_npc: true,
      is_enemy: !!n.is_enemy
    }))
  ];

  useEffect(() => {
    if (isCombatActive) {
      setDisplayCombatants(currentCombatants);
    } else if (displayCombatants.length > 0) {
      // When combat ends, keep combatants for a brief moment for smooth transition
      const timer = setTimeout(() => {
        setDisplayCombatants([]);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isCombatActive, JSON.stringify(currentCombatants)]);

  const combatants = displayCombatants;

  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (e.key === 'Escape' && targetingRoll) {
        setTargetingRoll(null);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [targetingRoll]);

  const finishDiceRoll = async (diceResult, originalInput, playerName, playerImage, targetPlayer = null) => {
    let detail = diceResult.original;
    diceResult.rolls.forEach(r => {
      detail = detail.replace(r.notation, `<span class="text-zinc-500 font-mono text-[10px]">[${r.results.join(', ')}]</span>`);
    });

    const statusLabel = diceResult.status !== "Normal" ? ` <span class="${diceResult.statusColor} text-[10px] font-black uppercase tracking-widest bg-black/40 px-2 py-0.5 rounded-full border border-white/5 shadow-sm">${diceResult.status}</span>` : "";

    let category = "normal";
    const lowerInput = originalInput.toLowerCase();
    if (lowerInput.includes('pat') || ['ataque', 'desvio', 'dano'].includes(diceResult.type)) {
      category = "combat";
    } else if (lowerInput.includes('convencimento') || lowerInput.includes('raciocínio') || lowerInput.includes('raciocinio')) {
      category = "secondary";
    } else if (lowerInput.includes('loot') || lowerInput.includes('prosperidade')) {
      category = "luck";
    }

    let finalTotal = diceResult.total;
    let effectNote = "";

    if (targetPlayer && diceResult.type === 'dano') {
      const targetEffects = Array.isArray(targetPlayer.effects) ? targetPlayer.effects : [];
      let damageMult = 1.0;
      targetEffects.forEach(eff => {
        if (eff.modifiers?.damageTaken) {
          damageMult *= eff.modifiers.damageTaken;
          effectNote += ` (${eff.emoji} +${Math.round((eff.modifiers.damageTaken - 1) * 100)}% de dano por ${eff.name})`;
        }
      });
      if (damageMult !== 1.0) finalTotal = Math.round(finalTotal * damageMult);

      // AUTOMATIC DAMAGE APPLICATION
      // const { life: maxLife } = calculateDerivedStats(targetPlayer);
      // const currentHP = targetPlayer.current_hp ?? maxLife;
      // const newHP = Math.max(0, currentHP - finalTotal);
      
      // const table = targetPlayer.is_npc ? 'npcs' : 'characters';
      // const dbId = targetPlayer.is_npc ? targetPlayer.dbId : targetPlayer.id;
      
      // await supabase.from(table).update({ current_hp: newHP }).eq('id', dbId);
    }

    const targetInfo = targetPlayer ? `|${targetPlayer.char_name}${effectNote}` : "";
    const finalPlayerName = (isActingAsMaster && selectedCombatantId) ? "" : playerName;

    await supabase.from('messages').insert({
      player_name: "SISTEMA",
      content: `DICE_ROLL|${finalPlayerName}|${originalInput}|${finalTotal}|${detail}|${statusLabel}|${category}|${playerImage}|${diceResult.type || ''}${targetInfo}`,
      is_system: true
    });
  };

  const handleNextTurn = async () => {
    if (!isActingAsMaster) return;
    const nextTurn = (turn || 1) + 1;
    const { EFFECTS } = await import('../constants/gameData');
    
    for (const p of combatants) {
      const currentEffects = Array.isArray(p.effects) ? p.effects : [];
      const { life: initialMaxLife } = calculateDerivedStats(p);
      let newHP = p.current_hp ?? initialMaxLife;
      let newEffects = [...currentEffects];
      let effectsChanged = false;

      for (let i = 0; i < newEffects.length; i++) {
        const eff = newEffects[i];
        const mods = eff.modifiers;
        const { life: maxLife } = calculateDerivedStats({ ...p, effects: newEffects });

        if (mods?.hpReductionTurn) {
          newHP = Math.max(0, newHP - Math.floor(maxLife * mods.hpReductionTurn));
        }

        if (eff.key === 'eletrification' && mods?.triggerAdvancedEletrification && (newHP / maxLife <= mods.triggerAdvancedEletrification)) {
          newEffects[i] = { ...EFFECTS['advanced-eletrification'], key: 'advanced-eletrification', addedAtTurn: turn, duration: 2 };
          effectsChanged = true;
        }

        if (eff.duration !== undefined && eff.duration !== null) {
          eff.duration--;
          effectsChanged = true;
          if (eff.duration <= 0) { newEffects.splice(i, 1); i--; }
        }
      }

      if (newHP !== p.current_hp || effectsChanged) {
        await supabase.from(p.is_npc ? 'npcs' : 'characters').update({ current_hp: newHP, effects: newEffects }).eq('id', p.is_npc ? p.dbId : p.id);
      }
    }
    await supabase.from('global').update({ current_turn: nextTurn }).eq('id', 1);
  };

  if (!isSessionActive && !isActingAsMaster) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-black p-12 text-center flex-1">
        <div className="relative"><div className="absolute inset-0 bg-red-600 blur-[100px] opacity-20"></div><span className="text-8xl mb-8 block relative z-10">💤</span></div>
        <h2 className="text-4xl font-black italic text-white uppercase tracking-tighter mb-4">Nenhuma Sessão Ativa</h2>
        <p className="text-zinc-500 font-medium italic text-lg max-w-md mb-8">O mestre ainda não iniciou a sessão de hoje. Prepare seus dados e aguarde o chamado para o combate.</p>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden bg-black">
      {!isSessionActive && isActingAsMaster && (
        <div className="text-center py-2 bg-yellow-600 text-black font-black text-xs uppercase tracking-wider shadow-lg z-10">
          A Sessão não foi iniciada!
        </div>
      )}
      <div className="flex flex-1 relative overflow-hidden">
        {targetingRoll && <div className="fixed inset-0 z-[65] bg-black/20 backdrop-blur-sm animate-in fade-in duration-300 pointer-events-auto" />}
      
        <CombatLog 
          user={user}
          allPlayers={allPlayers}
          allNPCs={allNPCs}
          messages={messages}
          isSessionActive={isSessionActive}
          isCombatActive={isCombatActive}
          isMaster={isMaster}
          isActingAsMaster={isActingAsMaster}
          targetingRoll={targetingRoll}
          setTargetingRoll={setTargetingRoll}
          selectedCombatantId={selectedCombatantId}
          setSelectedCombatantId={setSelectedCombatantId}
          combatants={combatants}
          finishDiceRoll={finishDiceRoll}
          sharedImage={sharedImage}
          lootTables={lootTables}
          showToast={showToast}
        />

        <CombatManager 
          user={user}
          allPlayers={allPlayers}
          combatants={combatants}
          isCombatActive={isCombatActive}
          isActingAsMaster={isActingAsMaster}
          turn={turn}
          targetingRoll={targetingRoll}
          setTargetingRoll={setTargetingRoll}
          selectedCombatantId={selectedCombatantId}
          setSelectedCombatantId={setSelectedCombatantId}
          finishDiceRoll={finishDiceRoll}
          handleNextTurn={handleNextTurn}
        />
      </div>
    </div>
  );
}
