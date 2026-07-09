"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { TooltipWrapper } from '../UIElements';
import { 
  calculateWeaponPAT, 
  calculateDisarmedPAT, 
  calculateAcerto, 
  calculateDesvio, 
  calculateBloqueio,
  calculateDerivedStats,
  rollDice
} from '../../lib/rpg-math';
import { BREATHING_TREES } from '../../constants/gameData';

const getAmmoIdForSubtype = (subtype) => {
  if (!subtype) return null;
  const normalized = subtype.toLowerCase();
  if (normalized === "rifle") return "ammo_rifle";
  if (normalized === "pistola") return "ammo_pistola";
  if (normalized === "revólver" || normalized === "revolver") return "ammo_revolver";
  if (normalized === "escopeta") return "ammo_escopeta";
  if (normalized === "metralhadora") return "ammo_metralhadora";
  if (normalized === "submetralhadora") return "ammo_submetralhadora";
  return null;
};

export default function CombatManager({
  user,
  allPlayers,
  combatants,
  isCombatActive,
  isActingAsMaster,
  turn,
  targetingRoll,
  setTargetingRoll,
  selectedCombatantId,
  setSelectedCombatantId,
  finishDiceRoll,
  handleNextTurn,
  handleStartCombat,
  showToast,
  allNPCs = []
}) {
  const [selectedWeapon, setSelectedWeapon] = useState(null); // { id, name, category, subtype, etc. } or { id: 'disarmed', name: 'Desarmado' }
  const [tirosInput, setTirosInput] = useState("");
  const [lastAcertoInfo, setLastAcertoInfo] = useState(null); // { weaponId, weaponName, tiros, weaponCategory, weaponSubtype }
  const [showAmmoWarning, setShowAmmoWarning] = useState(false);

  useEffect(() => {
    if (selectedWeapon && selectedWeapon.category === 'Arma de Fogo') {
      const actorId = isActingAsMaster ? selectedCombatantId : user?.id;
      const actor = combatants.find(c => c.id === actorId) || (allPlayers.find(p => p.id === actorId));
      if (actor) {
        const stats = calculateWeaponPAT(selectedWeapon, actor);
        setTirosInput((stats.tpt || 1).toString());
      }
    } else {
      setTirosInput("");
    }
  }, [selectedWeapon, selectedCombatantId, user, combatants, allPlayers, isActingAsMaster]);

  const handleCombatantSelect = async (target) => {
    if (targetingRoll) {
      const actorId = isActingAsMaster ? selectedCombatantId : user?.id;
      if (target.id === actorId) return;

      // ENFORCE WEAPON SELECTION for targeting rolls
      if (!selectedWeapon) {
        if (showToast) {
          showToast("Selecione uma arma primeiro!", "warning");
        } else {
          alert("Selecione uma arma primeiro!");
        }
        return;
      }

      const actor = targetingRoll.charContext || combatants.find(c => c.id === actorId) || (allPlayers.find(p => p.id === actorId));
      if (!actor) return;

        // Tiros Verification for Arma de Fogo
        let tirosValue = 0;
        if (selectedWeapon.category === 'Arma de Fogo') {
          tirosValue = parseInt(tirosInput);
          const wStats = calculateWeaponPAT(selectedWeapon, actor);
          const maxTpT = wStats.tpt || 1;

          if (isNaN(tirosValue) || tirosValue < 1 || tirosValue > maxTpT) {
            const msg = `O número de tiros deve ser entre 1 e ${maxTpT}!`;
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
              const msg = `Você não tem balas suficientes! (Disponível: ${availableAmmo}, Necessário: ${tirosValue})`;
              if (showToast) {
                showToast(msg, "warning");
              } else {
                alert(msg);
              }
              return;
            }
          }
        }

        // Re-roll/Update dice result based on selected weapon if it's an attack/damage roll
        let finalDiceResult = targetingRoll.diceResult;
        let finalInput = targetingRoll.input;

        if (actor && (targetingRoll.diceResult.type === 'dano' || targetingRoll.diceResult.type === 'ataque')) {
          // Check for mismatch with last acerto weapon
          if (selectedWeapon.category === 'Arma de Fogo' && lastAcertoInfo) {
            if (selectedWeapon.id !== lastAcertoInfo.weaponId) {
              if (showToast) showToast(`⚠️ Atenção: Você usou ${lastAcertoInfo.weaponName} no Dado de Acerto (${lastAcertoInfo.tiros} tiros), mas está usando uma arma diferente no Dado de Dano.`, "warning");
            } else if (tirosValue !== lastAcertoInfo.tiros) {
              if (showToast) showToast(`⚠️ Atenção: Você usou ${lastAcertoInfo.tiros} tiros no Dado de Acerto com ${lastAcertoInfo.weaponName}, mas está usando ${tirosValue} tiros no Dado de Dano.`, "warning");
            }
          }

          if (selectedWeapon.id === 'disarmed') {
            const dStats = calculateDisarmedPAT(actor);
            finalInput = `/dano ${dStats.tpt}d${Math.floor(dStats.dice)} + ${Math.floor(dStats.plus)}`;
          } else {
            const wStats = calculateWeaponPAT(selectedWeapon, actor);
            const tptValue = selectedWeapon.category === 'Arma de Fogo' ? tirosValue : wStats.tpt;
            finalInput = `/dano ${tptValue}d${Math.floor(wStats.dice)} + ${Math.floor(wStats.plus)}`;
          }
          finalDiceResult = rollDice(finalInput, { ...actor, equipped_weapon: selectedWeapon });
        } else if (actor && targetingRoll.diceResult.type === 'acerto') {
          // Save last acerto info for damage roll mismatch checking
          if (selectedWeapon.category === 'Arma de Fogo') {
            setLastAcertoInfo({
              weaponId: selectedWeapon.id,
              weaponName: selectedWeapon.name,
              tiros: tirosValue,
              weaponCategory: selectedWeapon.category,
              weaponSubtype: selectedWeapon.subtype
            });

            // Only consume ammo on acerto (hit) rolls, not on damage rolls
            const ammoId = getAmmoIdForSubtype(selectedWeapon.subtype);
            if (ammoId) {
              const availableAmmo = actor.ammunition?.[ammoId] || 0;
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
          } else {
            // Not a firearm, clear last acerto info since the weapon changed
            setLastAcertoInfo(null);
          }
          finalDiceResult = rollDice(targetingRoll.input, { ...actor, equipped_weapon: selectedWeapon });
        } else {
          // For other roll types (desvio, bloqueio, etc.), clear last acerto info
          setLastAcertoInfo(null);
        }

      finishDiceRoll(finalDiceResult, finalInput, targetingRoll.playerName, targetingRoll.playerImage, target, selectedWeapon);
      setTargetingRoll(null);
      setSelectedWeapon(null);
      // Always clear lastAcertoInfo after any roll completes.
      // It will be re-set on the next acerto roll if needed.
      setLastAcertoInfo(null);
    }
  };

  useEffect(() => {
    const handleGlobalClick = (e) => handleCombatantSelect(e.detail);
    window.addEventListener('combatant-click', handleGlobalClick);
    return () => window.removeEventListener('combatant-click', handleGlobalClick);
  }, [targetingRoll, selectedWeapon, selectedCombatantId, user, combatants, allPlayers, finishDiceRoll]);

  const [editingHP, setEditingHP] = useState(null);
  const [editingPosture, setEditingPosture] = useState(null);
  const [editingFocus, setEditingFocus] = useState(null);
  const [showAddCombatant, setShowAddCombatant] = useState(false);
  const [showAddEffect, setShowAddEffect] = useState(null); // combatantId
  const [hpInput, setHpInput] = useState("");
  const [postureInput, setPostureInput] = useState("");
  const [focusInput, setFocusInput] = useState("");
  const [effectDuration, setEffectDuration] = useState("2");
  const [searchTerm, setSearchTerm] = useState("");
  const [addAsEnemy, setAddAsEnemy] = useState(true);

  const toggleCombatant = async (entity, type) => {
    try {
      const table = type === 'player' ? 'characters' : 'npcs';
      const isCurrentlyIn = entity.is_in_combat;
      
      const update = { is_in_combat: !isCurrentlyIn };
      
      if (!isCurrentlyIn) {
        update.is_enemy = addAsEnemy;
        const derived = calculateDerivedStats(entity);
        update.current_hp = derived.life;
        update.current_posture = derived.posture;
        
        const learnedSkills = Array.isArray(entity.breathing_skills) ? entity.breathing_skills : [];
        let totalStartingFocus = 0;
        
        if (entity.breathing_style && BREATHING_TREES[entity.breathing_style]) {
          const styleSkills = BREATHING_TREES[entity.breathing_style].skills;
          learnedSkills.forEach(skillId => {
            const skillData = styleSkills.find(s => s.id === skillId);
            if (skillData && skillData.skillLogic && skillData.skillLogic.startingFocus) {
              totalStartingFocus += skillData.skillLogic.startingFocus;
            }
          });
        }
        
        if (learnedSkills.includes('skill_0')) {
          update.current_focus = totalStartingFocus;
        }
      }

      console.log(`Updating ${table} ID ${entity.id}:`, update);
      const { error } = await supabase.from(table).update(update).eq('id', entity.id);
      if (error) throw error;
    } catch (err) {
      console.error("Error toggling combatant:", err);
      alert(`Erro ao atualizar combatente: ${err.message}`);
    }
  };

  const toggleEnemyStatus = async (entity, type) => {
    try {
      const table = type === 'player' ? 'characters' : 'npcs';
      await supabase.from(table).update({ is_enemy: !entity.is_enemy }).eq('id', entity.id);
    } catch (err) {
      console.error("Error toggling enemy status:", err);
    }
  };

  const addEffect = async (combatant, effectKey) => {
    const { EFFECTS } = await import('../../constants/gameData');
    const effectTemplate = EFFECTS[effectKey];
    if (!effectTemplate) return;

    const currentEffects = Array.isArray(combatant.effects) ? combatant.effects : [];
    const newEffect = {
      ...effectTemplate,
      key: effectKey,
      duration: parseInt(effectDuration) || 2,
      addedAtTurn: turn
    };

    const newEffects = [...currentEffects, newEffect];
    const table = combatant.is_npc ? 'npcs' : 'characters';
    const dbId = combatant.is_npc ? combatant.dbId : combatant.id;

    await supabase.from(table).update({ effects: newEffects }).eq('id', dbId);
    setShowAddEffect(null);
  };

  const handleHPSubmit = async (player, isShiftPressed = false) => {
    try {
      const { life: maxLife } = calculateDerivedStats(player);

      let equation = hpInput.toLowerCase().replace(/random/g, () => Math.random().toString());
      let newHP;
      try {
        if (/[^0-9+\-*/().\s|e]/.test(equation)) throw new Error("Invalid characters");
        newHP = Math.round(new Function(`return ${equation}`)());
      } catch (e) {
        alert("Equação inválida!");
        return;
      }

      if (isNaN(newHP)) return;
      if (!isShiftPressed && newHP > maxLife) newHP = maxLife;

      const table = player.is_npc ? 'npcs' : 'characters';
      const dbId = player.is_npc ? player.dbId : player.id;

      await supabase.from(table).update({ current_hp: newHP }).eq('id', dbId);
      setEditingHP(null);
    } catch (err) {
      alert("Erro ao atualizar HP: " + err.message);
    }
  };

  const handlePostureSubmit = async (player, isShiftPressed = false) => {
    try {
      const { posture: maxPosture } = calculateDerivedStats(player);

      let equation = postureInput.toLowerCase().replace(/random/g, () => Math.random().toString());
      let newPosture;
      try {
        if (/[^0-9+\-*/().\s|e]/.test(equation)) throw new Error("Invalid characters");
        newPosture = Math.round(new Function(`return ${equation}`)());
      } catch (e) {
        alert("Equação inválida!");
        return;
      }

      if (isNaN(newPosture)) return;
      if (!isShiftPressed && newPosture > maxPosture) newPosture = maxPosture;

      const table = player.is_npc ? 'npcs' : 'characters';
      const dbId = player.is_npc ? player.dbId : player.id;

      await supabase.from(table).update({ current_posture: newPosture }).eq('id', dbId);
      setEditingPosture(null);
    } catch (err) {
      alert("Erro ao atualizar Postura: " + err.message);
    }
  };

  const handleFocusSubmit = async (player, isShiftPressed = false) => {
    try {
      const { maxFocus } = calculateDerivedStats(player);

      let equation = focusInput.toLowerCase().replace(/random/g, () => Math.random().toString());
      let newFocus;
      try {
        if (/[^0-9+\-*/().\s|e]/.test(equation)) throw new Error("Invalid characters");
        newFocus = Math.round(new Function(`return ${equation}`)());
      } catch (e) {
        alert("Equação inválida!");
        return;
      }

      if (isNaN(newFocus)) return;
      if (!isShiftPressed && newFocus > maxFocus) newFocus = maxFocus;

      const table = player.is_npc ? 'npcs' : 'characters';
      const dbId = player.is_npc ? player.dbId : player.id;

      await supabase.from(table).update({ current_focus: newFocus }).eq('id', dbId);
      setEditingFocus(null);
    } catch (err) {
      alert("Erro ao atualizar Foco: " + err.message);
    }
  };

  return (
    <div className="w-[400px] shrink-0 bg-zinc-950 flex flex-col border-l border-white/5 relative">
      {targetingRoll && (
        <div className="fixed inset-0 z-[1000] flex flex-col items-center justify-end pb-32 p-8 text-center animate-in fade-in duration-300 pointer-events-none">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-[1px]" />
          <div className="relative z-[1010] flex flex-col items-center w-full max-w-md pointer-events-auto">
            <div className="bg-red-600 text-black px-7 py-2.5 text-sm font-black uppercase tracking-[0.3em] mb-7 skew-x-[-12deg] shadow-[0_0_30px_rgba(220,38,38,0.5)]">SELECIONE UM ALVO</div>
            <p className="text-white font-black italic text-lg mb-10 uppercase tracking-tight drop-shadow-lg">
              {targetingRoll?.diceResult?.type === 'acerto' ? 'Dado de Acerto' : 
               targetingRoll?.diceResult?.type === 'dano' || targetingRoll?.diceResult?.type === 'ataque' ? 'Dado de Dano' : 
               'Selecionar Alvo'}
            </p>
            
            {/* Weapon Selection */}
            <div className="w-full bg-zinc-950/90 border-2 border-red-500/20 rounded-[32px] p-7 mb-10 space-y-5 shadow-2xl backdrop-blur-xl">
              <div className="flex items-center justify-between px-2 border-b border-white/10 pb-2">
                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Arsenal</span>
                {selectedWeapon && <span className="text-[10px] font-black text-red-500 uppercase animate-pulse">Pronto</span>}
              </div>
              <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                {(() => {
                  const actorId = isActingAsMaster ? selectedCombatantId : user?.id;
                  const actor = combatants.find(c => c.id === actorId) || (allPlayers.find(p => p.id === actorId));
                  if (!actor) return null;

                  const inventory = Array.isArray(actor.inventory) ? actor.inventory : [];
                  const equippedWeapons = inventory.filter(i => i.equipped && (i.category === "Arma de Fogo" || i.category === "Arma Branca")) || [];
                  const options = [
                    { id: 'disarmed', name: 'Desarmado', category: 'Desarmado', subtype: 'Soco / Improviso' },
                    ...equippedWeapons
                  ];

                  if (!selectedWeapon && options.length > 0) {
                    setSelectedWeapon(options[0]);
                  }

                  return options.map((w, idx) => {
                    const stats = w.id === 'disarmed' ? calculateDisarmedPAT(actor) : calculateWeaponPAT(w, actor);
                    const diceVal = Math.floor(stats.dice);
                    const plusVal = Math.floor(stats.plus);
                    const tpt = stats.tpt || 1;
                    const statsLabel = `${tpt}d${diceVal}${plusVal > 0 ? ` + ${plusVal}` : ""}`;

                    const ammoId = w.category === 'Arma de Fogo' ? getAmmoIdForSubtype(w.subtype) : null;
                    const availableAmmo = ammoId ? (actor.ammunition?.[ammoId] || 0) : 0;
                    const isSelected = selectedWeapon?.id === w.id || (selectedWeapon?.id === 'disarmed' && w.id === 'disarmed');
                    const tirosNum = isSelected ? (parseInt(tirosInput) || 0) : 0;

                    return (
                      <button
                        key={w.id || idx}
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedWeapon(w); }}
                        className={`flex items-center gap-4 p-3 rounded-2xl border-2 transition-all duration-300 ${isSelected ? 'bg-red-600/20 border-red-500 text-white shadow-[0_0_20px_rgba(220,38,38,0.2)]' : 'bg-black/60 border-white/5 text-zinc-500 hover:border-white/20'}`}
                      >
                        <span className="text-xl">{w.id === 'disarmed' ? '👊' : (w.category === 'Arma de Fogo' ? '🔫' : '⚔️')}</span>
                        <div className="flex flex-col items-start min-w-0 flex-1">
                          <span className="text-[10px] font-black uppercase tracking-tight truncate w-full">{w.name}</span>
                          <span className={`text-[7px] font-bold uppercase tracking-wider ${isSelected ? 'text-red-400' : 'text-zinc-600'}`}>{w.subtype}</span>
                        </div>
                        
                        <div className="shrink-0 flex flex-col items-center justify-center p-1.5 min-w-[50px] rounded-lg border border-red-500/10 bg-red-500/5">
                           <span className="text-[6px] font-black text-zinc-500 uppercase tracking-widest mb-0.5 truncate w-full text-center px-1">Dano</span>
                           <span className="text-[10px] font-black font-mono text-red-500 leading-none">{statsLabel}</span>
                        </div>

                        {ammoId && (
                          <div className="shrink-0 flex flex-col items-center justify-center p-1.5 min-w-[50px] rounded-lg border border-yellow-500/10 bg-yellow-500/5">
                            <span className="text-[6px] font-black text-zinc-500 uppercase tracking-widest mb-0.5 truncate w-full text-center px-1">Balas</span>
                            <span className="text-[10px] font-black font-mono leading-none text-yellow-600">{availableAmmo}</span>
                          </div>
                        )}
                      </button>
                    );
                  });
                })()}
              </div>

              {selectedWeapon && selectedWeapon.category === "Arma de Fogo" && (() => {
                const actorId = isActingAsMaster ? selectedCombatantId : user?.id;
                const actor = combatants.find(c => c.id === actorId) || (allPlayers.find(p => p.id === actorId));
                if (!actor) return null;
                const stats = calculateWeaponPAT(selectedWeapon, actor);
                const diceVal = Math.floor(stats.dice);
                const plusVal = Math.floor(stats.plus);
                const diceSuffix = `d${diceVal}${plusVal > 0 ? ` + ${plusVal}` : ""}`;

                const ammoId = getAmmoIdForSubtype(selectedWeapon.subtype);
                const availableAmmo = ammoId ? (actor.ammunition?.[ammoId] || 0) : 0;
                const tirosNum = parseInt(tirosInput) || 0;

                const isDanoRoll = targetingRoll?.diceResult?.type === 'dano' || targetingRoll?.diceResult?.type === 'ataque';
                const showMismatchWarning = isDanoRoll && lastAcertoInfo && selectedWeapon.category === 'Arma de Fogo' && (selectedWeapon.id !== lastAcertoInfo.weaponId || tirosNum !== lastAcertoInfo.tiros);

                return (
                  <div className="flex flex-col items-center justify-center p-3 border border-red-500/20 bg-black/40 rounded-2xl gap-1 animate-in fade-in zoom-in-95 duration-200">
                    <span className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em]">Tiros</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={tirosInput}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "" || /^\d+$/.test(val)) {
                            if (val.length <= 2) {
                              setTirosInput(val);
                            }
                          }
                        }}
                        className="w-14 bg-zinc-950 border-2 border-red-500/20 rounded-xl py-1 text-center font-black font-mono text-white text-base outline-none focus:border-red-500/50"
                      />
                      <span className="text-sm font-black font-mono text-red-500 select-none">{diceSuffix}</span>
                    </div>

                    {showMismatchWarning && (
                      <div className="mt-2 px-3 py-1.5 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-center">
                        <p className="text-[8px] font-black text-yellow-400 uppercase tracking-wider leading-tight">
                          ⚠️ Dado de Acerto usou {lastAcertoInfo.weaponName} ({lastAcertoInfo.tiros} tiros)
                        </p>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setTargetingRoll(null); setSelectedWeapon(null); }}
              className="px-8 py-2 bg-zinc-950/50 border border-white/10 text-white text-[9px] font-black uppercase tracking-[0.2em] hover:bg-white hover:text-black transition-all rounded-full"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* ADD COMBATANT MODAL */}
      {isActingAsMaster && showAddCombatant && (
        <div className="absolute inset-0 z-[100] bg-zinc-950 flex flex-col border-l border-white/10 animate-in slide-in-from-right duration-300">
          <div className="p-4 border-b border-white/5 flex items-center justify-between">
            <h3 className="text-[10px] font-black text-white uppercase tracking-[0.4em] italic">Adicionar Combatente</h3>
            <button onClick={() => setShowAddCombatant(false)} className="text-zinc-500 hover:text-white transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
          <div className="p-4 border-b border-white/5 space-y-4">
            <input
              type="text"
              placeholder="Pesquisar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-red-500/50"
            />
            <div className="flex flex-col gap-2">
              <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Adicionar como:</span>
              <div className="flex bg-black/40 p-1 rounded-xl border border-white/5">
                <button
                  onClick={() => setAddAsEnemy(false)}
                  className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${!addAsEnemy ? 'bg-green-600 text-white shadow-lg' : 'text-zinc-500 hover:text-white'}`}
                >
                  <span>🛡️</span>
                  <span>Aliado</span>
                </button>
                <button
                  onClick={() => setAddAsEnemy(true)}
                  className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${addAsEnemy ? 'bg-red-600 text-white shadow-lg' : 'text-zinc-500 hover:text-white'}`}
                >
                  <span>💀</span>
                  <span>Inimigo</span>
                </button>
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
            <div className="space-y-4">
              <div>
                <h4 className="text-[8px] font-black text-zinc-600 uppercase tracking-widest mb-2 px-2">Jogadores</h4>
                <div className="flex flex-col gap-1">
                  {allPlayers
                    .filter(p => {
                      if (p.discord_username === 'EnderU' && p.rank === 'Mestre') return false;
                      const normalizedName = p.char_name?.toLowerCase().replace(/\s/g, '');
                      if (normalizedName === 'novorecruta') return false;
                      return p.char_name?.toLowerCase().includes(searchTerm.toLowerCase());
                    })
                    .sort((a, b) => (b.is_in_combat ? 1 : 0) - (a.is_in_combat ? 1 : 0))
                    .map(p => (
                      <div key={p.id} className="flex items-center gap-1 group">
                        <button
                          onClick={() => toggleCombatant(p, 'player')}
                          className={`flex-1 flex items-center gap-3 p-2 rounded-lg border transition-all ${p.is_in_combat ? 'bg-red-600/20 border-red-500/50 text-white' : 'bg-white/5 border-transparent text-zinc-400 hover:bg-white/10'}`}
                        >
                          <div className="w-8 h-8 rounded-md bg-zinc-800 overflow-hidden shrink-0 border border-white/10">
                            {p.image_url ? <img src={p.image_url} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full flex items-center justify-center text-[10px]">👤</div>}
                          </div>
                          <span className="text-[10px] font-bold uppercase truncate">{p.char_name}</span>
                          {p.is_in_combat && (
                            <span className="ml-auto text-[8px] font-black px-1.5 py-0.5 rounded bg-red-600 text-black">
                              IN
                            </span>
                          )}
                        </button>
                        {p.is_in_combat && (
                          <button
                            onClick={() => toggleEnemyStatus(p, 'player')}
                            className={`w-8 h-12 flex items-center justify-center rounded-lg border transition-all ${p.is_enemy ? 'bg-red-600/20 border-red-500/40 text-red-500' : 'bg-green-600/10 border-green-500/20 text-green-500'}`}
                            title={p.is_enemy ? "Inimigo" : "Aliado"}
                          >
                            <span className="text-xs">{p.is_enemy ? "💀" : "🛡️"}</span>
                          </button>
                        )}
                      </div>
                    ))}
                </div>
              </div>
              <div>
                <h4 className="text-[8px] font-black text-zinc-600 uppercase tracking-widest mb-2 px-2">NPCs / Inimigos</h4>
                <div className="flex flex-col gap-1">
                  {allNPCs
                    .filter(n => {
                      const normalizedName = n.name?.toLowerCase().replace(/\s/g, '');
                      if (normalizedName === 'novorecruta') return false;
                      return n.name?.toLowerCase().includes(searchTerm.toLowerCase());
                    })
                    .sort((a, b) => (b.is_in_combat ? 1 : 0) - (a.is_in_combat ? 1 : 0))
                    .map(n => (
                      <div key={n.id} className="flex items-center gap-1 group">
                        <button
                          onClick={() => toggleCombatant(n, 'npc')}
                          className={`flex-1 flex items-center gap-3 p-2 rounded-lg border transition-all ${n.is_in_combat ? (n.is_enemy ? 'bg-red-600/20 border-red-500/50 text-white' : 'bg-green-600/20 border-red-500/50 text-white') : 'bg-white/5 border-transparent text-zinc-400 hover:bg-white/10'}`}
                        >
                          <div className="w-8 h-8 rounded-md bg-zinc-800 overflow-hidden shrink-0 border border-white/10">
                            {n.image_url ? <img src={n.image_url} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full flex items-center justify-center text-[10px]">👤</div>}
                          </div>
                          <div className="flex flex-col items-start min-w-0">
                            <span className="text-[10px] font-bold uppercase truncate">{n.name}</span>
                            <span className="text-[7px] text-zinc-500 uppercase">{n.category} • {n.type}</span>
                          </div>
                          {n.is_in_combat && (
                            <span className={`ml-auto text-[8px] font-black px-1.5 py-0.5 rounded ${n.is_enemy ? 'bg-red-600 text-black' : 'bg-green-600 text-black'}`}>
                              {n.is_enemy ? 'ENEMY' : 'ALLY'}
                            </span>
                          )}
                        </button>
                        {n.is_in_combat && (
                          <button
                            onClick={() => toggleEnemyStatus(n, 'npc')}
                            className={`w-8 h-12 flex items-center justify-center rounded-lg border transition-all ${n.is_enemy ? 'bg-red-600/20 border-red-500/40 text-red-500' : 'bg-green-600/10 border-green-500/20 text-green-500'}`}
                            title={n.is_enemy ? "Inimigo" : "Aliado"}
                          >
                            <span className="text-xs">{n.is_enemy ? "💀" : "🛡️"}</span>
                          </button>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADD EFFECT MODAL */}
      {isActingAsMaster && showAddEffect && (
        <div className="absolute inset-0 z-[100] bg-zinc-950 flex flex-col border-l border-white/10 animate-in slide-in-from-right duration-300">
          <div className="p-4 border-b border-white/5 flex items-center justify-between">
            <h3 className="text-[10px] font-black text-white uppercase tracking-[0.4em] italic">Adicionar Efeito</h3>
            <button onClick={() => setShowAddEffect(null)} className="text-zinc-500 hover:text-white transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
          <div className="p-4 border-b border-white/5 space-y-2">
            <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Duração (Turnos)</label>
            <input
              type="number"
              value={effectDuration}
              onChange={(e) => setEffectDuration(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-red-500/50"
            />
          </div>
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-2">
            {(() => {
              const { EFFECTS } = require('../../constants/gameData');
              return Object.entries(EFFECTS).map(([key, eff]) => (
                <button
                  key={key}
                  onClick={() => {
                    const combatant = combatants.find(c => c.id === showAddEffect);
                    if (combatant) addEffect(combatant, key);
                  }}
                  className="w-full flex items-center gap-3 p-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl transition-all group"
                >
                  <div className="w-10 h-10 shrink-0 flex items-center justify-center bg-black/40 rounded-lg text-xl border border-white/10 group-hover:border-red-500/50 transition-colors leading-none">{eff.emoji}</div>
                  <div className="flex flex-col items-start min-w-0">
                    <span className="text-[10px] font-black text-white uppercase tracking-wider truncate w-full">{eff.name}</span>
                    <span className="text-[8px] text-zinc-500 font-medium line-clamp-2 leading-tight">{eff.description}</span>
                  </div>
                </button>
              ));
            })()}
          </div>
        </div>
      )}

      <div className={`flex-1 overflow-y-auto p-4 custom-scrollbar transition-all duration-700 ${targetingRoll ? 'relative z-[75]' : ''}`}>
        <div className="flex items-center justify-center gap-4 mb-4">
          <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.4em] italic text-center">Combatentes</h3>
          {isActingAsMaster && (
            <button
              onClick={() => setShowAddCombatant(true)}
              className="p-1.5 bg-red-600/10 hover:bg-red-600/20 text-red-500 rounded-lg border border-red-500/20 transition-all hover:scale-105 active:scale-95"
              title="Adicionar Combatente"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><path d="M12 5v14M5 12h14"/></svg>
            </button>
          )}
        </div>
        <div className="relative">
          <div className={`transition-all duration-700 ${!isCombatActive && combatants.length === 0 ? 'opacity-20 grayscale' : 'opacity-0 pointer-events-none absolute inset-0'}`}>
            <div className="flex flex-col items-center justify-center h-64">
              <span className="text-4xl mb-4">⚔️</span>
              <p className="text-[10px] font-black uppercase tracking-widest text-center mb-6">Nenhum combatente ativo</p>
              {isActingAsMaster && (
                <button
                  onClick={handleStartCombat}
                  className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white font-black text-[9px] uppercase rounded-full transition-all shadow-xl shadow-red-900/40 border border-red-400/20"
                >
                  Iniciar Combate
                </button>
              )}
            </div>
          </div>
          
          <div className={`flex flex-col gap-2 transition-all duration-700 ${isCombatActive ? 'opacity-100' : 'opacity-0 translate-x-4'}`}>
              {combatants.filter(p => !p.is_enemy).map(p => {
                const derived = calculateDerivedStats(p);
                const { life: maxLife, posture: maxPosture, maxFocus } = derived;
                const currentLife = p.current_hp ?? maxLife;
                const hpPerc = Math.max(0, (currentLife / maxLife) * 100);

                const currentPosture = p.current_posture ?? maxPosture;
                const posturePerc = Math.max(0, (currentPosture / maxPosture) * 100);

                const hasFocusSystem = Array.isArray(p.breathing_skills) && p.breathing_skills.includes('skill_0');
                const currentFocus = p.current_focus ?? 0;
                const focusPerc = hasFocusSystem ? Math.max(0, Math.min(100, (currentFocus / maxFocus) * 100)) : 0;

                return (
                  <div
                    key={p.id}
                    onClick={() => handleCombatantSelect(p)}
                    className={`relative group bg-zinc-900 border border-white/5 rounded-xl p-3 shadow-2xl transition-all duration-500 shrink-0 overflow-hidden ${targetingRoll ? 'cursor-crosshair ring-2 ring-red-600/50 animate-pulse hover:bg-zinc-800' : 'hover:border-red-600/40'}`}
                  >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-red-600/5 blur-[60px] -z-10 group-hover:bg-red-600/10 transition-colors" />
                    <div className="flex flex-col gap-2 relative">
                      {isActingAsMaster && !targetingRoll && (
                        <button
                          onClick={async (e) => { 
                            e.stopPropagation(); 
                            const newId = selectedCombatantId === p.id ? null : p.id;
                            setSelectedCombatantId(newId);
                            await supabase.from('global').update({ imitated_id: newId }).eq('id', 1);
                          }}
                          className={`absolute top-0 right-0 z-20 p-1 rounded-full border transition-all ${selectedCombatantId === p.id ? 'bg-green-500 border-green-400 text-white scale-110 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-black/40 border-white/10 text-white/20 hover:text-white/50'}`}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                        </button>
                      )}

                      <div className="flex items-center gap-3">
                        <div className="relative shrink-0 self-center">
                          {p.image_url ? <img src={p.image_url} className="w-14 h-14 rounded-lg object-cover border border-white/10 shadow-xl relative z-10" alt="" /> : <div className="w-14 h-14 rounded-lg bg-black/40 border border-white/10 flex items-center justify-center text-xl relative z-10">👤</div>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-black italic text-white uppercase text-[10px] tracking-tight truncate leading-tight mb-2">{p.char_name}</h4>
                          <div className="flex flex-col -space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest w-16">Vitalidade:</span>
                              {isActingAsMaster && editingHP === p.id ? (
                                <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                  <input autoFocus value={hpInput} onChange={e => setHpInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleHPSubmit(p, e.shiftKey); if (e.key === 'Escape') setEditingHP(null); }} className="bg-zinc-800 border border-red-500/50 rounded px-1.5 py-0 text-white font-mono text-[10px] w-12 outline-none" />
                                  <span className="font-mono text-[9px] font-black text-red-500/40">/{maxLife}</span>
                                </div>
                              ) : (
                                <div onClick={e => { if (isActingAsMaster) { e.stopPropagation(); setEditingHP(p.id); setHpInput(currentLife.toString()); } }} className={`flex items-baseline gap-0.5 h-4 ${isActingAsMaster ? 'cursor-pointer hover:bg-white/5 px-1 rounded' : ''}`}>
                                  <span className="font-mono text-xs font-black text-red-500 leading-none">{currentLife}</span>
                                  <span className="font-mono text-[10px] font-black text-red-700/60 leading-none">/{maxLife}</span>
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest w-16">Postura:</span>
                              {isActingAsMaster && editingPosture === p.id ? (
                                <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                  <input autoFocus value={postureInput} onChange={e => setPostureInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handlePostureSubmit(p, e.shiftKey); if (e.key === 'Escape') setEditingPosture(null); }} className="bg-zinc-800 border border-green-500/50 rounded px-1.5 py-0 text-white font-mono text-[10px] w-12 outline-none" />
                                  <span className="font-mono text-[9px] font-black text-green-500/40">/{maxPosture}</span>
                                </div>
                              ) : (
                                <div onClick={e => { if (isActingAsMaster) { e.stopPropagation(); setEditingPosture(p.id); setPostureInput(currentPosture.toString()); } }} className={`flex items-baseline gap-0.5 h-4 ${isActingAsMaster ? 'cursor-pointer hover:bg-white/5 px-1 rounded' : ''}`}>
                                  <span className="font-mono text-xs font-black text-green-500 leading-none">{currentPosture}</span>
                                  <span className="font-mono text-[10px] font-black text-green-900/60 leading-none">/{maxPosture}</span>
                                </div>
                              )}
                            </div>

                            {hasFocusSystem && (
                              <div className="flex items-center gap-2">
                                <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest w-16">Foco:</span>
                                {isActingAsMaster && editingFocus === p.id ? (
                                  <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                    <input autoFocus value={focusInput} onChange={e => setFocusInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleFocusSubmit(p, e.shiftKey); if (e.key === 'Escape') setEditingFocus(null); }} className="bg-zinc-800 border border-cyan-500/50 rounded px-1.5 py-0 text-white font-mono text-[10px] w-12 outline-none" />
                                    <span className="font-mono text-[9px] font-black text-cyan-500/40">/{maxFocus}</span>
                                  </div>
                                ) : (
                                  <div onClick={e => { if (isActingAsMaster) { e.stopPropagation(); setEditingFocus(p.id); setFocusInput(currentFocus.toString()); } }} className={`flex items-baseline gap-0.5 h-4 ${isActingAsMaster ? 'cursor-pointer hover:bg-white/5 px-1 rounded' : ''}`}>
                                    <span className="font-mono text-xs font-black text-cyan-500 leading-none">{currentFocus}</span>
                                    <span className="font-mono text-[10px] font-black text-cyan-900/60 leading-none">/{maxFocus}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1">
                        {Array.isArray(p.effects) && p.effects.map((eff, idx) => (
                          <TooltipWrapper key={idx} text={`**${eff.name}**\n${eff.description}`}>
                            <div className={`flex items-center gap-1 bg-zinc-950 border border-red-900/30 pl-0.5 pr-1.5 py-0.5 rounded relative ${targetingRoll ? '' : 'hover:border-red-600/50 cursor-help group/eff'}`}>
                              <div className="min-w-[1rem] h-4 px-1 flex items-center justify-center bg-red-600/10 rounded text-[10px] leading-none">{eff.emoji}</div>
                              <span className="text-[9px] font-black uppercase tracking-wider text-red-500/80">{eff.name}</span>
                              <span className="text-[11px] font-black font-mono text-zinc-300 ml-0.5 border-l border-white/10 pl-1">{eff.duration ?? '-'}</span>
                              {isActingAsMaster && (
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    const newEffects = p.effects.filter((_, i) => i !== idx);
                                    const { life: nML } = calculateDerivedStats({ ...p, effects: newEffects });
                                    const update = { effects: newEffects };
                                    if ((p.current_hp || nML) > nML) update.current_hp = nML;
                                    await supabase.from(p.is_npc ? 'npcs' : 'characters').update(update).eq('id', p.is_npc ? p.dbId : p.id);
                                  }}
                                  className="absolute -top-1 -right-1 bg-red-900/80 text-white/70 rounded p-0.5 opacity-0 group-hover/eff:opacity-100 transition-opacity"
                                >
                                  <svg width="6" height="6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><path d="M18 6L6 18M6 6l12 12"/></svg>
                                </button>
                              )}
                            </div>
                          </TooltipWrapper>
                        ))}
                        {isActingAsMaster && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setShowAddEffect(p.id); }}
                            className="flex items-center justify-center w-6 h-6 bg-zinc-950 border border-white/10 rounded hover:border-red-500/50 transition-colors text-zinc-500 hover:text-red-500"
                            title="Adicionar Efeito"
                          >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><path d="M12 5v14M5 12h14"/></svg>
                          </button>
                        )}
                      </div>

                      <div className="space-y-1">
                        <div className="relative h-2 bg-zinc-950 rounded-full border border-white/5 overflow-hidden shadow-inner">
                          <div className={`h-full relative transition-all duration-1000 ease-out ${hpPerc < 25 ? 'bg-gradient-to-r from-red-800 to-red-600 animate-pulse' : 'bg-gradient-to-r from-red-700 to-red-500'}`} style={{ width: `${hpPerc}%` }} />
                        </div>
                        <div className="relative h-2 bg-zinc-950 rounded-full border border-white/5 overflow-hidden shadow-inner">
                          <div className={`h-full relative transition-all duration-1000 ease-out bg-gradient-to-r from-green-700 to-green-500`} style={{ width: `${posturePerc}%` }} />
                        </div>
                        {hasFocusSystem && (
                          <div className="relative h-2 bg-zinc-950 rounded-full border border-white/5 overflow-hidden shadow-inner">
                            <div className={`h-full relative transition-all duration-1000 ease-out bg-gradient-to-r from-cyan-800 to-cyan-500`} style={{ width: `${focusPerc}%` }} />
                          </div>
                        )}
                      </div>
                    </div>

                  <div className={`grid grid-rows-[0fr] ${targetingRoll ? '' : 'group-hover:grid-rows-[1fr]'} transition-all duration-500`}>
                    <div className="overflow-hidden">
                      <div className="pt-3 mt-3 border-t border-white/5 space-y-2">
                        <div className="flex flex-wrap gap-1">
                          {p.inventory?.filter(i => i.equipped).length > 0 ? p.inventory.filter(i => i.equipped).map((item, idx) => (
                            <div key={idx} className="flex items-center gap-1 bg-blue-600/5 border border-blue-500/20 px-1.5 py-0.5 rounded">
                              <span className="text-[7px] text-blue-400 font-black uppercase tracking-tight">{item.name}</span>
                            </div>
                          )) : <span className="text-[7px] text-zinc-700 uppercase font-bold italic">Desarmado</span>}
                        </div>
                        <div className="flex flex-col gap-2">
                          {(() => {
                                if (!p.is_npc || p.type === 'Complex') {
                                  const equippedWeapons = p.inventory?.filter(i => i.equipped && (i.category === "Arma de Fogo" || i.category === "Arma Branca")) || [];
                                  const wStats1 = equippedWeapons.length > 0 ? calculateWeaponPAT(equippedWeapons[0], p) : null;
                                  const wStats2 = equippedWeapons.length > 1 ? calculateWeaponPAT(equippedWeapons[1], p) : null;
                                  const dStats = calculateDisarmedPAT(p);
                                  
                                  const acertoValue = calculateAcerto(p);
                                  const desvioValue = calculateDesvio(p);
                                  const bloqueioValue = calculateBloqueio(p);

                                  const formatWeaponBadge = (stats) => {
                                    if (!stats) return "---";
                                    const d = Math.floor(stats.dice);
                                    const pVal = Math.floor(stats.plus);
                                    const tpt = stats.tpt || 1;
                                    return `${tpt}d${d}${pVal > 0 ? ` + ${pVal}` : ""}`;
                                  };

                                  return (
                                    <div className="flex flex-col gap-2">
                                      <div className={`grid ${wStats2 ? 'grid-cols-3' : 'grid-cols-2'} gap-2`}>
                                        <DiceBadge label={wStats1 ? equippedWeapons[0].name : "Ataque Armado"} val={formatWeaponBadge(wStats1)} category="combat" />
                                        {wStats2 && <DiceBadge label={equippedWeapons[1].name} val={formatWeaponBadge(wStats2)} category="combat" />}
                                        <DiceBadge label="Desarmado" val={formatWeaponBadge(dStats)} category="combat" />
                                      </div>
                                      <div className="grid grid-cols-3 gap-2">
                                        <DiceBadge label="Acerto" val={`1d${acertoValue}`} category="purple" />
                                        <DiceBadge label="Desvio" val={`1d${desvioValue}`} category="purple" />
                                        <DiceBadge label="Bloqueio" val={`1d${bloqueioValue}`} category="purple" />
                                      </div>
                                    </div>
                                  );
                                } else {
                                  // Simple NPC Ally/Neutral
                                  const wStats = calculateWeaponPAT(null, p);
                                  const dStats = calculateDisarmedPAT(p);
                                  const desvioValue = calculateDesvio(p);
                                  
                                  const wValue = typeof wStats === 'object' ? wStats.dice : wStats;

                                  return (
                                    <div className="grid grid-cols-2 gap-2">
                                      <DiceBadge label="Ataque" val={`1d${Math.floor(wValue || dStats.dice)}`} category="combat" />
                                      <DiceBadge label="Desvio" val={`1d${desvioValue}`} category="secondary" />
                                    </div>
                                  );
                                }
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                );
              })}
          </div>
        </div>
      </div>

      <div className={`shrink-0 p-4 bg-zinc-900 border-t border-white/10 z-50 flex items-center ${isActingAsMaster ? 'justify-between' : 'justify-center'} gap-4 transition-all duration-700 ease-in-out ${isCombatActive ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-full pointer-events-none'} ${targetingRoll ? 'blur-sm pointer-events-none' : ''}`}>
        <div className={`flex flex-col ${!isActingAsMaster ? 'items-center' : ''}`}>
          <span className="text-[7px] font-black text-red-500/60 uppercase tracking-[0.3em] mb-1">Turno Atual</span>
          <div key={turn} className="flex items-center justify-center">
            <span className="text-3xl font-black italic text-white drop-shadow-[0_0_15px_rgba(220,38,38,0.5)] leading-none">{turn || 1}</span>
          </div>
        </div>
        {isActingAsMaster && (
          <button onClick={handleNextTurn} className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white font-black text-[9px] uppercase rounded-lg transition-all shadow-xl shadow-red-900/40 border border-red-400/20 flex items-center justify-center gap-2">
            <span>Próximo Turno</span>
            <span className="text-sm">⚔️</span>
          </button>
        )}
      </div>
    </div>
  );
}

function DiceBadge({ label, val, category }) {
  const styles = {
    combat: { bg: 'bg-red-500/5', border: 'border-red-500/10', text: 'text-red-500' },
    luck: { bg: 'bg-yellow-500/5', border: 'border-yellow-500/10', text: 'text-yellow-500' },
    secondary: { bg: 'bg-blue-500/5', border: 'border-blue-500/10', text: 'text-blue-400' },
    purple: { bg: 'bg-purple-500/5', border: 'border-purple-500/20', text: 'text-purple-100' },
    focus: { bg: 'bg-cyan-500/5', border: 'border-cyan-500/20', text: 'text-cyan-400' }
  };
  const style = styles[category] || styles.combat;
  return (
    <div className={`flex flex-col items-center justify-center p-2 rounded-xl border ${style.border} ${style.bg} ${category === 'focus' ? 'shadow-[0_0_15px_rgba(6,182,212,0.1)]' : ''}`}>
      <span className="text-[7px] font-black text-zinc-500 uppercase tracking-widest mb-1 truncate w-full text-center px-1" title={label}>{label}</span>
      <span className={`text-sm font-black font-mono ${style.text}`}>{val}</span>
    </div>
  );
}
