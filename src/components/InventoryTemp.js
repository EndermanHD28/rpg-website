// src/components/InventoryTemp.js
"use client";

export default function Inventory({ inventory, isActingAsMaster, onDelete, onMove, onSort, onAddItem, rarityConfig }) {
  return (
    <div className="bg-slate-900/50 p-8 rounded-[40px] border-2 border-slate-800 shadow-2xl relative overflow-hidden">
      <div className="flex justify-between items-center mb-6 border-b border-white/5 pb-4">
        <div className="flex items-center gap-4">
          <h3 className="font-black text-gray-500 uppercase tracking-widest text-xs italic leading-none">Inventário</h3>
          <div className="flex gap-2">
            <button onClick={() => onSort('asc')} className="text-gray-500 hover:text-white transition-all cursor-pointer text-[10px] font-black uppercase tracking-tighter">A-Z ↓</button>
            <button onClick={() => onSort('desc')} className="text-gray-500 hover:text-white transition-all cursor-pointer text-[10px] font-black uppercase tracking-tighter">Z-A ↓</button>
          </div>
        </div>
        {isActingAsMaster && (
          <button onClick={onAddItem} className="bg-yellow-500/10 text-yellow-500 border border-yellow-500/30 px-3 py-1 rounded text-[10px] font-black uppercase hover:bg-yellow-500 hover:text-black transition-all cursor-pointer">+ ADICIONAR ITEM</button>
        )}
      </div>

      <div className="space-y-1 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
        {inventory?.length > 0 ? inventory.map((item, idx) => (
          <div key={item.id || idx} className="group flex items-center justify-between py-3 border-b border-white/5 last:border-0 hover:bg-white/[0.03] px-3 rounded-xl transition-all duration-150">
            <div className="flex items-center gap-4">
              <div className="flex flex-col gap-0.5 opacity-20 group-hover:opacity-100 transition-opacity pr-3 border-r border-white/10 text-gray-400">
                <button onClick={(e) => { e.preventDefault(); onMove(idx, -1); }} className="text-[12px] hover:text-yellow-500 cursor-pointer transition-all hover:scale-125 font-bold p-1 -m-1">▲</button>
                <div className="h-[1px] w-3 bg-white/20 mx-auto my-0.5"></div>
                <button onClick={(e) => { e.preventDefault(); onMove(idx, 1); }} className="text-[12px] hover:text-yellow-500 cursor-pointer transition-all hover:scale-125 font-bold p-1 -m-1">▼</button>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-100 leading-none mb-1.5">{item.name}</p>
                <div className="flex gap-3 items-center">
                  {/* RARITY SIZE 12 */}
                  <span className={`text-[12px] font-black uppercase tracking-widest ${rarityConfig[item.rarity]?.color || 'text-white'}`}>
                    {item.rarity}
                  </span>
                  {/* VAL EST. SIZE 12 */}
                  <span className="text-[12px] font-bold text-gray-500 uppercase italic">
                    Val Est.: <span className="text-[#4ade80] font-mono">{item.value}$</span>
                  </span>
                </div>
              </div>
            </div>
            <button onClick={() => onDelete(idx)} className="opacity-0 group-hover:opacity-100 text-red-900 hover:text-red-500 transition-all cursor-pointer font-black text-2xl px-2">×</button>
          </div>
        )) : (
          <p className="text-xs text-gray-600 italic text-center py-10 uppercase tracking-widest font-bold">Mochila Vazia</p>
        )}
      </div>
    </div>
  );
}