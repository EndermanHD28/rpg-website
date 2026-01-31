"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import Inventory from '../components/InventoryTemp';
import MasterPanel from '../components/MasterPanel';
import { Toast, Modal } from '../components/UIElements';
import Celebration from '../components/Celebration';

const MASTER_DISCORD_ID = "501767960646647818";
const RANKS = ["E - Recruta", "D - Soldado", "C - Veterano", "B - Tenente", "A - Sargento", "S - Capitão"];
const LINHAGENS = ["Nenhuma", "Kamado", "Agatsuma", "Hashibira", "Tsugikuni", "Rengoku"];
const RESPIRACOES = ["Nenhuma", "Água", "Chama", "Trovão", "Fera", "Inseto", "Sol", "Lua", "Névoa"];
const CORES = ["Nenhuma", "Vermelha", "Azul", "Amarela", "Verde", "Cinza", "Preta", "Rosa", "Índigo", "Roxa"];
const ANOMALIAS_LIST = ["Fúria Total", "Carateca", "Vampirismo", "Deus do Sol", "Marca do Caçador", "Mundo Transparente"];

const CLASSES_LIST = ["Civil", "Aprendiz", "Caçador de Onis", "Tsuguko", "Hashira", "Exterminador"];
const SKILLS_LIST = [
  "Olfacto Aguçado",
  "Audição Aguçada",
  "Visão Aguçada",
  "Tato Aguçado",
  "Paladar Aguçado",
  "Resistência à Venenos",
  "Flexibilidade Extrema",
  "Mestre em Esgrima"
];

const RARITY_CONFIG = {
  "Comum": { color: "text-gray-400", hex: "#9ca3af" },
  "Raro": { color: "text-blue-400", hex: "#60a5fa" },
  "Épico": { color: "text-purple-400", hex: "#c084fc" },
  "Lendário": { color: "text-orange-400", hex: "#fb923c" }
};

const BASE_ITEMS = [
  { name: "Nichirin Básica", rarity: "Comum", value: 100 },
  { name: "Uniforme de Caçador", rarity: "Comum", value: 50 },
  { name: "Corvo de Ligação", rarity: "Raro", value: 500 },
  { name: "Medicina de Glicínia", rarity: "Épico", value: 1200 }
];

const getStatColor = (perc) => {
  const p = parseFloat(perc);
  if (p >= 30) return 'text-cyan-400';
  if (p >= 15) return 'text-green-400';
  if (p >= 10) return 'text-yellow-400';
  return 'text-red-700';
};

