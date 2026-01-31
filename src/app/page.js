"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

// --- CONSTANTS ---
const MASTER_DISCORD_ID = "501767960646647818";
const RANKS = ["E - Recruta", "D - Soldado", "C - Veterano", "B - Tenente", "A - Sargento", "S - Capitão"];
const LINHAGENS = ["Nenhuma", "Kamado", "Agatsuma", "Hashibira", "Tsugikuni", "Rengoku"];
const RESPIRACOES = ["Nenhuma", "Água", "Chama", "Trovão", "Fera", "Inseto", "Sol", "Lua", "Névoa"];
const CORES = ["Nenhuma", "Vermelha", "Azul", "Amarela", "Verde", "Cinza", "Preta", "Rosa", "Índigo", "Roxa"];
const ANOMALIAS_LIST = ["Fúria Total", "Carateca", "Vampirismo", "Deus do Sol", "Marca do Caçador", "Mundo Transparente"];

const getStatColor = (perc) => {
  const p = parseFloat(perc);
  if (p >= 30) return 'text-cyan-400';
  if (p >= 15) return 'text-green-400';
  if (p >= 10) return 'text-yellow-400';
  return 'text-red-700';
};

export default function Home() {
  // --- 1. STATE ---
  const [user, setUser] = useState(null);
  const [character, setCharacter] = useState(null);
  const [tempChar, setTempChar] = useState(null);
  const [loading, setLoading] = useState(true);
  const [previewAsPlayer, setPreviewAsPlayer] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isViewingOnly, setIsViewingOnly] = useState(false);
  const [requests, setRequests] = useState([]);
  const [pendingRequest, setPendingRequest] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [viewingTarget, setViewingTarget] = useState(null);
  const [globalLockUntil, setGlobalLockUntil] = useState(0);
  const [allPlayers, setAllPlayers] = useState([]);

  // --- NEW UI STATES (MODAL & TOAST) ---
  const [modal, setModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null, type: 'confirm', input: false, inputValue: '' });
  const [toasts, setToasts] = useState([]);

  const showToast = (message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  const closeModal = () => setModal(prev => ({ ...prev, isOpen: false, inputValue: '' }));

  // --- 2. PERMISSIONS & LOGIC ---
  const isMaster = user?.user_metadata?.sub === MASTER_DISCORD_ID;
  const isActingAsMaster = isMaster && !previewAsPlayer;
  const showMasterView = isMaster && !previewAsPlayer && !viewingTarget;
  const isViewingOthers = isMaster && !!viewingTarget;
  const activeChar = (isEditing || isViewingOnly) ? tempChar : character;

  // --- 3. TIMER & FETCH ---
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user: activeUser } } = await supabase.auth.getUser();
      setUser(activeUser);
      if (activeUser) {
        let { data: char } = await supabase.from('characters').select('*').eq('id', activeUser.id).maybeSingle();
        if (!char) {
          const { data: newChar, error: err } = await supabase.from('characters').insert([{
            id: activeUser.id,
            discord_username: activeUser.user_metadata.full_name || activeUser.user_metadata.preferred_username || 'User',
            char_name: 'Novo Recruta',
            strength: 1, resistance: 1, aptitude: 1, agility: 1, precision: 1, intelligence: 1, luck: 1, charisma: 1, stat_points_available: 0, anomalies: []
          }]).select().single();
          if (!err) char = newChar;
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

    const channel = supabase.channel('db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'characters' }, (payload) => {
        if (payload.new.id === (viewingTarget || user?.id)) {
          setCharacter(payload.new);
          if (!isEditing && !isViewingOnly) setTempChar(payload.new);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'change_requests' }, (payload) => {
        if (payload.new?.player_id === user?.id || payload.old?.player_id === user?.id) {
          if (payload.eventType === 'DELETE' || payload.new.status !== 'pending') setPendingRequest(null);
          else setPendingRequest(payload.new);
        }
        if (isMaster) {
          if (payload.eventType === 'INSERT') {
            setRequests(prev => [...prev, payload.new]);
            setGlobalLockUntil(Date.now() + 500);
          } else if (payload.eventType === 'UPDATE') {
            setRequests(prev => prev.map(r => r.id === payload.new.id ? payload.new : r).filter(r => r.status === 'pending'));
          } else if (payload.eventType === 'DELETE') {
            setRequests(prev => prev.filter(r => r.id !== payload.old.id));
          }
        }
      }).subscribe();
    return () => supabase.removeChannel(channel);
  }, [user?.id, isMaster, viewingTarget, isEditing, isViewingOnly]);

  useEffect(() => {
    if (showMasterView) {
      supabase.from('change_requests').select('*').eq('status', 'pending').then(({ data }) => setRequests(data || []));
      supabase.from('characters').select('*').order('char_name', { ascending: true }).then(({ data }) => setAllPlayers(data || []));
    }
  }, [showMasterView]);

  // --- 4. ACTIONS ---
  const login = () => supabase.auth.signInWithOAuth({ provider: 'discord', options: { redirectTo: window.location.origin } });
  const logout = async () => { await supabase.auth.signOut(); window.location.reload(); };

  const toggleEditMode = async () => {
    // If player wants to edit but has a pending request
    if (!isEditing && !isViewingOnly && pendingRequest && !isActingAsMaster) {
      setModal({
        isOpen: true,
        title: "Pedido Pendente",
        message: "Você já tem um pedido enviado. Deseja cancelá-lo para editar novamente?",
        type: "confirm",
        onConfirm: async () => {
          setTempChar(pendingRequest.new_data);
          await supabase.from('change_requests').delete().eq('id', pendingRequest.id);
          setPendingRequest(null);
          setIsEditing(true);
          closeModal();
        }
      });
      return;
    }

    if (isEditing) {
      const hasChanges = JSON.stringify(character) !== JSON.stringify(tempChar);
      if (!hasChanges) { setIsEditing(false); return; }

      setLoading(true);
      if (isActingAsMaster) {
        const targetId = viewingTarget || user.id;
        await supabase.from('characters').update({ ...tempChar, master_editing_id: null }).eq('id', targetId);
        if (viewingTarget) await supabase.from('change_requests').update({ status: 'rejected' }).eq('player_id', viewingTarget).eq('status', 'pending');
        showToast("Ficha atualizada diretamente!");
      } else {
        await supabase.from('change_requests').insert({
          player_id: user.id, player_name: user?.user_metadata?.full_name || user?.user_metadata?.preferred_username,
          old_data: character, new_data: tempChar, status: 'pending'
        });
        showToast("Mudanças enviadas para aprovação!");
      }
      setIsEditing(false);
      setIsViewingOnly(false);
      setLoading(false);
    } else {
      if (isActingAsMaster && viewingTarget) await supabase.from('characters').update({ master_editing_id: user.id }).eq('id', viewingTarget);
      setIsEditing(true);
      setIsViewingOnly(false);
    }
  };

  const handleApprove = (req) => {
    setModal({
      isOpen: true,
      title: 'Aprovar Mudanças',
      message: `Aplicar alterações para ${req.player_name}?`,
      type: 'confirm',
      onConfirm: async () => {
        setLoading(true);
        const { data: currentReq } = await supabase.from('change_requests').select('status').eq('id', req.id).maybeSingle();
        if (currentReq?.status === 'pending') {
          await supabase.from('characters').update(req.new_data).eq('id', req.player_id);
          await supabase.from('change_requests').update({ status: 'approved' }).eq('id', req.id);
          showToast("Ficha aprovada!");
        } else {
          showToast("Este pedido não é mais válido.", "error");
        }
        setLoading(false);
        closeModal();
      }
    });
  };

  const adminAddPS = (char) => {
    setModal({
      isOpen: true, title: 'Conceder PS', message: `Quanto PS para @${char.discord_username}?`, type: 'input', input: true,
      onConfirm: async (val) => {
        const amount = parseInt(val);
        if (isNaN(amount)) return;
        await supabase.from('characters').update({ stat_points_available: char.stat_points_available + amount }).eq('id', char.id);
        setAllPlayers(prev => prev.map(p => p.id === char.id ? { ...p, stat_points_available: p.stat_points_available + amount } : p));
        showToast(`${amount} PS concedidos!`);
        closeModal();
      }
    });
  };

  const adminReset = (char) => {
    setModal({
      isOpen: true, title: 'Resetar Jogador', message: `Limpar todos os stats de @${char.discord_username}?`, type: 'danger',
      onConfirm: async () => {
        await supabase.from('characters').update({
          strength: 1, resistance: 1, aptitude: 1, agility: 1, precision: 1, intelligence: 1, luck: 1, charisma: 1,
          stat_points_available: 0, dollars: 0, rank: 'E - Recruta', breathing_lvl: 1, breathing_style: 'Nenhuma', anomalies: []
        }).eq('id', char.id);
        showToast("Jogador resetado!");
        closeModal();
      }
    });
  };

  const adminDelete = (char) => {
    setModal({
      isOpen: true, title: 'Excluir Ficha', message: `Excluir @${char.discord_username} permanentemente?`, type: 'danger',
      onConfirm: async () => {
        await supabase.from('characters').delete().eq('id', char.id);
        setAllPlayers(prev => prev.filter(p => p.id !== char.id));
        showToast("Ficha deletada.");
        closeModal();
      }
    });
  };

  const handleStatChange = (stat, newValue) => {
    if (newValue === "") { setTempChar({ ...tempChar, [stat]: "" }); return; }
    const val = parseInt(newValue) || 0;
    const statsKeys = ['strength', 'resistance', 'aptitude', 'agility', 'precision', 'intelligence', 'luck', 'charisma'];
    const totalPSUsed = statsKeys.reduce((acc, k) => {
      const currentVal = (k === stat) ? val : (Number(tempChar[k]) || 0);
      return acc + (currentVal - character[k]);
    }, 0);
    if (isActingAsMaster || (character.stat_points_available - totalPSUsed >= 0)) {
      setTempChar({ ...tempChar, [stat]: val, stat_points_available: character.stat_points_available - totalPSUsed });
    }
  };

  const updateField = (f, v) => setTempChar(prev => ({ ...prev, [f]: (f === 'dollars' || f === 'breathing_lvl') ? (v === "" ? "" : parseInt(v) || 0) : v }));
  const removeAnomaly = (name) => setTempChar(prev => ({ ...prev, anomalies: (prev.anomalies || []).filter(a => a !== name) }));

  // --- MATH ---
  const s = Number(activeChar?.strength) || 0;
  const r = Number(activeChar?.resistance) || 0;
  const apt = Number(activeChar?.aptitude) || 0;
  const ag = Number(activeChar?.agility) || 0;
  const pr = Number(activeChar?.precision) || 0;
  const presence = s + r + apt + ag + pr;
  const life = s + (r * 4);
  const posture = (r * 0.25) + apt;
  const getPerc = (val) => presence > 0 ? ((Number(val) / presence) * 100).toFixed(1) : "0.0";

  const StatLine = ({ label, statKey, isSpecial = false }) => {
    const val = activeChar?.[statKey] ?? "";
    const perc = getPerc(val || 0);
    return (
      <li className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
        <span className="text-gray-400 text-xs font-bold uppercase">{label}:</span>
        <div className="flex items-center gap-3">
          <span className={`text-[10px] font-mono font-bold ${isSpecial ? getStatColor(perc) : 'text-gray-600'}`}>{perc}%</span>
          {isEditing ? (
            <div className="flex items-center bg-black/40 rounded border border-white/10 overflow-hidden">
              <button onClick={() => handleStatChange(statKey, (Number(val) || 0) - 1)} className="px-3 py-1 hover:bg-white/10">-</button>
              <input type="number" value={val} onChange={(e) => handleStatChange(statKey, e.target.value)} className="w-10 text-center bg-transparent font-bold text-yellow-500 text-sm outline-none" />
              <button onClick={() => handleStatChange(statKey, (Number(val) || 0) + 1)} className="px-3 py-1 hover:bg-white/10">+</button>
            </div>
          ) : <span className="font-mono text-lg text-yellow-500 font-bold">{val || 0}</span>}
        </div>
      </li>
    );
  };

  if (loading) return <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center text-white italic tracking-widest uppercase">Carregando...</div>;
  if (!user) return <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center"><button onClick={login} className="bg-[#5865F2] text-white px-8 py-3 rounded font-bold uppercase cursor-pointer">Entrar com Discord</button></div>;

  if (character?.master_editing_id && !isMaster) {
    return (
      <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-center p-6">
        <div className="text-6xl mb-6 animate-pulse">🔨</div>
        <h1 className="text-3xl font-black text-yellow-500 uppercase italic">Ficha Bloqueada</h1>
        <p className="text-gray-400 mt-2 max-w-xs uppercase font-bold text-[10px] tracking-widest">O Mestre está realizando alterações diretas na sua ficha agora.</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        <header className="flex justify-between items-start mb-10 border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-2xl font-black text-yellow-500 italic uppercase tracking-tighter leading-none">KIMETSU NO YAIBA RPG</h1>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-1 italic font-bold">Logado como: <span className="text-gray-300">{user?.user_metadata?.full_name || user?.user_metadata?.preferred_username}</span></p>
          </div>
          <button onClick={logout} className="text-[10px] text-red-500 font-bold underline uppercase hover:text-red-400 transition-colors cursor-pointer">Sair</button>
        </header>

        {showMasterView ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-500">
            <div className="lg:col-span-2 space-y-6">
              <h2 className="text-3xl font-black text-red-500 italic uppercase tracking-tighter">Pedidos de Mudança</h2>
              {requests.length === 0 ? <p className="text-gray-500 italic text-sm">Nenhum pedido pendente.</p> : (
                <div className="grid grid-cols-1 gap-4">
                  {requests.map((req) => {
                    const is3s = (now - new Date(req.created_at).getTime()) < 3000;
                    const isGL = now < globalLockUntil;
                    const disabled = is3s || isGL;
                    return (
                      <div key={req.id} className="bg-slate-900 p-6 rounded-2xl border border-red-500/30 flex flex-col gap-4 shadow-xl">
                        <div className="flex justify-between items-center">
                          <div><h3 className="text-xl font-bold text-white">{req.player_name}</h3><p className="text-[9px] text-gray-500 uppercase">Solicitou mudanças</p></div>
                          <div className="flex gap-3">
                            <button disabled={disabled} onClick={() => handleApprove(req)} className={`px-4 py-2 rounded font-bold text-xs uppercase transition-all ${disabled ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-green-600 hover:bg-green-500 cursor-pointer'}`}>Aprovar</button>
                            <button disabled={disabled} onClick={() => supabase.from('change_requests').update({ status: 'rejected' }).eq('id', req.id)} className={`px-4 py-2 rounded font-bold text-xs uppercase transition-all ${disabled ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-red-600 hover:bg-red-400 cursor-pointer'}`}>Recusar</button>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 bg-black/40 p-4 rounded-xl text-[10px] font-mono">
                          <div className="border-r border-white/5 pr-2 text-red-500 italic"><p className="mb-2 font-bold underline uppercase">Atual</p>{Object.keys(req.new_data).map(k => JSON.stringify(req.old_data[k]) !== JSON.stringify(req.new_data[k]) ? <p key={k}>{k}: {JSON.stringify(req.old_data[k])}</p> : null)}</div>
                          <div className="pl-2 text-green-500 italic"><p className="mb-2 font-bold underline uppercase">Novo</p>{Object.keys(req.new_data).map(k => JSON.stringify(req.old_data[k]) !== JSON.stringify(req.new_data[k]) ? <p key={k}>{k}: <span className="text-white font-bold">{JSON.stringify(req.new_data[k])}</span></p> : null)}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="bg-slate-900/50 p-6 rounded-[30px] border-2 border-slate-800 h-fit">
              <h3 className="font-black text-gray-500 uppercase tracking-widest text-xs mb-6 border-b border-slate-800 pb-2 italic">Lista de Jogadores</h3>
              <div className="space-y-3">
                {allPlayers.map(p => (
                  <div key={p.id} className="bg-black/20 p-4 rounded-xl border border-white/5 flex flex-col gap-3">
                    <div className="flex justify-between items-start">
                      <div><p className="text-sm font-black text-yellow-500 uppercase italic tracking-tighter">@{p.discord_username}</p><p className="text-[10px] text-gray-400 font-bold uppercase">Personagem: {p.char_name}</p></div>
                      <span className="text-[10px] bg-yellow-500/10 text-yellow-500 px-2 py-0.5 rounded border border-yellow-500/20 font-bold">{p.stat_points_available} PS</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => { setViewingTarget(p.id); setCharacter(p); setTempChar(p); }} className="text-[8px] font-bold bg-blue-600/20 text-blue-400 border border-blue-600/30 py-1.5 rounded hover:bg-blue-600 hover:text-white transition-all cursor-pointer">VISUALIZAR</button>
                      <button onClick={() => adminAddPS(p)} className="text-[8px] font-bold bg-green-600/20 text-green-400 border border-green-600/30 py-1.5 rounded hover:bg-green-600 hover:text-white transition-all cursor-pointer">+ PS</button>
                      <button onClick={() => adminReset(p)} className="text-[8px] font-bold bg-gray-600/20 text-gray-400 border border-gray-600/30 py-1.5 rounded hover:bg-gray-600 hover:text-white transition-all cursor-pointer">RESETAR</button>
                      <button onClick={() => adminDelete(p)} className="text-[8px] font-bold bg-red-600/20 text-red-400 border border-red-600/30 py-1.5 rounded hover:bg-red-600 hover:text-white transition-all cursor-pointer">EXCLUIR</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in slide-in-from-bottom-4 duration-700">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-slate-900/50 p-10 rounded-[40px] border-2 border-slate-800 shadow-2xl relative overflow-hidden">
                <div className="absolute top-8 right-8 flex flex-col gap-2 z-20 items-end">
                  <button onClick={toggleEditMode} className={`w-44 text-[10px] font-black px-6 py-2 rounded-full uppercase tracking-widest transition-all shadow-lg cursor-pointer ${isEditing ? 'bg-green-600 hover:bg-green-500 text-white' : (isViewingOnly ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : (pendingRequest && !isActingAsMaster ? 'bg-emerald-600 text-white' : 'bg-yellow-600 hover:bg-yellow-500 text-black'))}`}>
                    {isEditing ? "CONCLUIR" : (isViewingOnly ? "CONTINUAR EDIÇÃO" : (pendingRequest && !isActingAsMaster ? "EDITAR PEDIDO" : "EDITAR FICHA"))}
                  </button>
                  {(isEditing || isViewingOnly) && (
                    <>
                      {isEditing && (
                        <button onClick={() => { setIsEditing(false); setIsViewingOnly(true); }} className="w-44 bg-white/10 hover:bg-white/20 text-[9px] font-bold px-4 py-2 rounded-full uppercase transition-all cursor-pointer">
                          {isViewingOthers ? "PRÉVIA DAS ALTERAÇÕES" : "Ver Ficha"}
                        </button>
                      )}
                      <button onClick={() => { setTempChar({ ...character }); setIsEditing(false); setIsViewingOnly(false); }} className="w-44 bg-red-900/40 hover:bg-red-900/60 text-red-500 text-[9px] font-bold px-4 py-2 rounded-full uppercase transition-all cursor-pointer">Cancelar</button>
                    </>
                  )}
                </div>
                <div className="max-w-[calc(100%-180px)] mb-10">
                  <h2 className="text-5xl font-black text-yellow-500 italic uppercase tracking-tighter leading-tight drop-shadow-md">{activeChar?.char_name || "NOVO RECRUTA"}</h2>
                  <p className="text-gray-500 text-[10px] font-bold uppercase mt-1 tracking-widest italic">ID Discord: {isViewingOthers ? character?.discord_username : (user?.user_metadata?.full_name || user?.user_metadata?.preferred_username)}</p>
                </div>
                <div className="grid grid-cols-2 gap-x-10 gap-y-8">
                  <div className="space-y-1"><span className="text-gray-500 uppercase text-[9px] font-black block tracking-widest italic">Rank:</span>
                    {isEditing ? <select value={activeChar?.rank || ""} onChange={(e) => updateField('rank', e.target.value)} className="bg-slate-800 border border-white/10 rounded px-3 py-2 w-full text-sm outline-none">{RANKS.map(r => <option key={r} value={r}>{r}</option>)}</select> : <span className="font-bold text-lg uppercase text-white tracking-tight">{activeChar?.rank}</span>}
                  </div>
                  <div className="space-y-1"><span className="text-gray-500 uppercase text-[9px] font-black block tracking-widest italic">Dólares:</span>
                    {isEditing ? <input type="number" value={activeChar?.dollars ?? ""} onChange={(e) => updateField('dollars', e.target.value)} className="bg-slate-800 border border-white/10 rounded px-3 py-2 w-full text-sm outline-none" /> : <span className="font-bold text-white text-lg tracking-tight">{activeChar?.dollars || 0}$</span>}
                  </div>
                  <div className="space-y-1">
                    <span className="text-gray-500 uppercase text-[9px] font-black block tracking-widest italic">Respiração:</span>
                    {isEditing ? (
                      <div className="flex gap-2">
                        <select value={activeChar?.breathing_style || "Nenhuma"} onChange={(e) => updateField('breathing_style', e.target.value)} className="bg-slate-800 border border-white/10 rounded px-3 py-2 flex-1 text-sm outline-none">{RESPIRACOES.map(r => <option key={r} value={r}>{r}</option>)}</select>
                        <div className="w-20 relative"><span className="absolute -top-4 left-0 text-[8px] text-gray-500 font-black uppercase tracking-widest">Nível</span><input type="number" value={activeChar?.breathing_lvl ?? ""} onChange={(e) => updateField('breathing_lvl', e.target.value)} className="bg-slate-800 border border-white/10 rounded px-3 py-2 w-full text-sm outline-none" /></div>
                      </div>
                    ) : <span className="font-bold text-white text-lg tracking-tight">{activeChar?.breathing_style !== "Nenhuma" ? `${activeChar.breathing_style} (Lvl.${activeChar.breathing_lvl})` : 'Nenhuma'}</span>}
                  </div>
                  <div className="space-y-1"><span className="text-gray-500 uppercase text-[9px] font-black block tracking-widest italic">Linhagem:</span>
                    {isEditing ? <select value={activeChar?.bloodline || "Nenhuma"} onChange={(e) => updateField('bloodline', e.target.value)} className="bg-slate-800 border border-white/10 rounded px-3 py-2 w-full text-sm outline-none">{LINHAGENS.map(l => <option key={l} value={l}>{l}</option>)}</select> : <span className="font-bold text-lg text-white tracking-tight">{activeChar?.bloodline || "Nenhuma"}</span>}
                  </div>
                  <div className="col-span-full space-y-1">
                    <span className="text-gray-500 uppercase text-[9px] font-black block tracking-widest italic">Cor de Nichirin:</span>
                    {isEditing ? <select value={activeChar?.nichirin_color || "Nenhuma"} onChange={(e) => updateField('nichirin_color', e.target.value)} className="bg-slate-800 border border-white/10 rounded px-3 py-2 w-full text-sm outline-none">{CORES.map(c => <option key={c} value={c}>{c}</option>)}</select> : <span className="font-bold text-lg text-white tracking-tight">{activeChar?.nichirin_color || "Nenhuma"}</span>}
                  </div>
                </div>
                <div className="mt-8 p-6 bg-black/20 rounded-2xl border border-white/5">
                  <div className="flex justify-between items-center mb-3"><span className="text-gray-500 uppercase text-[9px] font-black block tracking-widest italic">Anomalias:</span>
                    {isEditing && <select onChange={(e) => { if (e.target.value && !(activeChar.anomalies || []).includes(e.target.value)) updateField('anomalies', [...(activeChar.anomalies || []), e.target.value]) }} className="bg-slate-800 text-[10px] text-white border border-white/10 rounded px-2 py-1 outline-none cursor-pointer"><option value="">+ ADICIONAR</option>{ANOMALIAS_LIST.filter(a => !(activeChar.anomalies || []).includes(a)).map(a => (<option key={a} value={a}>{a}</option>))}</select>}
                  </div>
                  <div className="flex flex-wrap gap-2">{activeChar?.anomalies?.length > 0 ? activeChar.anomalies.map((anom, i) => <span key={i} className="text-xs text-gray-300 italic bg-white/5 px-2 py-1 rounded border border-white/5 flex items-center gap-2">{anom}{isEditing && <button onClick={() => removeAnomaly(anom)} className="text-red-500 cursor-pointer font-bold ml-1 hover:text-red-300 hover:scale-125 transition-all">×</button>}</span>) : <p className="text-xs text-gray-500 italic">Nenhuma detectada</p>}</div>
                </div>
                <div className="mt-12 grid grid-cols-3 gap-6 text-center">
                  <div className="bg-black/40 p-5 rounded-2xl border-2 border-red-600 shadow-lg"><p className="text-[10px] text-red-500 font-black uppercase tracking-widest italic">Vida</p><p className="text-4xl font-black text-white tracking-tighter">{life}</p></div>
                  <div className="bg-black/40 p-5 rounded-2xl border-2 border-blue-500 shadow-lg"><p className="text-[10px] text-blue-500 font-black uppercase tracking-widest italic">Presença</p><p className="text-4xl font-black text-white tracking-tighter">{presence}</p></div>
                  <div className="bg-black/40 p-5 rounded-2xl border-2 border-green-500 shadow-lg"><p className="text-[10px] text-green-500 font-black uppercase tracking-widest italic">Postura</p><p className="text-4xl font-black text-white tracking-tighter">{posture.toFixed(1)}</p></div>
                </div>
              </div>
            </div>
            <div className="bg-slate-900/50 p-8 rounded-[40px] border-2 border-slate-800 shadow-2xl h-fit">
              <div className="flex justify-between items-center mb-8 pb-3 border-b border-slate-800"><h3 className="font-black text-gray-500 uppercase tracking-widest text-[10px] italic">Atributos</h3><div className="bg-yellow-500/10 px-4 py-2 rounded border border-yellow-500/30"><span className="text-yellow-500 font-black text-xs italic">{activeChar?.stat_points_available || 0} PS</span></div></div>
              <ul className="space-y-2"><StatLine label="Força" statKey="strength" /><StatLine label="Resistência" statKey="resistance" /><StatLine label="Aptidão" statKey="aptitude" /><StatLine label="Agilidade" statKey="agility" /><StatLine label="Precisão" statKey="precision" /></ul>
              <div className="mt-10 pt-6 border-t border-slate-800"><p className="text-[9px] text-cyan-500 font-black uppercase mb-4 tracking-widest italic">Especialidades</p><ul className="space-y-2"><StatLine label="Inteligência" statKey="intelligence" isSpecial /><StatLine label="Sorte" statKey="luck" isSpecial /><StatLine label="Carisma" statKey="charisma" isSpecial /></ul></div>
            </div>
          </div>
        )}

        {/* --- FLOATING CONTROLS --- */}
        {isMaster && (
          <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 items-end">
            {viewingTarget ? (
              <button onClick={async () => { await supabase.from('characters').update({ master_editing_id: null }).eq('id', viewingTarget); setViewingTarget(null); setCharacter(null); setTempChar(null); }} className="w-44 py-3 rounded-full font-black text-[10px] uppercase bg-blue-600 text-white shadow-xl hover:bg-blue-500 transition-all cursor-pointer">Sair da Ficha</button>
            ) : (
              <button onClick={() => { setPreviewAsPlayer(!previewAsPlayer); setIsEditing(false); setIsViewingOnly(false); }} className={`w-44 py-2 rounded-full font-bold text-[10px] uppercase border-2 shadow-2xl transition-all cursor-pointer ${previewAsPlayer ? 'bg-red-600 border-red-400 hover:bg-red-500' : 'bg-slate-800 border-slate-700 hover:bg-slate-700'}`}>{previewAsPlayer ? "VOLTAR PARA MESTRE" : "MODO JOGADOR"}</button>
            )}
          </div>
        )}

        {/* --- CUSTOM TOAST SYSTEM --- */}
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-3 pointer-events-none">
          {toasts.map(t => (
            <div key={t.id} onClick={(e) => { e.stopPropagation(); setToasts(prev => prev.filter(x => x.id !== t.id)); }} className="pointer-events-auto cursor-pointer animate-in slide-in-from-top-4 bg-slate-900 border-l-4 border-yellow-500 px-6 py-3 rounded shadow-2xl flex items-center gap-4 min-w-[300px]">
              <div className="text-yellow-500 font-black italic">!</div><p className="text-xs font-bold uppercase tracking-widest text-gray-200">{t.message}</p>
            </div>
          ))}
        </div>

        {/* --- CUSTOM MODAL SYSTEM --- */}
        {modal.isOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={closeModal}></div>
            <div className="relative bg-slate-900 border-2 border-slate-800 p-8 rounded-[40px] max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
              <h3 className={`text-2xl font-black italic uppercase tracking-tighter mb-2 ${modal.type === 'danger' ? 'text-red-500' : 'text-yellow-500'}`}>{modal.title}</h3>
              <p className="text-gray-400 text-sm font-bold mb-6 leading-relaxed uppercase tracking-tight italic">{modal.message}</p>
              {modal.input && <input autoFocus type="number" value={modal.inputValue} onChange={(e) => setModal({...modal, inputValue: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white mb-6 outline-none focus:border-yellow-500 transition-colors" placeholder="0" />}
              <div className="flex gap-3">
                <button onClick={closeModal} className="flex-1 px-6 py-3 rounded-full bg-slate-800 text-gray-400 font-black text-[10px] uppercase tracking-widest hover:bg-slate-700 transition-all cursor-pointer">Cancelar</button>
                <button onClick={() => modal.onConfirm(modal.inputValue)} className={`flex-1 px-6 py-3 rounded-full font-black text-[10px] uppercase tracking-widest transition-all cursor-pointer shadow-lg ${modal.type === 'danger' ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-yellow-500 hover:bg-yellow-400 text-black'}`}>Confirmar</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}