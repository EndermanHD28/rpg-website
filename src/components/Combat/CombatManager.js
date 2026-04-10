"use client";
import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  calculateWeaponPAT, 
  calculateDisarmedPAT, 
  calculateAcerto, 
  calculateDesvio, 
  calculateBloqueio,
  calculateDerivedStats 
} from '../../lib/rpg-math';

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
  handleNextTurn
}) {
  const [editingHP, setEditingHP] = useState(null);
  const [editingPosture, setEditingPosture] = useState(null);
  const [hpInput, setHpInput] = useState("");
  const [postureInput, setPostureInput] = useState("");

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

  return (
    <div className="w-[400px] shrink-0 bg-zinc-950 flex flex-col border-l border-white/5 relative">
      {targetingRoll && (
        <div className="absolute inset-0 z-[80] flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-300 pointer-events-none">
          <div className="absolute inset-0 bg-black/40 pointer-events-none" />
          <div className="relative z-[100] flex flex-col items-center">
            <div className="bg-red-600 text-black px-4 py-1 text-[10px] font-black uppercase tracking-[0.2em] mb-4 skew-x-[-12deg]">SELECIONE UM ALVO</div>
            <p className="text-white font-bold italic text-sm mb-8">Selecione um alvo para esta ação</p>
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setTargetingRoll(null); }}
              className="px-6 py-2 border border-white/20 text-white text-[9px] font-black uppercase tracking-widest hover:bg-white/10 transition-all rounded-full cursor-pointer pointer-events-auto"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className={`flex-1 overflow-y-auto p-4 custom-scrollbar transition-all duration-700 ${targetingRoll ? 'relative z-[75]' : ''}`}>
        <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.4em] italic text-center mb-4">Combatentes</h3>
        <div className="relative">
          <div className={`transition-all duration-700 ${!isCombatActive && combatants.length === 0 ? 'opacity-20 grayscale' : 'opacity-0 pointer-events-none absolute inset-0'}`}>
            <div className="flex flex-col items-center justify-center h-64">
              <span className="text-4xl mb-4">⚔️</span>
              <p className="text-[10px] font-black uppercase tracking-widest text-center">Nenhum combatente ativo</p>
            </div>
          </div>
          
          <div className={`flex flex-col gap-2 transition-all duration-700 ${isCombatActive ? 'opacity-100' : 'opacity-0 translate-x-4'}`}>
              {combatants.filter(p => !p.is_enemy).map(p => {
                const { life: maxLife, posture: maxPosture } = calculateDerivedStats(p);
                const currentLife = p.current_hp ?? maxLife;
                const hpPerc = Math.max(0, (currentLife / maxLife) * 100);

                const currentPosture = p.current_posture ?? maxPosture;
                const posturePerc = Math.max(0, (currentPosture / maxPosture) * 100);

                return (
                  <div
                    key={p.id}
                    onClick={() => {
                      if (targetingRoll) {
                        const actorId = isActingAsMaster ? selectedCombatantId : user?.id;
                        if (p.id === actorId) return;
                        finishDiceRoll(targetingRoll.diceResult, targetingRoll.input, targetingRoll.playerName, targetingRoll.playerImage, p);
                        setTargetingRoll(null);
                      }
                    }}
                    className={`relative group bg-zinc-900 border border-white/5 rounded-xl p-3 shadow-2xl transition-all duration-500 shrink-0 overflow-hidden ${targetingRoll ? 'cursor-crosshair ring-1 ring-red-600/50 animate-pulse hover:bg-zinc-800' : 'hover:border-red-600/40'}`}
                  >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-red-600/5 blur-[60px] -z-10 group-hover:bg-red-600/10 transition-colors" />
                    <div className="flex flex-col gap-2 relative">
                      {isActingAsMaster && !targetingRoll && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedCombatantId(selectedCombatantId === p.id ? null : p.id); }}
                          className={`absolute top-0 right-0 z-20 p-1 rounded-full border transition-all ${selectedCombatantId === p.id ? 'bg-green-500 border-green-400 text-white scale-110 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-black/40 border-white/10 text-white/20 hover:text-white/50'}`}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                        </button>
                      )}

                      <div className="flex items-start gap-4">
                        <div className="relative shrink-0">
                          {p.image_url ? <img src={p.image_url} className="w-10 h-10 rounded-lg object-cover border border-white/10 shadow-xl relative z-10" alt="" /> : <div className="w-10 h-10 rounded-lg bg-black/40 border border-white/10 flex items-center justify-center text-xl relative z-10">👤</div>}
                        </div>
                        <div className="flex-1 min-w-0 pt-1">
                          <h4 className="font-black italic text-white uppercase text-xs tracking-tighter truncate leading-tight mb-0.5">{p.char_name}</h4>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[7px] font-black text-zinc-500 uppercase tracking-widest">Vitalidade:</span>
                              {isActingAsMaster && editingHP === p.id ? (
                                <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                  <input autoFocus value={hpInput} onChange={e => setHpInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleHPSubmit(p, e.shiftKey); if (e.key === 'Escape') setEditingHP(null); }} className="bg-zinc-800 border border-red-500/50 rounded px-2 py-0.5 text-white font-mono text-xs w-16 outline-none" />
                                  <span className="font-mono text-[10px] font-black text-red-500/40">/{maxLife}</span>
                                </div>
                              ) : (
                                <div onClick={e => { if (isActingAsMaster) { e.stopPropagation(); setEditingHP(p.id); setHpInput(currentLife.toString()); } }} className={`flex items-baseline gap-0.5 ${isActingAsMaster ? 'cursor-pointer hover:bg-white/5 px-1.5 py-0.5 rounded' : ''}`}>
                                  <span className="font-mono text-sm font-black text-red-500">{currentLife}</span>
                                  <span className="font-mono text-[10px] font-black text-red-900/60">/{maxLife}</span>
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5">
                              <span className="text-[7px] font-black text-zinc-500 uppercase tracking-widest">Postura:</span>
                              {isActingAsMaster && editingPosture === p.id ? (
                                <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                  <input autoFocus value={postureInput} onChange={e => setPostureInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handlePostureSubmit(p, e.shiftKey); if (e.key === 'Escape') setEditingPosture(null); }} className="bg-zinc-800 border border-green-500/50 rounded px-2 py-0.5 text-white font-mono text-xs w-16 outline-none" />
                                  <span className="font-mono text-[10px] font-black text-green-500/40">/{maxPosture}</span>
                                </div>
                              ) : (
                                <div onClick={e => { if (isActingAsMaster) { e.stopPropagation(); setEditingPosture(p.id); setPostureInput(currentPosture.toString()); } }} className={`flex items-baseline gap-0.5 ${isActingAsMaster ? 'cursor-pointer hover:bg-white/5 px-1.5 py-0.5 rounded' : ''}`}>
                                  <span className="font-mono text-sm font-black text-green-500">{currentPosture}</span>
                                  <span className="font-mono text-[10px] font-black text-green-900/60">/{maxPosture}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1">
                        {Array.isArray(p.effects) && p.effects.map((eff, idx) => (
                          <div key={idx} className={`flex items-center gap-1 bg-zinc-950 border border-red-900/30 pl-0.5 pr-1.5 py-0.5 rounded relative ${targetingRoll ? '' : 'hover:border-red-600/50 cursor-help group/eff'}`} title={eff.description}>
                            <div className="min-w-[1rem] h-4 px-0.5 flex items-center justify-center bg-red-600/10 rounded text-[8px]">{eff.emoji}</div>
                            <span className="text-[7px] font-black uppercase tracking-wider text-red-500/80">{eff.name}</span>
                            <span className="text-[8px] font-black font-mono text-zinc-500 ml-0.5 border-l border-white/10 pl-1">{eff.duration ?? '-'}</span>
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
                        ))}
                      </div>

                      <div className="space-y-1">
                        <div className="relative h-1.5 bg-zinc-950 rounded-full border border-white/5 overflow-hidden shadow-inner">
                          <div className={`h-full relative transition-all duration-1000 ease-out ${hpPerc < 25 ? 'bg-gradient-to-r from-red-800 to-red-600 animate-pulse' : 'bg-gradient-to-r from-red-700 to-red-500'}`} style={{ width: `${hpPerc}%` }} />
                        </div>
                        <div className="relative h-1.5 bg-zinc-950 rounded-full border border-white/5 overflow-hidden shadow-inner">
                          <div className={`h-full relative transition-all duration-1000 ease-out bg-gradient-to-r from-green-700 to-green-500`} style={{ width: `${posturePerc}%` }} />
                        </div>
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
                              const equippedWeapon = p.inventory?.find(i => i.equipped && (i.category === "Arma de Fogo" || i.category === "Arma Branca"));
                              const wPAT = Math.round(equippedWeapon ? calculateWeaponPAT(equippedWeapon, p) : 0);
                              const dPAT = Math.round(calculateDisarmedPAT(p));
                              
                              const acertoValue = calculateAcerto(p);
                              const desvioValue = calculateDesvio(p);
                              const bloqueioValue = calculateBloqueio(p);

                              return (
                                <div className="flex flex-col gap-2">
                                  <div className="grid grid-cols-2 gap-2">
                                    <DiceBadge label="Ataque Armado" val={equippedWeapon ? `1d${wPAT}` : "---"} category="combat" />
                                    <DiceBadge label="Desarmado" val={`1d${dPAT}`} category="combat" />
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
                              const wPAT = Math.round(calculateWeaponPAT(null, p));
                              const dPAT = Math.round(calculateDisarmedPAT(p));
                              const desvioValue = calculateDesvio(p);
                              return (
                                <div className="grid grid-cols-2 gap-2">
                                  <DiceBadge label="Ataque" val={`1d${wPAT || dPAT}`} category="combat" />
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
    purple: { bg: 'bg-purple-500/5', border: 'border-purple-500/20', text: 'text-purple-100' }
  };
  const style = styles[category] || styles.combat;
  return (
    <div className={`flex flex-col items-center justify-center p-2 rounded-xl border ${style.border} ${style.bg}`}>
      <span className="text-[7px] font-black text-zinc-500 uppercase tracking-widest mb-1">{label}</span>
      <span className={`text-sm font-black font-mono ${style.text}`}>{val}</span>
    </div>
  );
}
