/* src/components/NPCEditor.js */
"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useSound } from '../hooks/useSound';
import { RARITY_CONFIG } from '../constants/gameData';
import { calculateAcerto, calculateDesvio, calculateBloqueio, calculateDisarmedPAT } from '../lib/rpg-math';

export default function NPCEditor({ isActingAsMaster, showToast, setModal, closeModal, onVisualizeComplex }) {
  const { playSound } = useSound();
  const [npcs, setNpcs] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('Human'); // 'Human' or 'Oni'
  const [expandedNPC, setExpandedNPC] = useState(null);
  const [isClosing, setIsClosing] = useState(false);

  const closeExpanded = () => {
    setIsClosing(true);
    setTimeout(() => {
      setExpandedNPC(null);
      setIsClosing(false);
    }, 150);
  };

  useEffect(() => {
    fetchNPCs();

    // Subscribe to realtime changes for the 'npcs' table
    const npcChannel = supabase.channel('npcs_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'npcs' }, (payload) => {
        console.log("NPC Realtime update received:", payload);
        if (payload.eventType === 'INSERT') {
          setNpcs(prev => [...prev, payload.new].sort((a, b) => a.name.localeCompare(b.name)));
        } else if (payload.eventType === 'UPDATE') {
          setNpcs(prev => prev.map(npc => npc.id === payload.new.id ? payload.new : npc));
        } else if (payload.eventType === 'DELETE') {
          setNpcs(prev => prev.filter(npc => npc.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(npcChannel);
    };
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
    if (npc.type === 'Complex') return { life: '?', presence: '?', posture: '?', disarmed_pat: '?', acerto: '?', desvio: '?', bloqueio: '?' };
    const s = Number(npc.strength) || 0;
    const r = Number(npc.resistance) || 0;
    const a = Number(npc.aptitude) || 0;
    const ag = Number(npc.agility) || 0;
    const p = Number(npc.precision) || 0;

    return {
      life: s + (r * 7),
      presence: s + r + a + ag + p,
      posture: 2 * (r * 1.2) + (a * 3.4),
      disarmed_pat: `1d${Math.floor(calculateDisarmedPAT(npc))}`,
      acerto: `1d${calculateAcerto(npc)}`,
      desvio: `1d${calculateDesvio(npc)}`,
      bloqueio: `1d${calculateBloqueio(npc)}`
    };
  };

  const filteredNPCs = npcs.filter(npc => {
    const matchesSearch = npc.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = npc.category === activeCategory;
    // Simple NPCs follow normal visibility rules for this list.
    // Complex NPCs only show up here if they are visible (Master always sees all).
    // Note: Players see Simple NPCs in this list if is_visible is true.
    // Complex NPCs are only shown in the Sidebar (Fichas) if is_visible is true.
    // In THIS list (NPCs tab), we only show Simple NPCs to players.
    const isVisible = isActingAsMaster || (npc.type === 'Simple' && npc.is_visible);
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
          <h2 className="text-4xl font-black italic text-white uppercase tracking-tighter">Biblioteca de NPCs</h2>
          <div className="flex items-center gap-4 mt-2">
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest shrink-0">Visualize os NPCs</p>
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
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {filteredNPCs.map(npc => {
          const stats = calculateSimpleStats(npc);
          return (
            <div
              key={npc.id}
              onClick={() => {
                if (npc.type === 'Complex' && onVisualizeComplex) {
                  onVisualizeComplex(npc);
                } else {
                  if (isActingAsMaster) {
                    handleEditNPC(npc);
                  } else {
                    setExpandedNPC(npc);
                  }
                }
              }}
              className={`bg-zinc-900/50 rounded-[30px] border border-white/5 overflow-hidden group hover:border-red-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer transform-gpu`}
            >
              {/* IMAGE HEADER */}
              <div 
                className="h-40 bg-zinc-800 relative overflow-hidden cursor-zoom-in transform-gpu"
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandedNPC(npc);
                }}
              >
                {npc.image_url ? (
                  <img
                    src={npc.image_url}
                    alt={npc.name}
                    className="w-full h-full object-cover object-[center_25%] group-hover:scale-110 transition-transform duration-500 transform-gpu"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-700 text-4xl">👤</div>
                )}
                <div className="absolute inset-0 -bottom-1 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent pointer-events-none group-hover:scale-110 transition-transform duration-500 transform-gpu" />
                <div className="absolute bottom-4 left-4">
                  <h3 className="text-xl font-black text-white uppercase italic leading-none">{npc.name}</h3>
                  {npc.category === 'Human' && npc.rank && (
                    <p className="text-[10px] font-black text-red-500 uppercase mt-1 tracking-widest">{npc.rank}</p>
                  )}
                </div>
                <div className="absolute top-4 right-4 bg-black/60 px-3 py-1 rounded-full border border-white/10">
                  <span className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">{npc.type === 'Simple' ? 'Simples' : 'Complexo'}</span>
                </div>

                {/* VISIBILITY TOGGLE (Master Only) */}
                {isActingAsMaster && (
                  <button
                    onClick={(e) => toggleVisibility(e, npc)}
                    className={`absolute top-4 left-4 p-2 rounded-full backdrop-blur-md border transition-all ${npc.is_visible ? 'bg-green-500/20 border-green-500/50 text-green-400' : 'bg-zinc-950/60 border-white/10 text-zinc-500'} hover:scale-110 z-10`}
                    title={npc.type === 'Simple' ? (npc.is_visible ? "Visível para jogadores (Chat NPCs)" : "Oculto para jogadores (Chat NPCs)") : (npc.is_visible ? "Visível para jogadores (Fichas)" : "Oculto para jogadores (Fichas)")}
                  >
                    {npc.is_visible ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88 3.59 3.59" /><path d="M21 3.47 3.53 20.94" /><path d="M2 12s3-7 10-7a9.77 9.77 0 0 1 5 1.45" /><path d="M6.42 17.58A9.77 9.77 0 0 0 12 19c7 0 10-7 10-7a9.96 9.96 0 0 0-1.85-2.65" /><path d="M13.21 8.8a3 3 0 0 0-4.41 4.41" /><circle cx="12" cy="12" r="3" className="opacity-0" /></svg>
                    )}
                  </button>
                )}
              </div>

              {/* STATS CONTENT */}
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-black/40 p-2 rounded-xl border border-white/5 text-center">
                    <p className="text-[8px] font-black text-red-500 uppercase mb-1">Vida</p>
                    <p className="text-sm font-bold">{stats.life !== '?' ? stats.life : Number(npc.strength) + (Number(npc.resistance) * 7)}</p>
                  </div>
                  <div className="bg-black/40 p-2 rounded-xl border border-white/5 text-center">
                    <p className="text-[8px] font-black text-blue-500 uppercase mb-1">Presença</p>
                    <p className="text-sm font-bold">{stats.presence !== '?' ? stats.presence : (Number(npc.strength) || 0) + (Number(npc.resistance) || 0) + (Number(npc.aptitude) || 0) + (Number(npc.agility) || 0) + (Number(npc.precision) || 0)}</p>
                  </div>
                  <div className="bg-black/40 p-2 rounded-xl border border-white/5 text-center">
                    <p className="text-[8px] font-black text-green-500 uppercase mb-1">Postura</p>
                    <p className="text-sm font-bold">{stats.posture !== '?' ? Math.floor(stats.posture) : Math.floor((Number(npc.resistance) * 1.2) + (Number(npc.aptitude) * 3.4))}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center text-[10px] font-bold uppercase text-zinc-500 border-b border-white/5 pb-1">
                    <span>Atributos</span>
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
                    <span className="text-[8px] font-black text-zinc-500 uppercase">Ataque (Desarmado)</span>
                    <span className="text-xs font-bold text-yellow-500">{stats.disarmed_pat}</span>
                  </div>
                  <div className="flex-1 bg-black/40 p-2 rounded-xl border border-white/5 flex justify-between items-center px-4">
                    <span className="text-[8px] font-black text-zinc-500 uppercase">Ataque (Armado)</span>
                    <span className="text-xs font-bold text-orange-500">{npc.armed_pat ? (npc.armed_pat.toString().startsWith('1d') ? npc.armed_pat : `1d${npc.armed_pat}`) : '0'}</span>
                  </div>
                </div>

                {npc.type === 'Simple' && (
                  <div className="grid grid-cols-3 gap-1">
                    <div className="bg-black/40 p-1.5 rounded-lg border border-white/5 text-center">
                      <p className="text-[6px] font-black text-purple-400 uppercase">Acerto</p>
                      <p className="text-[10px] font-bold">{stats.acerto}</p>
                    </div>
                    <div className="bg-black/40 p-1.5 rounded-lg border border-white/5 text-center">
                      <p className="text-[6px] font-black text-purple-400 uppercase">Desvio</p>
                      <p className="text-[10px] font-bold">{stats.desvio}</p>
                    </div>
                    <div className="bg-black/40 p-1.5 rounded-lg border border-white/5 text-center">
                      <p className="text-[6px] font-black text-purple-400 uppercase">Bloqueio</p>
                      <p className="text-[10px] font-bold">{stats.bloqueio}</p>
                    </div>
                  </div>
                )}

                {isActingAsMaster && (
                  <div className="mt-2 pt-2 border-t border-white/5">
                    <p className="text-[8px] font-mono text-zinc-600 uppercase">ID Master: {npc.npc_id}</p>
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

      {/* EXPANDED IMAGE OVERLAY */}
      {expandedNPC && (
        <div 
          className={`fixed inset-0 z-[2000] flex items-center justify-center p-4 md:p-8 ${isClosing ? 'animate-out fade-out' : 'animate-in fade-in'} duration-150`}
          onClick={closeExpanded}
        >
          <div className="absolute inset-0 bg-black/95 backdrop-blur-2xl"></div>
          
          <div 
            className={`relative max-w-6xl w-full bg-zinc-900/80 rounded-[40px] border border-white/10 overflow-hidden shadow-2xl flex flex-col md:flex-row ${isClosing ? 'animate-out zoom-out-95 slide-out-to-bottom-8' : 'animate-in zoom-in-95 slide-in-from-bottom-8'} duration-150 ease-out`}
            onClick={e => e.stopPropagation()}
          >
             {/* LEFT: IMAGE */}
             <div className="md:w-1/2 h-[40vh] md:h-[80vh] bg-black relative">
               {expandedNPC.image_url ? (
                 <img 
                   src={expandedNPC.image_url} 
                   alt={expandedNPC.name}
                   className="w-full h-full object-cover md:object-contain"
                 />
               ) : (
                 <div className="w-full h-full flex items-center justify-center text-zinc-800 text-9xl">👤</div>
               )}
               <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-transparent to-transparent md:hidden" />
             </div>

             {/* RIGHT: INFO */}
             <div className="md:w-1/2 p-8 md:p-12 flex flex-col justify-center space-y-8 overflow-y-auto max-h-[60vh] md:max-h-full custom-scrollbar">
                <div>
                  <h2 className="text-6xl font-black italic text-white uppercase tracking-tighter leading-none">{expandedNPC.name}</h2>
                  {expandedNPC.category === 'Human' && expandedNPC.rank && (
                    <p className="text-red-600 font-black uppercase tracking-[0.4em] text-lg mt-2">{expandedNPC.rank}</p>
                  )}
                  <p className="text-zinc-500 font-bold uppercase tracking-widest text-[10px] mt-4 border-l-2 border-red-600 pl-4">Ficha de Ameaça • {expandedNPC.type === 'Simple' ? 'Simples' : 'Complexo'}</p>
                </div>

                {expandedNPC.type === 'Simple' && (() => {
                  const stats = calculateSimpleStats(expandedNPC);
                  return (
                    <>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="bg-black/40 p-6 rounded-3xl border border-white/5 text-center shadow-inner">
                          <p className="text-[10px] font-black text-red-500 uppercase mb-2 tracking-widest">Vida</p>
                          <p className="text-4xl font-black text-white">{stats.life}</p>
                        </div>
                        <div className="bg-black/40 p-6 rounded-3xl border border-white/5 text-center shadow-inner">
                          <p className="text-[10px] font-black text-blue-500 uppercase mb-2 tracking-widest">Presença</p>
                          <p className="text-4xl font-black text-white">{stats.presence}</p>
                        </div>
                        <div className="bg-black/40 p-6 rounded-3xl border border-white/5 text-center shadow-inner">
                          <p className="text-[10px] font-black text-green-500 uppercase mb-2 tracking-widest">Postura</p>
                          <p className="text-4xl font-black text-white">{Math.floor(stats.posture)}</p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <p className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.3em] border-b border-white/5 pb-2">Atributos Primários</p>
                        <div className="grid grid-cols-5 gap-3">
                          {[
                            { label: 'FOR', val: expandedNPC.strength, color: 'text-red-500' },
                            { label: 'RES', val: expandedNPC.resistance, color: 'text-orange-500' },
                            { label: 'APT', val: expandedNPC.aptitude, color: 'text-blue-500' },
                            { label: 'AGI', val: expandedNPC.agility, color: 'text-green-500' },
                            { label: 'PRE', val: expandedNPC.precision, color: 'text-yellow-500' }
                          ].map(s => (
                            <div key={s.label} className="bg-black/20 p-3 rounded-2xl border border-white/5 text-center">
                              <p className="text-[8px] text-zinc-600 font-black mb-1">{s.label}</p>
                              <p className={`text-xl font-black ${s.color}`}>{s.val}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-black/40 p-5 rounded-3xl border border-white/5 flex flex-col items-center gap-1">
                          <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Dano Desarmado</span>
                          <span className="text-2xl font-black text-yellow-500">{stats.disarmed_pat}</span>
                        </div>
                        <div className="bg-black/40 p-5 rounded-3xl border border-white/5 flex flex-col items-center gap-1">
                          <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Dano Armado</span>
                          <span className="text-2xl font-black text-orange-500">{expandedNPC.armed_pat ? (expandedNPC.armed_pat.toString().startsWith('1d') ? expandedNPC.armed_pat : `1d${expandedNPC.armed_pat}`) : '0'}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div className="bg-black/40 p-5 rounded-3xl border border-white/5 flex flex-col items-center gap-1">
                          <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest">Acerto</span>
                          <span className="text-2xl font-black text-purple-200">{stats.acerto}</span>
                        </div>
                        <div className="bg-black/40 p-5 rounded-3xl border border-white/5 flex flex-col items-center gap-1">
                          <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest">Desvio</span>
                          <span className="text-2xl font-black text-purple-200">{stats.desvio}</span>
                        </div>
                        <div className="bg-black/40 p-5 rounded-3xl border border-white/5 flex flex-col items-center gap-1">
                          <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest">Bloqueio</span>
                          <span className="text-2xl font-black text-purple-200">{stats.bloqueio}</span>
                        </div>
                      </div>
                    </>
                  );
                })()}

                <div className="pt-4">
                  <button 
                    onClick={closeExpanded}
                    className="w-full bg-white text-black py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-red-600 hover:text-white transition-all shadow-xl"
                  >
                    Fechar Visualização
                  </button>
                </div>
             </div>
             
             <button 
               onClick={closeExpanded}
               className="absolute top-6 right-6 p-2 text-white/20 hover:text-white transition-colors z-10 bg-black/20 rounded-full backdrop-blur-md border border-white/10"
             >
               <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
             </button>
          </div>
        </div>
      )}
    </div>
  );
}
