"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function AddItemToTraderModal({ isOpen, closeModal, library, showToast, trader, onConfirm }) {
  const [selectedItem, setSelectedItem] = useState('');
  const [price, setPrice] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (isOpen) {
      setSelectedItem('');
      setPrice(0);
      setQuantity(1);
      setSearchTerm('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleItemSelect = (itemId) => {
    const item = library.find(i => i.id === itemId);
    if (item) {
      setSelectedItem(item.id);
      setPrice(item.value || 0);
    }
  };

  const handleSave = () => {
    if (!selectedItem || isNaN(price) || isNaN(quantity) || quantity <= 0) {
      showToast("Por favor, selecione um item e defina preço e quantidade válidos.");
      return;
    }
    onConfirm({
      item_id: selectedItem,
      price: parseInt(price),
      qty: parseInt(quantity)
    });
  };
  
  const filteredLibrary = library.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={closeModal}></div>
      <div className="relative bg-slate-900 border-2 border-slate-800 p-8 rounded-[40px] max-w-2xl w-full shadow-2xl animate-in zoom-in-95 duration-200">
        <h3 className="text-2xl font-black italic uppercase tracking-tighter mb-6 text-yellow-500">
          Adicionar Item a {trader.name}
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left side - Item Selection */}
          <div className="flex flex-col gap-4">
            <input
              type="text"
              placeholder="Buscar item..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-yellow-500"
            />
            <div className="max-h-64 overflow-y-auto custom-scrollbar space-y-2 pr-2">
              {filteredLibrary.map(item => (
                <button
                  key={item.id}
                  onClick={() => handleItemSelect(item.id)}
                  className={`w-full text-left p-3 rounded-xl border transition-all ${selectedItem === item.id ? 'bg-yellow-500/20 border-yellow-500/50' : 'bg-black/40 border-white/10 hover:border-white/20'}`}
                >
                  <p className="text-xs font-bold">{item.name}</p>
                  <p className="text-[9px] text-zinc-400">${item.value || 0}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Right side - Details */}
          <div className="space-y-6">
            <div className="p-6 bg-black/20 rounded-3xl border border-white/5">
              <h4 className="text-[10px] font-black uppercase text-zinc-400 tracking-widest italic mb-4">Detalhes</h4>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[8px] font-black uppercase text-zinc-500">Preço de Venda</label>
                  <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className="w-full bg-slate-800 border border-white/10 rounded px-3 py-2 text-xs text-white" />
                </div>
                <div className="space-y-1">
                  <label className="text-[8px] font-black uppercase text-zinc-500">Quantidade</label>
                  <input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="w-full bg-slate-800 border border-white/10 rounded px-3 py-2 text-xs text-white" />
                </div>
              </div>
            </div>
            
            <div className="flex gap-3 mt-10 border-t border-white/5 pt-6">
              <button onClick={closeModal} className="flex-1 py-4 rounded-full bg-slate-800 text-zinc-400 font-black uppercase text-[11px] hover:bg-slate-700 hover:text-white transition-all">Cancelar</button>
              <button onClick={handleSave} className="flex-1 py-4 rounded-full bg-yellow-500 text-black font-black uppercase text-[11px] hover:scale-105 transition-all">Salvar Item</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
