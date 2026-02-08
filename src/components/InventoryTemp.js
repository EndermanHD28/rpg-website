/* src/components/InventoryTemp.js */
"use client";
import { useState } from 'react';
import { calculateWeaponPAT } from '../lib/rpg-math';

export default function Inventory({ inventory = [], activeChar, isActingAsMaster, onDelete, onMove, onSort, onAddItem, onEquip, onEdit, rarityConfig }) {
  const [tab, setTab] = useState('Item');

  const equippedItems = inventory.filter(i => i.equipped);
  const hasBackpack = inventory.some(item => item.isBackpack && item.equipped);
  const maxSlots = hasBackpack ? 15 : 4;
  const itemWeight = inventory.filter(item => (item.type || 'Item') === 'Item').length;

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
            const pat = isWeapon ? calculateWeaponPAT(item, activeChar) : null;
            
            return (
              <div key={item.id || `equipped-${idx}`} className="shrink-0 bg-black/40 border border-blue-400/20 p-3 rounded-2xl flex flex-col items-center min-w-[120px] group/equip relative">
                <span className="text-[7px] font-black uppercase text-blue-400 mb-1 tracking-widest">Equipado</span>
                <p className="text-[10px] font-bold text-white text-center truncate w-full px-2">
                  {item.name} {item.upgrade > 0 ? `+${item.upgrade}` : ''}
                </p>
                {pat && (
                  <div className="mt-1 flex flex-col items-center">
                    <span className="text-[9px] font-black text-red-500 font-mono">PAT: {pat}</span>
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
            );
          })}
        </div>
      )}

      <div className="bg-slate-900/50 p-8 rounded-[40px] border-2 border-slate-800 shadow-2xl relative">
        {/* HEADER */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex flex-col">
            <h3 className="font-black text-zinc-500 uppercase tracking-widest text-[10px] italic">Inventário</h3>
            <p className={`text-[10px] font-black mt-1 ${itemWeight > maxSlots ? 'text-red-500 animate-pulse' : 'text-zinc-500'}`}>
              Carga: {itemWeight} / {maxSlots} {hasBackpack && " (Mochila Ativa)"}
            </p>
          </div>
          {isActingAsMaster && (
            <button onClick={onAddItem} className="bg-yellow-500/10 text-yellow-500 border border-yellow-500/30 px-4 py-1.5 rounded-full text-[10px] font-black uppercase hover:bg-yellow-500 hover:text-black transition-all">+ Novo Item</button>
          )}
        </div>

        {/* TABS */}
        <div className="flex gap-4 mb-2 border-b border-white/5 pb-4">
          {['Item', 'Equipamento', 'Consumível'].map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`text-[10px] font-black uppercase tracking-widest transition-all ${tab === t ? 'text-white border-b-2 border-red-600 pb-1' : 'text-zinc-600 hover:text-zinc-400'}`}>
              {t}s
            </button>
          ))}
        </div>

        {/* LIST - RESTORED TO LINE DESIGN */}
        <div className="max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
          {tab === 'Consumível' ? (
            <p className="text-[10px] text-zinc-700 italic text-center py-10 uppercase font-black tracking-widest">Em desenvolvimento...</p>
          ) : filteredItems.length > 0 ? filteredItems.map((item) => (
            <div key={item.id || `item-${item.originalIdx}`} className="group flex items-center justify-between py-5 border-b border-white/5 last:border-0 hover:bg-white/[0.02] px-3 transition-all relative">
              
              {/* Equipped Indicator Dot */}
              {item.equipped && <div className="absolute left-0 w-1 h-8 bg-blue-500 rounded-full shadow-[0_0_12px_rgba(59,130,246,0.5)]" />}

              <div className="flex items-center gap-5">
                {/* Movement Controls (Visible on Hover) */}
                <div className="flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity pr-4 border-r border-white/5 text-zinc-600">
                  <button onClick={() => onMove(item.originalIdx, -1)} className="hover:text-yellow-500 text-[10px]">▲</button>
                  <button onClick={() => onMove(item.originalIdx, 1)} className="hover:text-yellow-500 text-[10px]">▼</button>
                </div>

                <div>
                  <div className="flex items-center gap-2.5">
                    <p className={`text-base font-bold ${item.equipped ? 'text-blue-400' : 'text-zinc-200'}`}>
                      {item.name} {item.upgrade > 0 ? `+${item.upgrade}` : ''}
                    </p>
                    {item.isBackpack && <span className="text-[8px] bg-yellow-600/20 text-yellow-600 border border-yellow-600/30 px-1.5 py-0.5 rounded font-black uppercase">Mochila</span>}
                    {item.type === 'Equipamento' && !item.isBackpack && (
                      <>
                        <span className="text-[8px] bg-blue-600/20 text-blue-400 border border-blue-600/30 px-1.5 py-0.5 rounded font-black uppercase">
                          {item.hands === 'Duas Mãos' ? '2 Mãos' : '1 Mão'}
                        </span>
                        <span className="text-[8px] bg-purple-600/20 text-purple-400 border border-purple-600/30 px-1.5 py-0.5 rounded font-black uppercase">
                          {item.tier?.replace('T', 'Tier ')}
                        </span>
                      </>
                    )}
                  </div>
                  <div className="flex gap-3.5 items-center mt-1.5">
                    <span className={`text-[11px] font-black uppercase tracking-tighter ${rarityConfig[item.rarity]?.color}`}>{item.rarity}</span>
                    {(item.category === 'Arma Branca' || item.category === 'Arma de Fogo') && (
                      <span className="text-[11px] font-black uppercase tracking-tighter text-red-600">
                        PAT: {calculateWeaponPAT(item, activeChar)}
                      </span>
                    )}
                    <span className="text-[11px] font-black uppercase tracking-tighter text-zinc-500">
                      Val: {item.value}$
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-5">
                {tab === 'Equipamento' && (
                  <button onClick={() => onEquip(item.originalIdx)}
                    className={`text-[10px] font-black uppercase tracking-widest transition-all px-4 py-1.5 rounded-lg border ${
                      item.equipped
                      ? 'bg-blue-600 border-blue-400 text-white'
                      : 'bg-transparent border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-white'
                    }`}>
                    {item.equipped ? 'Remover' : 'Equipar'}
                  </button>
                )}
                <div className="opacity-0 group-hover:opacity-100 flex items-center gap-2 transition-all">
                  <button
                    onClick={() => onEdit(item.originalIdx)}
                    className="text-zinc-600 hover:text-yellow-500 transition-colors p-2"
                    title="Editar Item"
                  >
                    <span className="text-xl">✎</span>
                  </button>
                  <button onClick={() => onDelete(item.originalIdx)} className="text-zinc-700 hover:text-red-500 text-2xl font-light px-2">×</button>
                </div>
              </div>
            </div>
          )) : (
            <p className="text-[10px] text-zinc-700 italic text-center py-10 uppercase font-black tracking-widest">Mochila Vazia</p>
          )}
        </div>
      </div>
    </div>
  );
}
