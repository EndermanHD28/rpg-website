/* src/components/InventoryTemp.js */
"use client";
import { useState } from 'react';

export default function Inventory({ inventory = [], isActingAsMaster, onDelete, onMove, onSort, onAddItem, onEquip, rarityConfig }) {
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
          {equippedItems.map((item) => (
            <div key={item.id || `equipped-${idx}`} className="shrink-0 bg-black/40 border border-blue-400/20 p-3 rounded-2xl flex flex-col items-center min-w-[110px]">
              <span className="text-[7px] font-black uppercase text-blue-400 mb-1 tracking-widest">Equipado</span>
              <p className="text-[10px] font-bold text-white text-center truncate w-full px-2">{item.name}</p>
              <div className={`w-10 h-0.5 mt-2 rounded-full ${rarityConfig[item.rarity]?.color.replace('text', 'bg') || 'bg-white'} opacity-50`} />
            </div>
          ))}
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
            <div key={item.id || `item-${item.originalIdx}`} className="group flex items-center justify-between py-4 border-b border-white/5 last:border-0 hover:bg-white/[0.02] px-2 transition-all relative">
              
              {/* Equipped Indicator Dot */}
              {item.equipped && <div className="absolute left-0 w-1 h-6 bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]" />}

              <div className="flex items-center gap-4">
                {/* Movement Controls (Visible on Hover) */}
                <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity pr-3 border-r border-white/5 text-zinc-600">
                  <button onClick={() => onMove(item.originalIdx, -1)} className="hover:text-yellow-500 text-[10px]">▲</button>
                  <button onClick={() => onMove(item.originalIdx, 1)} className="hover:text-yellow-500 text-[10px]">▼</button>
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <p className={`text-sm font-bold ${item.equipped ? 'text-blue-400' : 'text-zinc-200'}`}>{item.name}</p>
                    {item.isBackpack && <span className="text-[7px] bg-yellow-600/20 text-yellow-600 border border-yellow-600/30 px-1.5 py-0.5 rounded font-black uppercase">Mochila</span>}
                  </div>
                  <div className="flex gap-3 items-center mt-1">
                    <span className={`text-[10px] font-black uppercase tracking-tighter ${rarityConfig[item.rarity]?.color}`}>{item.rarity}</span>
                    <span className="text-[10px] font-bold text-zinc-600 font-mono italic">Val: {item.value}$</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                {tab === 'Equipamento' && (
                  <button onClick={() => onEquip(item.originalIdx)}
                    className={`text-[9px] font-black uppercase tracking-widest transition-all px-3 py-1 rounded border ${
                      item.equipped 
                      ? 'bg-blue-600 border-blue-400 text-white' 
                      : 'bg-transparent border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-white'
                    }`}>
                    {item.equipped ? 'Remover' : 'Equipar'}
                  </button>
                )}
                <button onClick={() => onDelete(item.originalIdx)} className="opacity-0 group-hover:opacity-100 text-zinc-700 hover:text-red-500 text-2xl font-light transition-all px-2">×</button>
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