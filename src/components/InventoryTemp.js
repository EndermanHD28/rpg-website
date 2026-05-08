/* src/components/InventoryTemp.js */
"use client";
import { useState } from 'react';
import { calculateWeaponPAT, calculateCurrentWeight } from '../lib/rpg-math';
import { useSound } from '../hooks/useSound';
import { TooltipWrapper } from './UIElements';
import { AMMUNITION_TYPES } from '../constants/gameData';
import { supabase } from '../lib/supabase';

export default function Inventory({ inventory = [], activeChar, isActingAsMaster, isViewingOthers, onDelete, onMove, onSort, onAddItem, onEquip, onEdit, rarityConfig, setTempChar, isEditing }) {
  const { playSound } = useSound();
  const [tab, setTab] = useState('Item');
  const [editingAmmoId, setEditingAmmoId] = useState(null);
  const [editingAmmoVal, setEditingAmmoVal] = useState("");

  const equippedItems = inventory.filter(i => i.equipped);
  const equippedBackpack = inventory.find(item => item.isBackpack && item.equipped);
  const hasBackpack = !!equippedBackpack;
  const maxSlots = 6 + (equippedBackpack ? (Number(equippedBackpack.cargaIncrease) || 10) : 0);
  const weightData = calculateCurrentWeight(inventory, activeChar?.ammunition);
  const itemWeight = weightData.total;

  const formatWeight = (val) => val.toString().replace('.', ',');

  // Filter items for the current tab and keep track of original index
  const filteredItems = inventory.map((item, originalIdx) => ({ ...item, originalIdx }))
                                 .filter(item => (item.type || 'Item') === tab);

  return (
    <div className="space-y-4">
      {/* EQUIPPED VISUAL BAR */}
      {equippedItems.length > 0 && (
        <div className="bg-blue-950/20 border border-blue-500/30 p-4 rounded-[30px] flex gap-3 overflow-x-auto custom-scrollbar">
          {equippedItems.map((item, idx) => {
            const isWeapon = item.subtype && (item.category === "Arma de Fogo" || item.category === "Arma Branca");
            const stats = isWeapon ? calculateWeaponPAT(item, activeChar) : null;
            
            const formatAttack = (s) => {
              if (!s) return "";
              const d = Math.round(s.dice);
              const p = Math.round(s.plus);
              const tpt = s.tpt || 1;
              return `${tpt}d${d}${p > 0 ? ` + ${p}` : ""}`;
            };
            
            const getTooltipText = (baseItem, weaponStats) => {
              let text = baseItem.description || '';
              if (weaponStats) {
                const d = Math.round(weaponStats.dice);
                const p = Math.round(weaponStats.plus);
                const tpt = weaponStats.tpt || 1;
                
                text += (text ? '\n\n' : '') + 
                  `**--ESTATÍSTICAS--**\n` +
                  `Dano (Base): **1d${weaponStats.baseDice.toFixed(2)}${weaponStats.basePlus > 0 ? ` + ${weaponStats.basePlus.toFixed(2)}` : ""}**\n` +
                  `Dano (Final): **1d${weaponStats.rawDice.toFixed(2)}${weaponStats.rawPlus > 0 ? ` + ${weaponStats.rawPlus.toFixed(2)}` : ""}**\n\n` +
                  `• Multiplicador de Dano: **${(weaponStats.damageMulti * 100).toFixed(0)}%**\n` +
                  (baseItem.category === "Arma de Fogo" ? `• Tiros por Turno (TPT): **${tpt}**\n` : "") +
                  `• Tier: **${baseItem.tier}** (x**${weaponStats.tierMult.toFixed(1)}**)\n` +
                  `• Upgrades: **+${baseItem.upgrade || 0}** (x**${weaponStats.upgradeMult.toFixed(2)}**)`;
              }
              return text;
            };

            return (
              <TooltipWrapper key={item.id || `equipped-${idx}`} text={getTooltipText(item, stats)}>
                <div className="shrink-0 bg-black/40 border border-blue-400/20 p-3 rounded-2xl flex flex-col items-center min-w-[120px] group/equip relative cursor-help">
                  <span className="text-[7px] font-black uppercase text-blue-400 mb-1 tracking-widest">Equipado</span>
                  <p className="text-[10px] font-bold text-white text-center truncate w-full px-2">
                    {item.name} {item.upgrade > 0 ? `+${item.upgrade}` : ''}
                  </p>
                  {stats && (
                    <div className="mt-1 flex flex-col items-center">
                      <span className="text-[9px] font-black text-red-500 font-mono">Ataque: {formatAttack(stats)}</span>
                      {/* Expanding details on hover */}
                      <div className="grid grid-rows-[0fr] group-hover/equip:grid-rows-[1fr] transition-all duration-300 ease-in-out w-full">
                        <div className="overflow-hidden">
                          <div className="pt-2 mt-2 border-t border-white/5 flex flex-col items-center gap-1">
                            <span className="text-[7px] text-zinc-500 uppercase font-bold">{item.subtype}</span>
                            <span className="text-[7px] text-zinc-500 uppercase font-bold">{item.tier} | {item.hands}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className={`w-10 h-0.5 mt-2 rounded-full ${rarityConfig[item.rarity]?.color.replace('text', 'bg') || 'bg-white'} opacity-50`} />
                </div>
              </TooltipWrapper>
            );
          })}
        </div>
      )}

      <div className="bg-zinc-900/50 p-8 rounded-[40px] border border-zinc-800 shadow-2xl relative">
        {/* HEADER */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex flex-col">
            <h3 className="font-black text-zinc-500 uppercase tracking-widest text-[13px] italic">Inventário</h3>
            <TooltipWrapper text={`Total: ${formatWeight(weightData.precise)}\nItens: ${formatWeight(weightData.items)}\nMunição: ${formatWeight(weightData.ammo)}`}>
              <p className={`text-[12px] font-black mt-1 cursor-help ${itemWeight > maxSlots ? 'text-red-500 animate-pulse' : 'text-zinc-500'}`}>
                Carga: {itemWeight} / {maxSlots} {hasBackpack && " (Mochila Ativa)"}
              </p>
            </TooltipWrapper>
          </div>
          {isActingAsMaster && (
            <button onClick={() => { playSound('random_button'); onAddItem(); }} className="bg-yellow-500/10 text-yellow-500 border border-yellow-500/30 px-4 py-1.5 rounded-full text-[10px] font-black uppercase hover:bg-yellow-500 hover:text-black transition-all">+ Novo Item</button>
          )}
        </div>

        {/* TABS */}
        <div className="flex gap-4 mb-2 border-b border-white/5 pb-4">
          {['Item', 'Equipamento', 'Consumível', 'Munição'].map(t => (
            <button key={t} onClick={() => { playSound('tab_change'); setTab(t); }}
              className={`text-[10px] font-black uppercase tracking-widest transition-all ${tab === t ? 'text-white border-b-2 border-red-600 pb-1' : 'text-zinc-600 hover:text-zinc-400'}`}>
              {t === 'Munição' ? 'Munições' : `${t}s`}
            </button>
          ))}
        </div>

        {/* LIST - RESTORED TO LINE DESIGN */}
        <div className="max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
          {tab === 'Consumível' ? (
            <p className="text-[10px] text-zinc-500 italic text-center py-10 uppercase font-black tracking-widest">Em desenvolvimento...</p>
          ) : tab === 'Munição' ? (
            <div className="space-y-1">
              {[...AMMUNITION_TYPES].sort((a, b) => {
                const qtyA = activeChar?.ammunition?.[a.id] || 0;
                const qtyB = activeChar?.ammunition?.[b.id] || 0;
                if (qtyA > 0 && qtyB === 0) return -1;
                if (qtyA === 0 && qtyB > 0) return 1;
                return 0;
              }).map(ammo => {
                const quantity = activeChar?.ammunition?.[ammo.id] || 0;
                return (
                  <div key={ammo.id} className={`group flex items-center justify-between py-5 border-b border-white/5 last:border-0 hover:bg-white/[0.02] px-3 transition-all ${quantity === 0 ? 'opacity-40 grayscale-[0.5]' : ''}`}>
                    <div className="flex items-center gap-5">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${quantity === 0 ? 'bg-zinc-900/50 grayscale' : 'bg-zinc-800/50'}`}>📦</div>
                      <div>
                        <TooltipWrapper text={ammo.description}>
                          <p className={`text-base font-bold cursor-help ${quantity === 0 ? 'text-zinc-500' : 'text-zinc-200'}`}>
                            {ammo.name}
                          </p>
                        </TooltipWrapper>
                        <div className="flex gap-3 items-center mt-1">
                          <span className={`text-[10px] font-black uppercase tracking-widest ${quantity === 0 ? 'text-zinc-600' : 'text-orange-500'}`}>
                            Carga: {formatWeight(ammo.weight)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-8">
                      <div className="flex flex-col items-end">
                        <span className={`text-[8px] font-black uppercase tracking-widest mb-1 ${quantity === 0 ? 'text-zinc-700' : 'text-zinc-600'}`}>Quantidade</span>
                        {isActingAsMaster && editingAmmoId === ammo.id ? (
                          <input
                            type="number"
                            autoFocus
                            value={editingAmmoVal}
                            onChange={(e) => setEditingAmmoVal(e.target.value)}
                            onBlur={async () => {
                              const valToSave = editingAmmoVal;
                              const newVal = parseInt(valToSave) || 0;
                              const newAmmoState = { ...(activeChar.ammunition || {}), [ammo.id]: newVal };
                              
                              setTempChar(prev => ({ ...prev, ammunition: newAmmoState }));
                              
                              if (!isEditing) {
                                const isNPC = !!activeChar.npc_id || !activeChar.discord_username;
                                const table = isNPC ? 'npcs' : 'characters';
                                await supabase.from(table).update({ ammunition: newAmmoState }).eq('id', activeChar.id);
                              }
                              
                              setEditingAmmoId(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                e.currentTarget.blur();
                              }
                            }}
                            className="bg-zinc-800 border border-yellow-500/50 text-yellow-500 font-black text-xl w-20 text-center rounded outline-none"
                          />
                        ) : (
                          <span 
                            onClick={() => {
                              if (isActingAsMaster) {
                                setEditingAmmoId(ammo.id);
                                setEditingAmmoVal(quantity.toString());
                              }
                            }}
                            className={`text-2xl font-black font-mono transition-all ${
                              quantity === 0 
                                ? 'text-zinc-600' 
                                : isActingAsMaster 
                                  ? 'text-yellow-500 cursor-pointer hover:scale-110' 
                                  : 'text-white'
                            }`}
                          >
                            {quantity}
                          </span>
                        )}
                      </div>

                      {/* Discard Action */}
                      {!isActingAsMaster && !isViewingOthers && quantity > 0 && (
                        <button 
                          onClick={async () => {
                            playSound('random_button');
                            const newAmmoState = { ...(activeChar.ammunition || {}), [ammo.id]: 0 };
                            setTempChar(prev => ({ ...prev, ammunition: newAmmoState }));
                            if (!isEditing) {
                              const isNPC = !!activeChar.npc_id || !activeChar.discord_username;
                              const table = isNPC ? 'npcs' : 'characters';
                              await supabase.from(table).update({ ammunition: newAmmoState }).eq('id', activeChar.id);
                            }
                          }} 
                          className="opacity-0 group-hover:opacity-100 bg-red-500/10 text-red-500 border border-red-500/30 px-3 py-1 rounded-lg text-[10px] font-black uppercase hover:bg-red-500 hover:text-white transition-all"
                        >
                          Descartar
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : filteredItems.length > 0 ? filteredItems.map((item) => (
            <div key={item.id || `item-${item.originalIdx}`} className="group flex items-center justify-between py-5 border-b border-white/5 last:border-0 hover:bg-white/[0.02] px-3 transition-all relative">
              
              {/* Equipped Indicator Dot */}
              {item.equipped && <div className="absolute left-0 w-1 h-8 bg-blue-500 rounded-full shadow-[0_0_12px_rgba(59,130,246,0.5)]" />}

              <div className="flex items-center gap-5">
                {/* Movement Controls (Visible on Hover) */}
                <div className="flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity pr-4 border-r border-white/5 text-zinc-600">
                  {(!isViewingOthers || isActingAsMaster) && (
                    <>
                      <button onClick={() => { playSound('random_button'); onMove(item.originalIdx, -1); }} className="hover:text-yellow-500 text-[10px]">▲</button>
                      <button onClick={() => { playSound('random_button'); onMove(item.originalIdx, 1); }} className="hover:text-yellow-500 text-[10px]">▼</button>
                    </>
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-2.5">
                    {(() => {
                      const isWeapon = item.subtype && (item.category === "Arma de Fogo" || item.category === "Arma Branca");
                      const stats = isWeapon ? calculateWeaponPAT(item, activeChar) : null;
                      
                      const getTooltipText = (baseItem, weaponStats) => {
                        let text = baseItem.description || '';
                        if (weaponStats) {
                          const d = Math.round(weaponStats.dice);
                          const p = Math.round(weaponStats.plus);
                          const tpt = weaponStats.tpt || 1;
                          
                          text += (text ? '\n\n' : '') + 
                            `**--ESTATÍSTICAS--**\n` +
                            `Dano (Base): **1d${weaponStats.baseDice.toFixed(2)}${weaponStats.basePlus > 0 ? ` + ${weaponStats.basePlus.toFixed(2)}` : ""}**\n` +
                            `Dano (Final): **1d${weaponStats.rawDice.toFixed(2)}${weaponStats.rawPlus > 0 ? ` + ${weaponStats.rawPlus.toFixed(2)}` : ""}**\n\n` +
                            `• Multiplicador de Dano: **${(weaponStats.damageMulti * 100).toFixed(0)}%**\n` +
                            (baseItem.category === "Arma de Fogo" ? `• Tiros por Turno (TPT): **${tpt}**\n` : "") +
                            `• Tier: **${baseItem.tier}** (x**${weaponStats.tierMult.toFixed(1)}**)\n` +
                            `• Upgrades: **+${baseItem.upgrade || 0}** (x**${weaponStats.upgradeMult.toFixed(2)}**)`;
                        }
                        return text;
                      };

                      return (
                        <TooltipWrapper text={getTooltipText(item, stats)}>
                          <p className={`text-base font-bold ${item.equipped ? 'text-blue-400' : 'text-zinc-200'} cursor-help`}>
                            {item.name} {item.upgrade > 0 ? `+${item.upgrade}` : ''}
                            {(item.amount > 1) && <span className="text-xs text-zinc-500 ml-2">x{item.amount}</span>}
                          </p>
                        </TooltipWrapper>
                      );
                    })()}
                    {item.isBackpack && <span className="text-[8px] bg-yellow-600/20 text-yellow-600 border border-yellow-600/30 px-1.5 py-0.5 rounded font-black uppercase">Mochila</span>}
                    {item.type === 'Equipamento' && !item.isBackpack && (
                      <>
                        <span className="text-[8px] bg-blue-600/20 text-blue-400 border border-blue-600/30 px-1.5 py-0.5 rounded font-black uppercase">
                          {item.hands === 'Duas Mãos' ? '2 Mãos' : '1 Mão'}
                        </span>
                        <span className="text-[8px] bg-purple-600/20 text-purple-400 border border-purple-600/30 px-1.5 py-0.5 rounded font-black uppercase">
                          Tier {typeof item.tier === 'string' ? item.tier.replace(/\D/g, '') : item.tier}
                        </span>
                      </>
                    )}
                  </div>
                  <div className="flex gap-3.5 items-center mt-1.5">
                    <span className={`text-[11px] font-black uppercase tracking-tighter ${rarityConfig[item.rarity]?.color}`}>{item.rarity}</span>
                    {(item.category === 'Arma Branca' || item.category === 'Arma de Fogo') && (() => {
                      const stats = calculateWeaponPAT(item, activeChar);
                      const d = Math.round(stats.dice);
                      const p = Math.round(stats.plus);
                      const tpt = stats.tpt || 1;
                      return (
                        <span className="text-[11px] font-black uppercase tracking-tighter text-red-600">
                          Ataque: {tpt}d{d}{p > 0 ? ` + ${p}` : ""}
                        </span>
                      );
                    })()}
                    <span className="text-[11px] font-black uppercase tracking-tighter text-zinc-500">
                      Val: {item.value}$
                    </span>
                    {(Number(item.carga) > 1) && (
                      <span className="text-[11px] font-black uppercase tracking-tighter text-orange-500">
                        Carga: {item.carga}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-5">
                {tab === 'Equipamento' && (!isViewingOthers || isActingAsMaster) && (
                  <button onClick={() => { playSound('random_button'); onEquip(item.originalIdx); }}
                    className={`text-[10px] font-black uppercase tracking-widest transition-all px-4 py-1.5 rounded-lg border ${
                      item.equipped
                      ? 'bg-blue-600 border-blue-400 text-white'
                      : 'bg-transparent border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-white'
                    }`}>
                    {item.equipped ? 'Remover' : 'Equipar'}
                  </button>
                )}
                {/* Master actions: Edit and Delete */}
                {isActingAsMaster && (
                  <div className="opacity-0 group-hover:opacity-100 flex items-center gap-2 transition-all">
                    <button
                      onClick={() => { playSound('random_button'); onEdit(item.originalIdx); }}
                      className="text-zinc-600 hover:text-yellow-500 transition-colors p-2"
                      title="Editar Item"
                    >
                      <span className="text-xl">✎</span>
                    </button>
                    <button onClick={() => { playSound('random_button'); onDelete(item.originalIdx); }} className="text-zinc-500 hover:text-red-500 text-2xl font-light px-2" title="Remover Item">×</button>
                  </div>
                )}
                {/* Player discard action (when not viewing others) */}
                {!isActingAsMaster && !isViewingOthers && (
                  <button 
                    onClick={() => { playSound('random_button'); onDelete(item.originalIdx); }} 
                    className="opacity-0 group-hover:opacity-100 bg-red-500/10 text-red-500 border border-red-500/30 px-3 py-1 rounded-lg text-[10px] font-black uppercase hover:bg-red-500 hover:text-white transition-all"
                  >
                    Descartar
                  </button>
                )}
              </div>
            </div>
          )) : (
            <p className="text-[12px] text-zinc-500 italic text-center py-10 uppercase font-black tracking-widest">Mochila Vazia</p>
          )}
        </div>
      </div>
    </div>
  );
}
