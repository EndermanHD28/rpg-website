/* src/components/NPCEditor.js */
"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useSound } from '../hooks/useSound';

export default function NPCEditor({ isActingAsMaster, showToast, setModal, closeModal }) {
  const { playSound } = useSound();
  const [npcs, setNpcs] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('Human'); // 'Human' or 'Oni'

  useEffect(() => {
    fetchNPCs();
  }, []);

  const fetchNPCs = async () => {
    const { data, error } = await supabase.from('npcs').select('*').order('name', { ascending: true });
    if (!error) setNpcs(data || []);
  };

  const handleCreateNPC = () => {
    setModal({
      isOpen: true,
      title: "Novo NPC",
      fields: true,
      npcFields: true,
      initialData: {
        npc_id: '',
        name: '',
        type: 'Simple',
        category: activeCategory,
        strength: 1,
        resistance: 1,
        aptitude: 1,
        agility: 1,
        precision: 1,
        armed_pat: '0',
        image_url: '',
        rank: activeCategory === 'Human' ? 'E - Recruta' : null,
        is_visible: false
      },
      onConfirm: async (data) => {
        const { error } = await supabase.from('npcs').insert([data]);
        if (!error) {
          showToast("NPC Criado!");
          fetchNPCs();
          closeModal();
        } else {
          console.error("DEBUG NPC ERROR:", error);
          showToast(`Erro: ${error.message || error.code || "Erro desconhecido"}`);
        }
      }
    });
  };

  const handleEditNPC = (npc) => {
    if (!isActingAsMaster) return;
    setModal({
      isOpen: true,
      title: `Editar NPC: ${npc.name}`,
      fields: true,
      npcFields: true,
      initialData: npc,
      onConfirm: async (data) => {
        const { error } = await supabase.from('npcs').update(data).eq('id', npc.id);
        if (!error) {
          showToast("NPC Atualizado!");
          fetchNPCs();
          closeModal();
        } else {
          showToast("Erro ao atualizar NPC.");
        }
      },
      onDelete: async () => {
        const { error } = await supabase.from('npcs').delete().eq('id', npc.id);
        if (!error) {
          showToast("NPC Excluído.");
          fetchNPCs();
          closeModal();
        }
      }
    });
  };

  const calculateSimpleStats = (npc) => {
    if (npc.type === 'Complex') return { life: '?', presence: '?', posture: '?', disarmed_pat: '?' };
    const s = Number(npc.strength) || 0;
    const r = Number(npc.resistance) || 0;
    const a = Number(npc.aptitude) || 0;
    const ag = Number(npc.agility) || 0;
    const p = Number(npc.precision) || 0;

    return {
      life: s + (r * 7),
      presence: s + r + a + ag + p,
      posture: (r * 1.2) + (a * 3.4),
      disarmed_pat: `1d${Math.floor((1.0 * s + 0.35 * r) * 4)}`
    };
  };

  const filteredNPCs = npcs.filter(npc => {
    const matchesSearch = npc.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = npc.category === activeCategory;
    const isVisible = isActingAsMaster || npc.is_visible;
    return matchesSearch && matchesCategory && isVisible;
  });

  const toggleVisibility = async (e, npc) => {
    e.stopPropagation();
    if (!isActingAsMaster) return;
    
    const newVisibility = !npc.is_visible;
    const { error } = await supabase.from('npcs').update({ is_visible: newVisibility }).eq('id', npc.id);
    
    if (!error) {
      showToast(newVisibility ? "NPC agora está Visível!" : "NPC agora está Oculto!");
      fetchNPCs();
    } else {
      showToast("Erro ao alterar visibilidade.");
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* HEADER & SEARCH */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-zinc-900/50 p-8 rounded-[40px] border border-zinc-800 gap-6">
        <div className="flex-1">
          <h2 className="text-4xl font-black italic text-white uppercase tracking-tighter">Editor de NPCs</h2>
          <div className="flex items-center gap-4 mt-2">
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest shrink-0">Gerenciamento de Ameaças</p>
            <input
              type="text"
              placeholder="Pesquisar NPCs..."
              className="bg-black/40 border border-white/5 rounded-full px-6 py-1.5 text-xs text-white outline-none focus:border-red-500/50 w-64"
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        
        <div className="flex gap-4">
          <div className="bg-black/40 p-1 rounded-2xl border border-white/5 flex">
            <button 
              onClick={() => { playSound('tab_change'); setActiveCategory('Human'); }}
              className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${activeCategory === 'Human' ? 'bg-white text-black' : 'text-zinc-500 hover:text-white'}`}
            >
              Humanos
            </button>
            <button 
              onClick={() => { playSound('tab_change'); setActiveCategory('Oni'); }}
              className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${activeCategory === 'Oni' ? 'bg-red-600 text-white' : 'text-zinc-500 hover:text-white'}`}
            >
              Onis
            </button>
          </div>
          {isActingAsMaster && (
            <div className="flex gap-2">
              <button
                onClick={handleCreateNPC}
                className="bg-red-600 text-white px-8 py-3 rounded-full font-black uppercase text-xs hover:scale-105 transition-all shadow-lg"
              >
                + Novo NPC
              </button>
              <button
                onClick={() => setModal({
                  isOpen: true,
                  title: "Importar NPCs via Código",
                  input: true,
                  inputValue: '',
                  setInputValue: (v) => setModal(prev => ({ ...prev, inputValue: v })),
                  message: "Cole o código JSON do pacote de NPCs abaixo:",
                  onConfirm: async (json) => {
                    try {
                      if (!json || typeof json !== 'string') throw new Error("Entrada inválida.");
                      const npcsData = JSON.parse(json.trim());
                      const npcsArray = Array.isArray(npcsData) ? npcsData : [npcsData];
                      
                      const preparedNPCs = npcsArray.map(npc => ({
                        npc_id: npc.npc_id,
                        name: npc.name || 'Novo NPC',
                        type: npc.type || 'Simple',
                        category: npc.category || 'Human',
                        strength: Number(npc.strength) || 1,
                        resistance: Number(npc.resistance) || 1,
                        aptitude: Number(npc.aptitude) || 1,
                        agility: Number(npc.agility) || 1,
                        precision: Number(npc.precision) || 1,
                        armed_pat: npc.armed_pat || '0',
                        image_url: npc.image_url || null,
                        rank: npc.rank || (npc.category === 'Human' ? 'E - Recruta' : null),
                        is_visible: !!npc.is_visible
                      }));

                      const { error } = await supabase.from('npcs').insert(preparedNPCs);
                      if (error) throw error;

                      showToast(`${preparedNPCs.length} NPCs Importados!`);
                      fetchNPCs();
                      closeModal();
                    } catch (err) {
                      showToast(`Erro na importação: ${err.message}`);
                    }
                  }
                })}
                className="bg-zinc-800 text-zinc-400 border border-zinc-700 px-6 py-3 rounded-full font-black uppercase text-[10px] hover:text-white hover:border-zinc-500 transition-all"
              >
                Importar Código
              </button>
            </div>
          )}
        </div>
      </div>

      {/* NPC GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredNPCs.map(npc => {
          const stats = calculateSimpleStats(npc);
          return (
            <div 
              key={npc.id}
              onClick={() => handleEditNPC(npc)}
              className={`bg-zinc-900/50 rounded-[30px] border border-white/5 overflow-hidden group hover:border-red-500/30 transition-all ${isActingAsMaster ? 'cursor-pointer' : ''}`}
            >
              {/* IMAGE HEADER */}
              <div className="h-40 bg-zinc-800 relative overflow-hidden">
                {npc.image_url ? (
                  <img src={npc.image_url} alt={npc.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-700 text-4xl">👤</div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 to-transparent" />
                <div className="absolute bottom-4 left-6">
                  <h3 className="text-xl font-black text-white uppercase italic leading-none">{npc.name}</h3>
                  {npc.category === 'Human' && npc.rank && (
                    <p className="text-[10px] font-black text-red-500 uppercase mt-1 tracking-widest">{npc.rank}</p>
                  )}
                </div>
                <div className="absolute top-4 right-6 bg-black/60 px-3 py-1 rounded-full border border-white/10">
                  <span className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">{npc.type === 'Simple' ? 'Simples' : 'Complexo'}</span>
                </div>

                {/* VISIBILITY TOGGLE (Master Only) */}
                {isActingAsMaster && (
                  <button
                    onClick={(e) => toggleVisibility(e, npc)}
                    className={`absolute top-4 left-6 p-2 rounded-full backdrop-blur-md border transition-all ${npc.is_visible ? 'bg-green-500/20 border-green-500/50 text-green-400' : 'bg-zinc-950/60 border-white/10 text-zinc-500'} hover:scale-110 z-10`}
                    title={npc.is_visible ? "Visível para jogadores" : "Oculto para jogadores"}
                  >
                    {npc.is_visible ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88 3.59 3.59"/><path d="M21 3.47 3.53 20.94"/><path d="M2 12s3-7 10-7a9.77 9.77 0 0 1 5 1.45"/><path d="M6.42 17.58A9.77 9.77 0 0 0 12 19c7 0 10-7 10-7a9.96 9.96 0 0 0-1.85-2.65"/><path d="M13.21 8.8a3 3 0 0 0-4.41 4.41"/><circle cx="12" cy="12" r="3" className="opacity-0"/></svg>
                    )}
                  </button>
                )}
              </div>

              {/* STATS CONTENT */}
              <div className="p-6 space-y-4">
                {npc.type === 'Simple' ? (
                  <>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-black/40 p-2 rounded-xl border border-white/5 text-center">
                        <p className="text-[8px] font-black text-red-500 uppercase mb-1">Vida</p>
                        <p className="text-sm font-bold">{stats.life}</p>
                      </div>
                      <div className="bg-black/40 p-2 rounded-xl border border-white/5 text-center">
                        <p className="text-[8px] font-black text-blue-500 uppercase mb-1">Presença</p>
                        <p className="text-sm font-bold">{stats.presence}</p>
                      </div>
                      <div className="bg-black/40 p-2 rounded-xl border border-white/5 text-center">
                        <p className="text-[8px] font-black text-green-500 uppercase mb-1">Postura</p>
                        <p className="text-sm font-bold">{Math.floor(stats.posture)}</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-[10px] font-bold uppercase text-zinc-500 border-b border-white/5 pb-1">
                        <span>Atributos</span>
                        <span>Valor</span>
                      </div>
                      <div className="grid grid-cols-5 gap-1">
                        {[
                          { label: 'FOR', val: npc.strength },
                          { label: 'RES', val: npc.resistance },
                          { label: 'APT', val: npc.aptitude },
                          { label: 'AGI', val: npc.agility },
                          { label: 'PRE', val: npc.precision }
                        ].map(s => (
                          <div key={s.label} className="text-center">
                            <p className="text-[7px] text-zinc-600 font-black">{s.label}</p>
                            <p className="text-[10px] font-bold text-white">{s.val}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <div className="flex-1 bg-black/40 p-2 rounded-xl border border-white/5 flex justify-between items-center px-4">
                        <span className="text-[8px] font-black text-zinc-500 uppercase">PAT Desarmado</span>
                        <span className="text-xs font-bold text-yellow-500">{stats.disarmed_pat}</span>
                      </div>
                      <div className="flex-1 bg-black/40 p-2 rounded-xl border border-white/5 flex justify-between items-center px-4">
                        <span className="text-[8px] font-black text-zinc-500 uppercase">PAT Armado</span>
                        <span className="text-xs font-bold text-orange-500">{npc.armed_pat ? (npc.armed_pat.startsWith('1d') ? npc.armed_pat : `1d${npc.armed_pat}`) : '0'}</span>
                      </div>
                    </div>

                    {isActingAsMaster && (
                      <div className="mt-2 pt-2 border-t border-white/5">
                        <p className="text-[8px] font-mono text-zinc-600 uppercase">ID Master: {npc.npc_id}</p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="h-32 flex flex-col items-center justify-center bg-black/20 rounded-2xl border border-white/5 border-dashed">
                    <span className="text-2xl mb-2">💎</span>
                    <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Complex Sheet Placeholder</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {filteredNPCs.length === 0 && (
          <div className="col-span-full py-20 text-center bg-zinc-900/20 rounded-[40px] border border-dashed border-zinc-800">
            <span className="text-4xl block mb-4">🌑</span>
            <p className="text-zinc-500 font-black uppercase text-[10px] tracking-widest">Nenhum NPC encontrado nesta categoria</p>
          </div>
        )}
      </div>
    </div>
  );
}
