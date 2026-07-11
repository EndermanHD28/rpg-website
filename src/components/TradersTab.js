/* src/components/TradersTab.js */
"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useSound } from '../hooks/useSound';
import { RARITY_CONFIG } from '../constants/gameData';
import AddItemToTraderModal from './AddItemToTraderModal';
export default function TradersTab({ isActingAsMaster, showToast, setModal, closeModal, playerCharacter, itemLibrary = [] }) {
  const { playSound } = useSound();
  const [traders, setTraders] = useState([]);
  const [tradeRequests, setTradeRequests] = useState([]);
  const [npcs, setNpcs] = useState([]);
  const [activeTrader, setActiveTrader] = useState(null);
  const [activeTab, setActiveTab] = useState('Gerenciar'); // Just one tab really
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);

  useEffect(() => {
    fetchTraders();
    fetchNPCs();

    const tradersChannel = supabase.channel('traders_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'traders' }, () => fetchTraders())
      .subscribe();

    return () => {
      supabase.removeChannel(tradersChannel);
    };
  }, [isActingAsMaster, traders]);

  const fetchTraders = async () => {
    const { data, error } = await supabase.from('traders').select('*').order('name');
    if (!error) setTraders(data || []);
  };

  const fetchNPCs = async () => {
    const { data, error } = await supabase.from('npcs').select('id, name, image_url').order('name');
    if (!error) setNpcs(data || []);
  };

  const fetchTradeRequests = async () => {
    const { data, error } = await supabase.from('trade_requests')
      .select('*, characters(name), traders(name)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (!error) setTradeRequests(data || []);
  };

  const handleCreateTrader = () => {
    setModal({
      isOpen: true,
      title: "Novo Comerciante",
      customFields: (
        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Nome do Comerciante</label>
            <input id="trader-name" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-white outline-none focus:border-red-500" placeholder="Ex: Ferreiro da Vila" />
          </div>
          <div>
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Vincular a NPC (Opcional)</label>
            <select id="trader-npc" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-white outline-none focus:border-red-500">
              <option value="">Nenhum</option>
              {npcs.map(npc => <option key={npc.id} value={npc.id}>{npc.name}</option>)}
            </select>
          </div>
        </div>
      ),
      onConfirm: async () => {
        const nameInput = document.getElementById('trader-name');
        const npcInput = document.getElementById('trader-npc');
        if (!nameInput) return; // Guard clause

        const name = nameInput.value;
        const npc_id = npcInput ? npcInput.value || null : null;
        if (!name) return showToast("Nome é obrigatório");

        const { error } = await supabase.from('traders').insert([{ name, npc_id, items: [] }]);
        if (!error) {
          showToast("Comerciante Criado!");
          fetchTraders();
          closeModal();
        } else {
          showToast("Erro ao criar comerciante.");
        }
      }
    });
  };

  const handleAddItemToTrader = (trader) => {
    setActiveTrader(trader);
    setIsAddItemModalOpen(true);
  };

  const confirmAddItem = async (itemData) => {
    if (!activeTrader) return;

    let newItems = [...(activeTrader.items || [])];
    const existingIdx = newItems.findIndex(i => i.item_id === itemData.item_id);
    
    if (existingIdx >= 0) {
      newItems[existingIdx].qty += itemData.qty;
      newItems[existingIdx].price = itemData.price; // Update price to latest
    } else {
      newItems.push({ ...itemData, id: crypto.randomUUID() });
    }

    const { error } = await supabase.from('traders').update({ items: newItems }).eq('id', activeTrader.id);
    if (!error) {
      showToast("Item Adicionado!");
      const { data: updatedTrader } = await supabase.from('traders').select('*').eq('id', activeTrader.id).single();
      if (updatedTrader) {
        setActiveTrader(updatedTrader);
      }
      fetchTraders();
      setIsAddItemModalOpen(false);
    } else {
      showToast("Erro ao adicionar item.");
    }
  };

  const handleRemoveItemFromTrader = async (trader, index) => {
    const newItems = trader.items.filter((_, i) => i !== index);
    const { error } = await supabase.from('traders').update({ items: newItems }).eq('id', trader.id);
    if (!error) {
      showToast("Item Removido!");
      const { data: updatedTrader } = await supabase.from('traders').select('*').eq('id', trader.id).single();
      if (updatedTrader) setActiveTrader(updatedTrader);
      fetchTraders();
    }
  };

  const handleUpdateItemQty = async (trader, index, newQty) => {
    const qty = parseInt(newQty);
    if (isNaN(qty) || qty < 0) return;

    // Optimistic update
    const newItems = [...trader.items];
    newItems[index] = { ...newItems[index], qty };
    
    // Update local state immediately
    const updatedTrader = { ...trader, items: newItems };
    setActiveTrader(updatedTrader);
    
    // Update traders list to reflect change in the sidebar and other components
    // We trigger the state update for allTraders if passed or fetch if needed
    // In this app, fetchTraders() updates the parent state via realtime or direct call
    setTraders(prev => prev.map(t => t.id === trader.id ? updatedTrader : t));

    // Persist to database
    const { error } = await supabase.from('traders').update({ items: newItems }).eq('id', trader.id);
    if (!error) {
      // The realtime listener in TradersTab or Home will catch this and update allTraders
      // But we call fetchTraders just to be sure if realtime is slow
      fetchTraders();
    }
  };

  const handleUpdateTraderMoney = async (trader, newMoney) => {
    const dollars = parseInt(newMoney);
    if (isNaN(dollars) || dollars < 0) return;

    // Optimistic update
    const updatedTrader = { ...trader, dollars };
    setActiveTrader(updatedTrader);
    setTraders(prev => prev.map(t => t.id === trader.id ? updatedTrader : t));

    await supabase.from('traders').update({ dollars }).eq('id', trader.id);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-zinc-900/50 p-8 rounded-[40px] border border-zinc-800 gap-6">
        <div className="flex-1">
          <h2 className="text-4xl font-black italic text-white uppercase tracking-tighter">Comerciantes</h2>
          <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mt-2">Gerencie as lojas do RPG</p>
        </div>

        {isActingAsMaster && (
          <div className="flex gap-4">
            <button
              onClick={handleCreateTrader}
              className="bg-red-600 text-white px-8 py-3 rounded-full font-black uppercase text-xs hover:scale-105 transition-all shadow-lg"
            >
              + Novo Comerciante
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* TRADER LIST */}
        <div className="md:col-span-1 space-y-4">
          <h3 className="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-4">Lojas</h3>
          <div className="space-y-2">
            {traders.map(trader => {
              const npc = npcs.find(n => n.id === trader.npc_id);
              return (
                <div
                  key={trader.id}
                  onClick={() => { playSound('tab_change'); setActiveTrader(trader); }}
                  className={`p-4 rounded-3xl border transition-all cursor-pointer flex items-center gap-4 ${activeTrader?.id === trader.id ? 'bg-white border-white text-black' : 'bg-zinc-900/50 border-white/5 text-zinc-400 hover:border-white/20 hover:text-white'}`}
                >
                  <div className="w-10 h-10 rounded-full bg-zinc-800 overflow-hidden border border-white/10">
                    {npc?.image_url ? <img src={npc.image_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center">🏪</div>}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-black uppercase italic leading-none">{trader.name}</p>
                    <p className={`text-[8px] font-bold uppercase mt-1 ${activeTrader?.id === trader.id ? 'text-zinc-600' : 'text-zinc-500'}`}>
                      {trader.items?.length || 0} Itens
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* TRADER VIEW */}
        <div className="md:col-span-3">
          {activeTrader ? (
            <div className="bg-zinc-900/50 rounded-[40px] border border-white/5 overflow-hidden">
              <div className="bg-black/40 p-4 border-b border-white/5 flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <button
                    className="px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all bg-white text-black"
                  >
                    Estoque
                  </button>
                  {isActingAsMaster && (
                    <div className="flex items-center bg-black/40 border border-white/10 rounded-xl px-4 py-2">
                      <label className="text-[10px] font-black text-zinc-500 uppercase mr-3 tracking-widest">Saldo</label>
                      <span className="text-green-500 font-black mr-1">$</span>
                      <input 
                        type="number" 
                        min="0"
                        value={activeTrader.dollars || 0}
                        onChange={(e) => handleUpdateTraderMoney(activeTrader, e.target.value)}
                        className="bg-transparent text-white text-xs font-black outline-none focus:text-green-500 transition-colors w-24"
                      />
                    </div>
                  )}
                </div>
                {isActingAsMaster && (
                  <button
                    onClick={() => handleAddItemToTrader(activeTrader)}
                    className="bg-red-600/20 text-red-500 border border-red-500/50 px-4 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-red-600 hover:text-white transition-all"
                  >
                    + Add Item
                  </button>
                )}
              </div>

              <div className="p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {activeTrader.items?.length === 0 ? (
                    <p className="col-span-full text-center text-zinc-500 text-xs py-10 uppercase font-black tracking-widest">Este comerciante não tem itens</p>
                  ) : (
                    activeTrader.items.map((ti, idx) => {
                      const item = itemLibrary.find(i => i.id === ti.item_id || i.item_id === ti.item_id);
                      if (!item) return null;
                      return (
                        <div key={idx} className={`bg-black/40 p-4 rounded-2xl border border-white/5 flex items-center justify-between group ${ti.qty === 0 ? 'opacity-70' : ''}`}>
                          <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center text-lg border border-white/5 relative`}>
                              📦
                              <span className={`absolute -top-2 -right-2 ${ti.qty === 0 ? 'bg-red-900' : 'bg-zinc-800'} text-white border border-white/10 w-5 h-5 flex items-center justify-center rounded-full text-[8px] font-black`}>{ti.qty}</span>
                            </div>
                            <div>
                              <p className={`text-xs font-black uppercase ${ti.qty === 0 ? 'text-zinc-500' : (RARITY_CONFIG[item.rarity]?.text || 'text-white')}`}>{item.name}</p>
                              <p className={`text-[10px] font-bold tracking-wider ${ti.qty === 0 ? 'text-zinc-600' : 'text-green-500'}`}>${ti.price}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {isActingAsMaster && (
                              <>
                                <div className="flex items-center bg-black/40 border border-white/10 rounded-lg px-2 py-1">
                                  <label className="text-[8px] font-black text-zinc-500 uppercase mr-2">Qtd</label>
                                  <input 
                                    type="number" 
                                    min="0"
                                    value={ti.qty}
                                    onChange={(e) => handleUpdateItemQty(activeTrader, idx, e.target.value)}
                                    className="w-10 bg-transparent text-white text-[10px] font-bold outline-none focus:text-red-500 transition-colors"
                                  />
                                </div>
                                <button 
                                  onClick={() => handleRemoveItemFromTrader(activeTrader, idx)}
                                  className="bg-zinc-800 text-zinc-500 p-2 rounded-lg hover:text-red-500 hover:bg-zinc-700 transition-all"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center py-20 bg-zinc-900/20 rounded-[40px] border border-dashed border-zinc-800 text-center">
              <span className="text-5xl mb-6">🏪</span>
              <p className="text-zinc-500 font-black uppercase text-xs tracking-[0.2em]">Selecione um comerciante no menu ao lado</p>
            </div>
          )}
        </div>
      </div>

      <AddItemToTraderModal
        isOpen={isAddItemModalOpen}
        closeModal={() => setIsAddItemModalOpen(false)}
        library={itemLibrary}
        showToast={showToast}
        trader={activeTrader}
        onConfirm={confirmAddItem}
      />
    </div>
  );
}