export default function Home() {
  const [user, setUser] = useState(null);
  const [character, setCharacter] = useState(null);
  const [tempChar, setTempChar] = useState(null);
  const [loading, setLoading] = useState(true);
  const [previewAsPlayer, setPreviewAsPlayer] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isViewingOnly, setIsViewingOnly] = useState(false);
  const [requests, setRequests] = useState([]);
  const [pendingRequest, setPendingRequest] = useState(null);
  const [allPlayers, setAllPlayers] = useState([]);
  const [now, setNow] = useState(Date.now());
  const [viewingTarget, setViewingTarget] = useState(null);
  const [globalLockUntil, setGlobalLockUntil] = useState(0);
  const [itemLibrary, setItemLibrary] = useState([]);
  const [showCelebration, setShowCelebration] = useState(false);

  const [toasts, setToasts] = useState([]);
  const [modal, setModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null, type: 'confirm', input: false, inputValue: '', fields: false });

  const formatHeight = (val) => {
    // Remove anything that isn't a number
    const digits = val.replace(/\D/g, '');
    if (!digits) return "";
    if (digits.length <= 1) return digits;
    if (digits.length === 2) return `${digits[0]},${digits[1]}`;
    // Formats 149 into 1,49m
    return `${digits[0]},${digits.slice(1, 3)}m`;
  };

  const showToast = (message) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };
  const closeModal = () => setModal(m => ({ ...m, isOpen: false, inputValue: '', fields: false }));

  const isMaster = user?.user_metadata?.sub === MASTER_DISCORD_ID;
  const isActingAsMaster = isMaster && !previewAsPlayer;
  const showMasterView = isMaster && !previewAsPlayer && !viewingTarget;
  const isViewingOthers = isMaster && !!viewingTarget;
  const activeChar = (isEditing || isViewingOnly) ? tempChar : character;

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // --- CELEBRATION LOGIC ---
  useEffect(() => {
    if (character?.needs_celebration) {
      // Logic: Only show if I am a player OR if I am the Master in Player Mode
      if (isMaster && !previewAsPlayer) return;

      setShowCelebration(true);
      showToast("✨ FICHA APROVADA PELO MESTRE! ✨");

      // Reset the flag in the database immediately
      supabase.from('characters')
        .update({ needs_celebration: false })
        .eq('id', user.id)
        .then();

      // Stop the particles after 6 seconds
      setTimeout(() => setShowCelebration(false), 6000);
    }
  }, [character?.needs_celebration, previewAsPlayer, isMaster, user?.id]);

  useEffect(() => {
    const fetchData = async () => {
      const { data: libraryData } = await supabase.from('items').select('*').order('name', { ascending: true });
      setItemLibrary(libraryData || []);
      const { data: { user: activeUser } } = await supabase.auth.getUser();
      setUser(activeUser);

      if (activeUser) {
        const targetId = viewingTarget || activeUser.id;
        let { data: char } = await supabase.from('characters').select('*').eq('id', targetId).maybeSingle();

        if (!char && !viewingTarget) {
          const { data: n } = await supabase.from('characters').insert([{ id: activeUser.id, discord_username: activeUser.user_metadata.full_name || activeUser.user_metadata.preferred_username, char_name: 'Novo Recruta', strength: 1, resistance: 1, aptitude: 1, agility: 1, precision: 1, intelligence: 1, luck: 1, charisma: 1, stat_points_available: 0, age: 0, height: '0,00m', class: 'Nenhuma', skills: [], anomalies: [], inventory: [] }]).select().single();
          char = n;
        }

        if (char) {
          setCharacter(char);
          if (!isEditing && !isViewingOnly) setTempChar(char);
        }

        const { data: req } = await supabase.from('change_requests').select('*').eq('player_id', activeUser.id).eq('status', 'pending').maybeSingle();
        setPendingRequest(req);
      }
      setLoading(false);
    };
    fetchData();

    const ch = supabase.channel('db')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'characters' }, (p) => {

        // 1. Keep your existing logic for the "Active" sheet
        if (p.new && p.new.id === (viewingTarget || user?.id)) {
          setCharacter(p.new);
          if (!isEditing && !isViewingOnly) setTempChar(p.new);
        }

        // 2. ADD THIS: Update the Master's player list in real-time
        if (isMaster) {
          setAllPlayers(prev => {
            if (p.eventType === 'UPDATE') {
              // Find the player in the list and update their data
              return prev.map(player => player.id === p.new.id ? p.new : player);
            }
            if (p.eventType === 'INSERT') {
              // Add new player to the list
              return [...prev, p.new].sort((a, b) => a.char_name.localeCompare(b.char_name));
            }
            if (p.eventType === 'DELETE') {
              // Remove deleted player
              return prev.filter(player => player.id === p.old.id);
            }
            return prev;
          });
        }
      }).on('postgres_changes', { event: '*', schema: 'public', table: 'change_requests' }, (p) => {
        if (isMaster) {
          if (p.eventType === 'INSERT') { setRequests(prev => [...prev, p.new]); setGlobalLockUntil(Date.now() + 500); }
          else if (p.eventType === 'UPDATE') setRequests(prev => prev.map(r => r.id === p.new.id ? p.new : r).filter(r => r.status === 'pending'));
          else if (p.eventType === 'DELETE') setRequests(prev => prev.filter(r => r.id !== p.old.id));
        }
        if (p.new?.player_id === user?.id || p.old?.player_id === user?.id) {
          if (p.eventType === 'DELETE' || p.new.status !== 'pending') setPendingRequest(null);
          else setPendingRequest(p.new);
        }
      }).subscribe();
    return () => supabase.removeChannel(ch);
  }, [user?.id, viewingTarget, isEditing, isViewingOnly, isMaster]);

  useEffect(() => {
    if (showMasterView) {
      supabase.from('change_requests').select('*').eq('status', 'pending').then(({ data }) => setRequests(data || []));
      supabase.from('characters').select('*').order('char_name', { ascending: true }).then(({ data }) => setAllPlayers(data || []));
    }
  }, [showMasterView]);

  const toggleEditMode = async () => {
    if (!isEditing && !isViewingOnly && pendingRequest && !isActingAsMaster) {
      setModal({
        isOpen: true,
        title: "Pedido Pendente",
        message: "Você já tem um pedido enviado. Deseja cancelar o pedido atual e editar novamente?",
        onConfirm: async () => {
          setTempChar(pendingRequest.new_data);
          await supabase.from('change_requests').delete().eq('id', pendingRequest.id);
          setIsEditing(true);
          closeModal();
        }
      });
      return;
    }

    if (isEditing) {
      if (JSON.stringify(character) === JSON.stringify(tempChar)) {
        setIsEditing(false);
        return;
      }

      setModal({
        isOpen: true,
        title: isActingAsMaster ? "Confirmar Alterações" : "Enviar Pedido",
        message: isActingAsMaster
          ? "Deseja aplicar estas alterações diretamente na ficha?"
          : "Deseja enviar estas alterações para a aprovação do Mestre?",
        onConfirm: async () => {
          closeModal();
          setLoading(true);

          if (isActingAsMaster) {
            const targetId = viewingTarget || user.id;
            const { error } = await supabase.from('characters').update({ ...tempChar, master_editing_id: null }).eq('id', targetId);
            if (viewingTarget) {
              await supabase.from('change_requests').update({ status: 'rejected' }).eq('player_id', viewingTarget).eq('status', 'pending');
            }
            if (!error) showToast("Ficha Sincronizada!");
          } else {
            const { error } = await supabase.from('change_requests').insert({
              player_id: user.id,
              player_name: user?.user_metadata?.full_name || user?.user_metadata?.preferred_username,
              old_data: character,
              new_data: tempChar,
              status: 'pending'
            });
            if (!error) showToast("Pedido Enviado!");
            else showToast("Erro ao enviar pedido.");
          }

          setIsEditing(false);
          setIsViewingOnly(false);
          setLoading(false);
        }
      });
    } else {
      if (isActingAsMaster && viewingTarget) {
        await supabase.from('characters').update({ master_editing_id: user.id }).eq('id', viewingTarget);
      }
      setIsEditing(true);
    }
  };

  const handleStatChange = (stat, val) => {
    if (val === "") { setTempChar({ ...tempChar, [stat]: "" }); return; }
    const nVal = parseInt(val) || 0;
    const keys = ['strength', 'resistance', 'aptitude', 'agility', 'precision', 'intelligence', 'luck', 'charisma'];
    const used = keys.reduce((acc, k) => acc + (((k === stat) ? nVal : (Number(tempChar[k]) || 0)) - character[k]), 0);
    if (isActingAsMaster || (character.stat_points_available - used >= 0)) {
      setTempChar({ ...tempChar, [stat]: nVal, stat_points_available: character.stat_points_available - used });
    }
  };

  const presence = (Number(activeChar?.strength) || 0) + (Number(activeChar?.resistance) || 0) + (Number(activeChar?.aptitude) || 0) + (Number(activeChar?.agility) || 0) + (Number(activeChar?.precision) || 0);
  const life = (Number(activeChar?.strength) || 0) + ((Number(activeChar?.resistance) || 0) * 4);
  const posture = ((Number(activeChar?.resistance) || 0) * 0.25) + (Number(activeChar?.aptitude) || 0);
  const getPerc = (val) => presence > 0 ? ((Number(val) / presence) * 100).toFixed(1) : "0.0";

  const StatLine = ({ label, statKey, isSpecial = false }) => {
    const val = activeChar?.[statKey] ?? "";
    const perc = getPerc(val || 0);
    return (
      <li className="flex justify-between items-center py-2 border-b border-white/5 last:border-0 uppercase font-bold text-xs">
        <span className="text-gray-400">{label}</span>
        <div className="flex gap-3 items-center">
          <span className={`text-[11px] font-mono font-bold ${isSpecial ? getStatColor(perc) : 'text-gray-400'}`}>
            {perc}%
          </span>
          {isEditing ? (
            <div className="flex items-center bg-black/40 rounded border border-white/10 overflow-hidden">
              <button onClick={() => handleStatChange(statKey, (Number(val) || 0) - 1)} className="px-3 py-1 hover:bg-white/10">-</button>
              <input type="number" value={val} onChange={(e) => handleStatChange(statKey, e.target.value)} className="w-10 text-center bg-transparent font-bold text-yellow-500 text-sm outline-none" />
              <button onClick={() => handleStatChange(statKey, (Number(val) || 0) + 1)} className="px-3 py-1 hover:bg-white/10">+</button>
            </div>
          ) : <span className="text-yellow-500 font-mono text-lg">{val || 0}</span>}
        </div>
      </li>
    );
  };

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-white italic uppercase tracking-widest">Carregando...</div>;
  if (!user) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <button
        onClick={() => supabase.auth.signInWithOAuth({
          provider: 'discord',
          options: {
            // This dynamically gets "http://localhost:3000" or "https://your-app.vercel.app"
            redirectTo: typeof window !== 'undefined' ? window.location.origin : ''
          }
        })}
        className="bg-[#5865F2] text-white px-8 py-3 rounded font-black uppercase cursor-pointer transition-all hover:scale-110"
      >
        Entrar com Discord
      </button>
    </div>
  );

  if (character?.master_editing_id && !isMaster) {
    return (
      <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-center p-6 text-white uppercase italic">
        <div className="text-6xl mb-6 animate-pulse">🔨</div>
        <h1 className="text-3xl font-black text-yellow-500">Ficha Bloqueada</h1>
        <p className="text-gray-400 text-[10px] font-bold mt-2">O Mestre está alterando sua ficha agora.</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        <header className="flex justify-between items-start mb-10 border-b border-slate-800 pb-4">
          <div><h1 className="text-2xl font-black text-yellow-500 italic uppercase tracking-tighter leading-none">KIMETSU NO YAIBA RPG</h1><p className="text-[10px] text-gray-500 font-bold italic mt-1 tracking-tighter uppercase leading-none">Logado: <span className="text-gray-200">@{user?.user_metadata?.full_name || user?.user_metadata?.preferred_username}</span></p></div>
          <button onClick={() => { supabase.auth.signOut(); window.location.reload(); }} className="text-[10px] text-red-500 font-bold underline uppercase cursor-pointer">Sair</button>
        </header>

        {showMasterView ? (
          <MasterPanel
            requests={requests} allPlayers={allPlayers} now={now} globalLock={globalLockUntil}
            onApprove={(req) => setModal({
              isOpen: true, title: "Aprovar", message: "Aplicar mudanças?",
              onConfirm: async () => {
                // FIX: Added object spread and needs_celebration: true
                await supabase.from('characters').update({ ...req.new_data, needs_celebration: true }).eq('id', req.player_id);
                await supabase.from('change_requests').update({ status: 'approved' }).eq('id', req.id);
                showToast("Aprovado!"); closeModal();
              }
            })}
            onReject={(id) => supabase.from('change_requests').update({ status: 'rejected' }).eq('id', id)}
            onVisualize={(p) => { setViewingTarget(p.id); setCharacter(p); setTempChar(p); }}
            onAddPS={(p) => setModal({
              isOpen: true,
              title: "PS",
              message: "Valor:",
              input: true,
              inputValue: '',
              setInputValue: (v) => setModal(m => ({ ...m, inputValue: v })),

              // FIX: Accept 'val' as a parameter here!
              onConfirm: async (val) => {
                const pointsToAdd = parseInt(val);

                if (isNaN(pointsToAdd)) {
                  showToast("Valor inválido!");
                  return;
                }

                const { error } = await supabase.from('characters')
                  .update({ stat_points_available: p.stat_points_available + pointsToAdd })
                  .eq('id', p.id);

                if (!error) {
                  showToast("PS Adicionado!");
                  closeModal();
                } else {
                  showToast("Erro ao atualizar.");
                }
              }
            })}
            onReset={(p) => setModal({ isOpen: true, title: "Reset", message: "Deseja resetar stats de @" + p.discord_username + "?", type: 'danger', onConfirm: async () => { await supabase.from('characters').update({ strength: 1, resistance: 1, aptitude: 1, agility: 1, precision: 1, intelligence: 1, luck: 1, charisma: 1, stat_points_available: 0, dollars: 0, age: 0, height: '0,00m', class: 'Nenhuma', rank: 'E - Recruta', breathing_lvl: 1, breathing_style: 'Nenhuma', skills: [], anomalies: [] }).eq('id', p.id); showToast("Resetado!"); closeModal(); } })}
            onDelete={(p) => setModal({ isOpen: true, title: "Deletar", message: "Deletar ficha de @" + p.discord_username + " permanentemente?", type: 'danger', onConfirm: async () => { await supabase.from('characters').delete().eq('id', p.id); showToast("Deletado!"); closeModal(); } })}
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8 animate-in slide-in-from-bottom-4 duration-700">
              <div className="bg-slate-900/50 p-10 rounded-[40px] border-2 border-slate-800 relative shadow-2xl">
                <div className="absolute top-8 right-8 flex flex-col gap-2 items-end z-20">
                  <button onClick={toggleEditMode} className={`w-44 text-[10px] font-black px-6 py-2 rounded-full uppercase cursor-pointer transition-all hover:scale-105 shadow-xl ${isEditing ? 'bg-green-600' : (pendingRequest && !isActingAsMaster ? 'bg-emerald-600' : 'bg-yellow-600 text-black')}`}>{isEditing ? "CONCLUIR" : (isViewingOnly ? "EDIÇÃO" : (pendingRequest && !isActingAsMaster ? "EDITAR PEDIDO" : "EDITAR"))}</button>
                  {isEditing && <button onClick={() => { setTempChar(character); setIsEditing(false); }} className="w-44 bg-red-900/40 text-red-500 text-[9px] font-bold px-4 py-2 rounded-full uppercase transition-all hover:bg-red-900/60 cursor-pointer">Cancelar</button>}
                </div>
                <div className="max-w-[calc(100%-180px)] mb-10">
                  {isEditing ? (
                    <input
                      type="text"
                      value={activeChar?.char_name || ""}
                      onChange={(e) => setTempChar({ ...tempChar, char_name: e.target.value })}
                      className="text-3xl md:text-5xl font-black text-yellow-500 italic uppercase tracking-tighter leading-tight bg-black/20 border-b-2 border-yellow-500/50 outline-none w-full placeholder:opacity-30"
                      placeholder="NOME DO PERSONAGEM"
                    />
                  ) : (
                    <h2 className="text-5xl font-black text-yellow-500 italic uppercase tracking-tighter leading-tight drop-shadow-md">{activeChar?.char_name}</h2>
                  )}
                  <p className="text-gray-500 text-[10px] font-bold uppercase mt-1 tracking-widest italic leading-none">ID: {isViewingOthers ? character?.discord_username : user?.user_metadata?.full_name || user?.user_metadata?.preferred_username}</p>
                </div>

                <div className="grid grid-cols-2 gap-x-10 gap-y-8 mt-4">
                  {/* LINHA 1: RANK | DÓLARES */}
                  <div className="space-y-1">
                    <span className="text-gray-500 text-[9px] font-black italic uppercase">RANK:</span>
                    {isEditing ? (
                      <select value={activeChar?.rank} onChange={(e) => setTempChar({ ...tempChar, rank: e.target.value })} className="bg-slate-800 border border-white/10 rounded px-3 py-2 w-full text-sm outline-none appearance-none">{RANKS.map(r => <option key={r} value={r}>{r}</option>)}</select>
                    ) : <p className="font-bold text-lg leading-none">{activeChar?.rank}</p>}
                  </div>

                  <div className="space-y-1">
                    <span className="text-gray-500 text-[9px] font-black italic uppercase">DÓLARES:</span>
                    {isEditing ? (
                      <input type="number" value={activeChar?.dollars ?? 0} onChange={(e) => setTempChar({ ...tempChar, dollars: parseInt(e.target.value) || 0 })} className="bg-slate-800 border border-white/10 rounded px-3 py-2 w-full text-sm outline-none" />
                    ) : <p className="font-bold text-lg leading-none">{activeChar?.dollars || 0}$</p>}
                  </div>

                  {/* LINHA 2: CLASSE | ALTURA */}
                  <div className="space-y-1">
                    <span className="text-gray-500 text-[9px] font-black italic uppercase">CLASSE:</span>
                    {isEditing ? (
                      <select value={activeChar?.class || ""} onChange={(e) => setTempChar({ ...tempChar, class: e.target.value })} className="bg-slate-800 border border-white/10 rounded px-3 py-2 w-full text-sm outline-none appearance-none">
                        <option value="">Selecionar Classe</option>
                        {CLASSES_LIST.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    ) : <p className="font-bold text-lg leading-none">{activeChar?.class || "Nenhuma"}</p>}
                  </div>

                  <div className="space-y-1">
                    <span className="text-gray-500 text-[9px] font-black italic uppercase">ALTURA:</span>
                    {isEditing ? (
                      <input type="text" value={activeChar?.height || ""} onChange={(e) => setTempChar({ ...tempChar, height: formatHeight(e.target.value) })} className="bg-slate-800 border border-white/10 rounded px-3 py-2 w-full text-sm outline-none" placeholder="Ex: 175" />
                    ) : <p className="font-bold text-lg leading-none">{activeChar?.height || "0,00m"}</p>}
                  </div>

                  {/* LINHA 3: RESPIRAÇÃO | IDADE */}
                  <div className="space-y-1">
                    <span className="text-gray-500 text-[9px] font-black italic uppercase leading-none">Respiração:</span>
                    {isEditing ? (
                      <div className="flex gap-2">
                        <select
                          value={activeChar?.breathing_style}
                          onChange={(e) => setTempChar({ ...tempChar, breathing_style: e.target.value })}
                          className="bg-slate-800 border border-white/10 rounded px-3 py-2 flex-1 text-sm outline-none appearance-none"
                        >
                          {RESPIRACOES.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                        <div className="relative">
                          <span className="absolute -top-3 left-0 text-[8px] text-gray-500 font-bold italic uppercase">Nível</span>
                          <input
                            type="number"
                            value={activeChar?.breathing_lvl ?? 1}
                            onChange={(e) => setTempChar({ ...tempChar, breathing_lvl: parseInt(e.target.value) || 1 })}
                            className="bg-slate-800 border border-white/10 rounded px-3 py-2 w-16 text-sm outline-none"
                          />
                        </div>
                      </div>
                    ) : (
                      <p className="font-bold text-lg leading-none">{activeChar?.breathing_style === "Nenhuma" ? "Nenhuma" : `${activeChar?.breathing_style} (Lvl.${activeChar?.breathing_lvl})`}</p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <span className="text-gray-500 text-[9px] font-black italic uppercase">IDADE:</span>
                    {isEditing ? (
                      <input
                        type="number"
                        value={activeChar?.age ?? ""}
                        onChange={(e) => setTempChar({ ...tempChar, age: e.target.value === "" ? "" : parseInt(e.target.value) })}
                        className="bg-slate-800 border border-white/10 rounded px-3 py-2 w-full text-sm outline-none"
                      />
                    ) : <p className="font-bold text-lg leading-none">{activeChar?.age || 0} anos</p>}
                  </div>

                  {/* LINHA 4: LINHAGEM | COR DE NICHIRIN */}
                  <div className="space-y-1">
                    <span className="text-gray-500 text-[9px] font-black italic uppercase">LINHAGEM:</span>
                    {isEditing ? (
                      <select value={activeChar?.bloodline} onChange={(e) => setTempChar({ ...tempChar, bloodline: e.target.value })} className="bg-slate-800 border border-white/10 rounded px-3 py-2 w-full text-sm outline-none appearance-none">{LINHAGENS.map(l => <option key={l} value={l}>{l}</option>)}</select>
                    ) : <p className="font-bold text-lg leading-none">{activeChar?.bloodline || "Nenhuma"}</p>}
                  </div>

                  <div className="space-y-1">
                    <span className="text-gray-500 text-[9px] font-black italic uppercase">COR DE NICHIRIN:</span>
                    {isEditing ? (
                      <select value={activeChar?.nichirin_color} onChange={(e) => setTempChar({ ...tempChar, nichirin_color: e.target.value })} className="bg-slate-800 border border-white/10 rounded px-3 py-2 w-full text-sm outline-none appearance-none">{CORES.map(c => <option key={c} value={c}>{c}</option>)}</select>
                    ) : <p className="font-bold text-lg leading-none">{activeChar?.nichirin_color || "Nenhuma"}</p>}
                  </div>
                </div>



                <div className="mt-8 p-6 bg-black/20 rounded-2xl border border-white/5">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-gray-500 text-[9px] font-black italic uppercase">Anomalias:</span>
                    {isEditing && (
                      <select
                        onChange={(e) => {
                          if (e.target.value && !(activeChar.anomalies || []).includes(e.target.value))
                            setTempChar({ ...tempChar, anomalies: [...(activeChar.anomalies || []), e.target.value] })
                        }}
                        className="bg-slate-800 text-[10px] rounded px-2 outline-none cursor-pointer appearance-none"
                      >
                        <option value="">ADICIONAR ANOMALIA</option>
                        {ANOMALIAS_LIST.filter(a => !(activeChar.anomalies || []).includes(a)).map(a => (<option key={a} value={a}>{a}</option>))}
                      </select>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {activeChar?.anomalies?.length > 0 ? (
                      activeChar.anomalies.map((anom, i) => (
                        <span key={i} className="text-xs text-gray-300 italic bg-white/5 px-2 py-1 rounded border border-white/5 flex items-center gap-2 leading-none">
                          {anom}
                          {isEditing && (<button onClick={() => setTempChar({ ...tempChar, anomalies: activeChar.anomalies.filter(a => a !== anom) })} className="text-red-500 cursor-pointer font-black ml-1 hover:scale-125 transition-all">×</button>)}
                        </span>
                      ))
                    ) : (<p className="text-xs text-gray-600 italic uppercase tracking-widest">Nenhuma detectada</p>)}
                  </div>
                </div>

                {/* SKILLS SECTION */}
                <div className="mt-4 p-6 bg-black/20 rounded-2xl border border-white/5">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-gray-500 text-[9px] font-black italic uppercase">Habilidades passivas:</span>
                    {isEditing && (
                      <select
                        onChange={(e) => {
                          if (e.target.value && !(activeChar.skills || []).includes(e.target.value))
                            setTempChar({ ...tempChar, skills: [...(activeChar.skills || []), e.target.value] })
                        }}
                        className="bg-slate-800 text-[10px] rounded px-2 outline-none cursor-pointer appearance-none"
                      >
                        <option value="">ADICIONAR HABILIDADE</option>
                        {SKILLS_LIST.filter(s => !(activeChar.skills || []).includes(s)).map(s => (<option key={s} value={s}>{s}</option>))}
                      </select>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {activeChar?.skills?.length > 0 ? (
                      activeChar.skills.map((skill, i) => (
                        <span key={i} className="text-xs text-cyan-200 italic bg-cyan-950/30 px-2 py-1 rounded border border-cyan-500/20 flex items-center gap-2 leading-none">
                          {skill}
                          {isEditing && (<button onClick={() => setTempChar({ ...tempChar, skills: activeChar.skills.filter(s => s !== skill) })} className="text-red-500 cursor-pointer font-black ml-1 hover:scale-125 transition-all">×</button>)}
                        </span>
                      ))
                    ) : (<p className="text-xs text-gray-600 italic uppercase tracking-widest">Nenhuma habilidade</p>)}
                  </div>
                </div>

                <div className="mt-12 grid grid-cols-3 gap-6 text-center">
                  <div className="bg-black/40 p-5 rounded-2xl border-2 border-red-600 shadow-lg"><p className="text-[10px] text-red-500 font-black italic mb-1">VIDA</p><p className="text-4xl font-black leading-none">{life}</p></div>
                  <div className="bg-black/40 p-5 rounded-2xl border-2 border-blue-500 shadow-lg"><p className="text-[10px] text-blue-500 font-black italic mb-1">PRESENÇA</p><p className="text-4xl font-black leading-none">{presence}</p></div>
                  <div className="bg-black/40 p-5 rounded-2xl border-2 border-green-500 shadow-lg"><p className="text-[10px] text-green-500 font-black italic mb-1">POSTURA</p><p className="text-4xl font-black leading-none">{posture.toFixed(1)}</p></div>
                </div>
              </div>

              <Inventory
                inventory={activeChar?.inventory || []} isActingAsMaster={isActingAsMaster} rarityConfig={RARITY_CONFIG}
                onMove={(idx, dir) => {
                  const targetIdx = idx + dir;
                  if (targetIdx < 0 || targetIdx >= (activeChar.inventory?.length || 0)) return;
                  const newList = [...(activeChar.inventory || [])];
                  const [movedItem] = newList.splice(idx, 1);
                  newList.splice(targetIdx, 0, movedItem);
                  setTempChar(prev => ({ ...prev, inventory: newList }));
                  if (!isEditing) {
                    setCharacter(prev => ({ ...prev, inventory: newList }));
                    supabase.from('characters').update({ inventory: newList }).eq('id', activeChar.id).then();
                  }
                }}
                onSort={(type) => {
                  const newList = [...(activeChar.inventory || [])];
                  newList.sort((a, b) => type === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name));
                  setTempChar(prev => ({ ...prev, inventory: newList }));
                  if (!isEditing) {
                    setCharacter(prev => ({ ...prev, inventory: newList }));
                    supabase.from('characters').update({ inventory: newList }).eq('id', activeChar.id).then();
                  }
                }}
                onDelete={(idx) => setModal({
                  isOpen: true, title: "Descartar", message: `Deseja jogar fora "${activeChar.inventory[idx].name}"?`, type: 'danger',
                  onConfirm: () => {
                    setTempChar(prev => {
                      const nl = [...(prev.inventory || [])];
                      nl.splice(idx, 1);
                      if (!isEditing) supabase.from('characters').update({ inventory: nl }).eq('id', activeChar.id).then();
                      return { ...prev, inventory: nl };
                    });
                    closeModal();
                  }
                })}
                onAddItem={() => setModal({
                  isOpen: true, title: "Novo Item", message: "Selecione ou crie um item:", fields: true, library: itemLibrary, rarityConfig: RARITY_CONFIG,
                  onConfirm: async (newItem) => {
                    if (!newItem.name) return;
                    const itemWithId = { ...newItem, id: Date.now() };
                    const nl = [...(activeChar.inventory || []), itemWithId];
                    setTempChar(prev => ({ ...prev, inventory: nl }));
                    if (!isEditing) setCharacter(prev => ({ ...prev, inventory: nl }));
                    const exists = itemLibrary.find(i => i.name.toLowerCase() === newItem.name.toLowerCase());
                    if (!exists) {
                      const { data: savedItem } = await supabase.from('items').insert([newItem]).select().single();
                      if (savedItem) setItemLibrary(prev => [...prev, savedItem].sort((a, b) => a.name.localeCompare(b.name)));
                    }
                    if (!isEditing) await supabase.from('characters').update({ inventory: nl }).eq('id', activeChar.id);
                    closeModal(); showToast("Item Adicionado!");
                  }
                })}
              />
            </div>

            <div className="bg-slate-900/50 p-8 rounded-[40px] border-2 border-slate-800 shadow-2xl h-fit sticky top-8">
              <div className="flex justify-between items-center mb-8 pb-3 border-b border-slate-800"><h3 className="font-black text-gray-500 text-[10px] italic">ATRIBUTOS</h3><div className="bg-yellow-500/10 px-4 py-2 rounded border border-yellow-500/30 font-black text-yellow-500 text-xs italic">{activeChar?.stat_points_available || 0} PS</div></div>
              <ul className="space-y-2">
                <StatLine label="Força" statKey="strength" />
                <StatLine label="Resistência" statKey="resistance" />
                <StatLine label="Aptidão" statKey="aptitude" />
                <StatLine label="Agilidade" statKey="agility" />
                <StatLine label="Precisão" statKey="precision" />
              </ul>
              <div className="mt-8 border-t border-slate-800 pt-6 uppercase italic text-[9px] text-cyan-500 font-black mb-4 tracking-widest">Especialidades</div>
              <ul className="space-y-2">
                <StatLine label="Inteligência" statKey="intelligence" isSpecial />
                <StatLine label="Sorte" statKey="luck" isSpecial />
                <StatLine label="Carisma" statKey="charisma" isSpecial />
              </ul>
            </div>
          </div>
        )}

        {isMaster && (
          <div className="fixed bottom-6 right-6 z-[120] flex flex-col gap-2 items-end animate-in fade-in slide-in-from-right-4">
            {viewingTarget ? (
              <button onClick={async () => { await supabase.from('characters').update({ master_editing_id: null }).eq('id', viewingTarget); setViewingTarget(null); setCharacter(null); setTempChar(null); }} className="w-44 py-3 rounded-full font-black text-[10px] uppercase bg-blue-600 text-white shadow-xl hover:bg-blue-500 transition-all cursor-pointer">Sair da Ficha</button>
            ) : (
              <button onClick={() => setPreviewAsPlayer(!previewAsPlayer)} className={`w-44 py-2 rounded-full font-bold text-[10px] uppercase border-2 shadow-2xl transition-all cursor-pointer ${previewAsPlayer ? 'bg-red-600 border-red-400' : 'bg-slate-800 border-slate-700'}`}>{previewAsPlayer ? "VOLTAR PARA MESTRE" : "MODO JOGADOR"}</button>
            )}
          </div>
        )}

        <Toast toasts={toasts} setToasts={setToasts} />
        <Modal modal={modal} closeModal={closeModal} />
        <Celebration active={showCelebration} />
      </div>
    </main>
  );
}