"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useSound } from '../hooks/useSound';

export default function LootTableEditorModal({ isOpen, closeModal, library, showToast, initialData }) {
  const { playSound } = useSound();
  const [localData, setLocalData] = useState({
    id: '',
    name: '',
    min_rolls: 1,
    max_rolls: 1,
    min_extra_rolls: 0,
    max_extra_rolls: 0,
    extra_roll_chance: 0,
    items: []
  });

  const [editingItem, setEditingItem] = useState(null);
  const [isNew, setIsNew] = useState(true);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setLocalData({
          id: initialData.id || '',
          name: initialData.name || '',
          min_rolls: initialData.min_rolls || 1,
          max_rolls: initialData.max_rolls || 1,
          min_extra_rolls: initialData.min_extra_rolls || 0,
          max_extra_rolls: initialData.max_extra_rolls || 0,
          extra_roll_chance: initialData.extra_roll_chance || 0,
          items: initialData.items || []
        });
        setIsNew(false);
      } else {
        setLocalData({
          id: '',
          name: '',
          min_rolls: 1,
          max_rolls: 1,
          min_extra_rolls: 0,
          max_extra_rolls: 0,
          extra_roll_chance: 0,
          items: []
        });
        setIsNew(true);
      }
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleAddItem = () => {
    setEditingItem({
      item_id: '',
      minQty: 1,
      maxQty: 1,
      generalChance: 100,
      individualQtyChance: 10
    });
  };

  const saveItem = () => {
    if (!editingItem.item_id) return;
    setLocalData(prev => ({
      ...prev,
      items: [...prev.items, editingItem]
    }));
    setEditingItem(null);
  };

  const saveLootTable = async () => {
    if (!localData.name) {
      showToast("Nome é obrigatório");
      return;
    }
    
    const payload = { ...localData };
    
    if (isNew) {
      if (!payload.id) delete payload.id;
      const { error } = await supabase.from('loot_tables').insert(payload);
      if (!error) {
        showToast("Loot Table criada!");
        closeModal();
      } else {
        showToast("Erro ao criar: " + error.message);
      }
    } else {
      const { error } = await supabase.from('loot_tables').update(payload).eq('id', localData.id);
      if (!error) {
        showToast("Loot Table atualizada!");
        closeModal();
      } else {
        showToast("Erro ao atualizar: " + error.message);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={closeModal}></div>
      <div className="relative bg-slate-900 border-2 border-slate-800 p-8 rounded-[40px] max-w-2xl w-full shadow-2xl animate-in zoom-in-95 duration-200 overflow-y-auto max-h-[90vh] custom-scrollbar">
        <h3 className="text-2xl font-black italic uppercase tracking-tighter mb-6 text-yellow-500">
          Editor de Loot Table
        </h3>

        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-zinc-500">Nome (ex: residential.kitchen)</label>
              <input
                type="text"
                value={localData.name}
                onChange={(e) => setLocalData({ ...localData, name: e.target.value })}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-yellow-500"
                placeholder="residential.kitchen"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 bg-black/20 p-6 rounded-3xl border border-white/5">
            <div className="space-y-1">
              <label className="text-[8px] font-black uppercase text-zinc-500">Min Rolls</label>
              <input type="number" value={localData.min_rolls} onChange={(e) => setLocalData({...localData, min_rolls: parseInt(e.target.value) || 0})} className="w-full bg-slate-800 border border-white/10 rounded px-3 py-2 text-xs text-white" />
            </div>
            <div className="space-y-1">
              <label className="text-[8px] font-black uppercase text-zinc-500">Max Rolls</label>
              <input type="number" value={localData.max_rolls} onChange={(e) => setLocalData({...localData, max_rolls: parseInt(e.target.value) || 0})} className="w-full bg-slate-800 border border-white/10 rounded px-3 py-2 text-xs text-white" />
            </div>
            <div className="space-y-1">
              <label className="text-[8px] font-black uppercase text-zinc-500">Chance Extra (%)</label>
              <input type="number" value={localData.extra_roll_chance} onChange={(e) => setLocalData({...localData, extra_roll_chance: parseInt(e.target.value) || 0})} className="w-full bg-slate-800 border border-white/10 rounded px-3 py-2 text-xs text-white" />
            </div>
            <div className="space-y-1">
              <label className="text-[8px] font-black uppercase text-zinc-500">Min Extra Rolls</label>
              <input type="number" value={localData.min_extra_rolls} onChange={(e) => setLocalData({...localData, min_extra_rolls: parseInt(e.target.value) || 0})} className="w-full bg-slate-800 border border-white/10 rounded px-3 py-2 text-xs text-white" />
            </div>
            <div className="space-y-1">
              <label className="text-[8px] font-black uppercase text-zinc-500">Max Extra Rolls</label>
              <input type="number" value={localData.max_extra_rolls} onChange={(e) => setLocalData({...localData, max_extra_rolls: parseInt(e.target.value) || 0})} className="w-full bg-slate-800 border border-white/10 rounded px-3 py-2 text-xs text-white" />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="text-[10px] font-black uppercase text-zinc-400 tracking-widest italic">Itens da Tabela</h4>
              <button onClick={handleAddItem} className="bg-yellow-500 text-black px-4 py-1.5 rounded-full font-black uppercase text-[9px] hover:scale-105 transition-all">+ Add Item</button>
            </div>

            <div className="space-y-2">
              {localData.items.map((item, idx) => {
                const libItem = library.find(i => i.item_id === item.item_id);
                return (
                  <div key={idx} className="flex justify-between items-center bg-black/40 p-4 rounded-2xl border border-white/5 group">
                    <div>
                      <p className="text-xs font-bold text-white">{libItem?.name || item.item_id}</p>
                      <p className="text-[9px] text-zinc-500 font-bold uppercase">{item.minQty}-{item.maxQty} unidades • {item.generalChance}% base • {item.individualQtyChance}%/qtd</p>
                    </div>
                    <button onClick={() => setLocalData(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }))} className="text-red-500 opacity-0 group-hover:opacity-100 transition-all">×</button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {editingItem && (
          <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setEditingItem(null)}></div>
            <div className="relative bg-slate-800 p-8 rounded-[30px] border border-white/10 max-w-sm w-full shadow-2xl">
              <h5 className="text-lg font-black italic text-yellow-500 uppercase mb-4">Configurar Item</h5>
              <div className="space-y-4">
                <select 
                  value={editingItem.item_id} 
                  onChange={(e) => setEditingItem({...editingItem, item_id: e.target.value})}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-xs outline-none"
                >
                  <option value="">Selecionar Item...</option>
                  {library.map(i => <option key={i.item_id} value={i.item_id}>{i.name}</option>)}
                </select>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[8px] font-black uppercase text-zinc-500">Min Qty</label>
                    <input type="number" value={editingItem.minQty} onChange={(e) => setEditingItem({...editingItem, minQty: parseInt(e.target.value) || 1})} className="w-full bg-black/20 border border-white/5 rounded px-3 py-2 text-xs text-white" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-black uppercase text-zinc-500">Max Qty</label>
                    <input type="number" value={editingItem.maxQty} onChange={(e) => setEditingItem({...editingItem, maxQty: parseInt(e.target.value) || 1})} className="w-full bg-black/20 border border-white/5 rounded px-3 py-2 text-xs text-white" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[8px] font-black uppercase text-zinc-500">Chance Geral (%)</label>
                    <input type="number" value={editingItem.generalChance} onChange={(e) => setEditingItem({...editingItem, generalChance: parseInt(e.target.value) || 0})} className="w-full bg-black/20 border border-white/5 rounded px-3 py-2 text-xs text-white" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-black uppercase text-zinc-500">Chance Individual (%)</label>
                    <input type="number" value={editingItem.individualQtyChance} onChange={(e) => setEditingItem({...editingItem, individualQtyChance: parseInt(e.target.value) || 0})} className="w-full bg-black/20 border border-white/5 rounded px-3 py-2 text-xs text-white" />
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button onClick={() => setEditingItem(null)} className="flex-1 py-3 rounded-full bg-zinc-700 text-white font-black uppercase text-[10px]">Cancelar</button>
                  <button onClick={saveItem} className="flex-1 py-3 rounded-full bg-yellow-500 text-black font-black uppercase text-[10px]">Confirmar</button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-3 mt-10 border-t border-white/5 pt-8">
          <button onClick={closeModal} className="flex-1 py-4 rounded-full bg-slate-800 text-zinc-400 font-black uppercase text-[11px] hover:bg-slate-700 hover:text-white transition-all">Cancelar</button>
          <button onClick={saveLootTable} className="flex-1 py-4 rounded-full bg-yellow-500 text-black font-black uppercase text-[11px] hover:scale-105 transition-all">Salvar Loot Table</button>
        </div>
      </div>
    </div>
  );
}
