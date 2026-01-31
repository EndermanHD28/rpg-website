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

  // --- 2. PERMISSIONS ---
  const isMaster = user?.user_metadata?.sub === MASTER_DISCORD_ID;
  const showMasterView = isMaster && !previewAsPlayer && !viewingTarget;
  const isMasterInPlayerView = isMaster && viewingTarget;
  const activeChar = (isEditing || isViewingOnly) ? tempChar : character;

  // --- 3. FETCHING & REALTIME ---
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user: activeUser } } = await supabase.auth.getUser();
      setUser(activeUser);

      if (activeUser) {
        // 1. Try to get the character
        let { data: char } = await supabase.from('characters').select('*').eq('id', activeUser.id).maybeSingle();

        // 2. FALLBACK: If character doesn't exist, create it manually right now
        if (!char) {
          console.log("Character row missing. Creating fallback...");
          const { data: newChar, error: insertError } = await supabase
            .from('characters')
            .insert([{
              id: activeUser.id,
              discord_username: activeUser.user_metadata.full_name || activeUser.user_metadata.preferred_username || 'User',
              char_name: 'Novo Recruta',
              strength: 1, resistance: 1, aptitude: 1, agility: 1, precision: 1,
              intelligence: 1, luck: 1, charisma: 1,
              stat_points_available: 0, dollars: 0, rank: 'E - Recruta'
            }])
            .select()
            .single();
          
          if (!insertError) char = newChar;
        }

        if (char) {
          setCharacter(char);
          setTempChar(char);
        }

        // 3. Get own requests
        const { data: req } = await supabase.from('change_requests').select('*').eq('player_id', activeUser.id).eq('status', 'pending').maybeSingle();
        setPendingRequest(req);
      }
      setLoading(false);
    };
    fetchData();

    const channel = supabase.channel('db-all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'characters' }, (payload) => {
        if (payload.new.id === user?.id) setCharacter(payload.new);
        if (isMaster && payload.new.id === viewingTarget) {
            setCharacter(payload.new);
            if (!isEditing) setTempChar(payload.new);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'change_requests' }, (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          if (payload.new.player_id === user?.id) setPendingRequest(payload.new.status === 'pending' ? payload.new : null);
          if (isMaster) setRequests(prev => {
            const filtered = prev.filter(r => r.id !== payload.new.id);
            return payload.new.status === 'pending' ? [...filtered, payload.new] : filtered;
          });
        }
        if (payload.eventType === 'DELETE' && isMaster) {
          setRequests(prev => prev.filter(r => r.id !== payload.old.id));
        }
      }).subscribe();
    return () => supabase.removeChannel(channel);
  }, [user?.id, isMaster, viewingTarget, isEditing]);

  useEffect(() => {
    if (showMasterView) {
      supabase.from('change_requests').select('*').eq('status', 'pending').then(({ data }) => setRequests(data || []));
    }
  }, [showMasterView]);

  // --- 4. ACTIONS ---
  const login = () => supabase.auth.signInWithOAuth({ provider: 'discord', options: { redirectTo: typeof window !== 'undefined' ? window.location.origin : '' } });
  const logout = async () => { await supabase.auth.signOut(); window.location.reload(); };

  const toggleEditMode = async () => {
    if (!isEditing && !isViewingOnly && pendingRequest && !isMasterInPlayerView) {
      if (confirm("Você já tem um pedido pendente. Deseja cancelá-lo?")) {
        setTempChar(pendingRequest.new_data);
        await supabase.from('change_requests').delete().eq('id', pendingRequest.id);
        setPendingRequest(null);
        setIsEditing(true);
      }
      return;
    }
    
    if (isEditing) {
      const hasChanges = JSON.stringify(character) !== JSON.stringify(tempChar);
      if (!hasChanges) { setIsEditing(false); return; }
      setLoading(true);
      if (isMasterInPlayerView) {
          await supabase.from('characters').update({ ...tempChar, master_editing_id: null }).eq('id', viewingTarget);
          await supabase.from('change_requests').update({ status: 'rejected' }).eq('player_id', viewingTarget).eq('status', 'pending');
          alert("Ficha atualizada diretamente!");
      } else {
          const { error } = await supabase.from('change_requests').insert({
            player_id: user.id, player_name: user?.user_metadata?.full_name,
            old_data: character, new_data: tempChar, status: 'pending'
          });
          if (!error) alert("Pedido enviado!");
      }
      setIsEditing(false);
      setIsViewingOnly(false);
      setLoading(false);
    } else {
      if (isMasterInPlayerView) await supabase.from('characters').update({ master_editing_id: user.id }).eq('id', viewingTarget);
      setIsEditing(true);
      setIsViewingOnly(false);
    }
  };

  // --- ADMIN TOOLS ---
  const handleResetPlayer = async () => {
    const name = prompt("Nome de Usuário para RESETAR:");
    if (!name) return;
    setLoading(true);
    const { error } = await supabase.from('characters').update({
      strength: 1, resistance: 1, aptitude: 1, agility: 1, precision: 1, intelligence: 1, luck: 1, charisma: 1, 
      stat_points_available: 0, dollars: 0, rank: 'E - Recruta', breathing_lvl: 1, breathing_style: 'Nenhuma', char_name: 'Novo Recruta', anomalies: []
    }).eq('discord_username', name);
    alert(error ? "Erro ao buscar jogador." : "Jogador resetado!");
    setLoading(false);
  };

  const handleGrantPS = async () => {
    const name = prompt("Nome de Usuário:");
    const amount = parseInt(prompt("Quantidade de PS:"));
    if (!name || isNaN(amount)) return;
    const { data: char } = await supabase.from('characters').select('stat_points_available').eq('discord_username', name).single();
    if (char) {
        await supabase.from('characters').update({ stat_points_available: char.stat_points_available + amount }).eq('discord_username', name);
        alert(`Concedido ${amount} PS para ${name}`);
    }
  };

  const handleViewPlayer = async () => {
    const name = prompt("Nome de Usuário para VISUALIZAR:");
    if (!name) return;
    const { data: char } = await supabase.from('characters').select('*').eq('discord_username', name).maybeSingle();
    if (char) { setViewingTarget(char.id); setCharacter(char); setTempChar(char); setPreviewAsPlayer(false); }
    else { alert("Jogador não encontrado."); }
  };

  // --- INPUT HANDLERS ---
  const updateField = (field, value) => {
    if (['dollars', 'breathing_lvl'].includes(field) && value === "") {
      setTempChar({ ...tempChar, [field]: "" }); return;
    }
    setTempChar({ ...tempChar, [field]: (field === 'dollars' || field === 'breathing_lvl') ? parseInt(value) || 0 : value });
  };

  const handleStatChange = (stat, newValue) => {
    if (newValue === "") { setTempChar({ ...tempChar, [stat]: "" }); return; }
    const val = parseInt(newValue) || 0;
    const totalPSCost = Object.keys(tempChar).filter(k => ['strength', 'resistance', 'aptitude', 'agility', 'precision', 'intelligence', 'luck', 'charisma'].includes(k))
      .reduce((acc, k) => acc + (k === stat ? val : (Number(tempChar[k]) || 0)) - character[k], 0);
    if (isMasterInPlayerView || (character.stat_points_available - totalPSCost >= 0)) {
      setTempChar({ ...tempChar, [stat]: val, stat_points_available: character.stat_points_available - totalPSCost });
    }
  };

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
            <div className="text-6xl mb-6">🔨✨</div>
            <h1 className="text-3xl font-black text-yellow-500 uppercase italic">Aguarde...</h1>
            <p className="text-gray-400 mt-2 max-w-xs uppercase font-bold text-[10px] tracking-widest">O Mestre está alterando sua ficha agora.</p>
        </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        
        {isMaster && (
          <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 items-end">
            {!viewingTarget ? (
                <>
                    <button onClick={handleViewPlayer} className="w-44 py-2 rounded-full font-bold text-[9px] uppercase bg-slate-800 border border-blue-500/50 text-blue-400 hover:bg-blue-500/10 transition-all cursor-pointer whitespace-nowrap">Visualizar Jogador</button>
                    <button onClick={handleGrantPS} className="w-44 py-2 rounded-full font-bold text-[9px] uppercase bg-slate-800 border border-yellow-500/50 text-yellow-500 hover:bg-yellow-500/10 transition-all cursor-pointer whitespace-nowrap">Conceder PS</button>
                    <button onClick={handleResetPlayer} className="w-44 py-2 rounded-full font-bold text-[9px] uppercase bg-slate-800 border border-red-500/50 text-red-500 hover:bg-red-500/10 transition-all cursor-pointer whitespace-nowrap">Resetar Jogador</button>
                </>
            ) : (
                <button onClick={async () => {
                    await supabase.from('characters').update({ master_editing_id: null }).eq('id', viewingTarget);
                    window.location.reload();
                }} className="w-44 py-2 rounded-full font-bold text-[9px] uppercase bg-blue-600 text-white cursor-pointer shadow-xl whitespace-nowrap">Parar de Visualizar</button>
            )}
            <button onClick={() => {setPreviewAsPlayer(!previewAsPlayer); setIsEditing(false); setIsViewingOnly(false);}} className={`w-44 py-2 rounded-full font-bold text-[10px] uppercase border-2 shadow-2xl transition-all cursor-pointer whitespace-nowrap ${previewAsPlayer ? 'bg-red-600 border-red-400' : 'bg-blue-600 border-blue-400'}`}>
              {previewAsPlayer ? "VOLTAR PARA MESTRE" : "PREVIEW JOGADOR"}
            </button>
          </div>
        )}

        <header className="flex justify-between items-start mb-10 border-b border-slate-800 pb-4">
          <div><h1 className="text-2xl font-black text-yellow-500 italic uppercase tracking-tighter">KIMETSU NO YAIBA RPG</h1><p className="text-[10px] text-gray-500 uppercase tracking-widest mt-1 italic">Logado como: <span className="text-gray-300">{user?.user_metadata?.full_name}</span></p></div>
          <button onClick={logout} className="text-[10px] text-red-500 font-bold underline uppercase hover:text-red-400 transition-colors cursor-pointer">Sair</button>
        </header>

        {showMasterView ? (
          <div className="space-y-6 animate-in fade-in duration-500">
            <h2 className="text-3xl font-black text-red-500 italic uppercase tracking-tighter">Painel do Mestre</h2>
            {requests.length === 0 ? <p className="text-gray-500 italic text-sm">Nenhum pedido pendente.</p> : (
              <div className="grid grid-cols-1 gap-4">
                {requests.map((req) => {
                  const isLocked = (now - new Date(req.created_at).getTime()) < 3000;
                  return (
                    <div key={req.id} className="bg-slate-900 p-6 rounded-2xl border border-red-500/30 flex flex-col gap-4 shadow-xl">
                      <div className="flex justify-between items-center">
                        <div><h3 className="text-xl font-bold text-white">{req.player_name}</h3><p className="text-[9px] text-gray-500 uppercase">Solicitou mudanças</p></div>
                        <div className="flex gap-3">
                          <button disabled={isLocked} onClick={() => handleApprove(req)} className={`px-4 py-2 rounded font-bold text-xs uppercase transition-all ${isLocked ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-green-600 hover:bg-green-500 cursor-pointer'}`}>{isLocked ? "Aguarde..." : "Aprovar"}</button>
                          <button onClick={() => supabase.from('change_requests').update({status:'rejected'}).eq('id',req.id)} className="bg-red-600 hover:bg-red-400 px-4 py-2 rounded font-bold text-xs uppercase cursor-pointer">Recusar</button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 bg-black/40 p-4 rounded-xl text-[10px] font-mono">
                        <div className="border-r border-white/5 pr-2 text-red-500">
                          <p className="mb-2 font-bold underline uppercase tracking-widest italic">Atual</p>
                          {Object.keys(req.new_data).map(k => JSON.stringify(req.old_data[k]) !== JSON.stringify(req.new_data[k]) ? <p key={k}>{k}: {JSON.stringify(req.old_data[k])}</p> : null)}
                        </div>
                        <div className="pl-2 text-green-500">
                          <p className="mb-2 font-bold underline uppercase tracking-widest italic">Novo</p>
                          {Object.keys(req.new_data).map(k => JSON.stringify(req.old_data[k]) !== JSON.stringify(req.new_data[k]) ? <p key={k}>{k}: <span className="text-white font-bold">{JSON.stringify(req.new_data[k])}</span></p> : null)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in slide-in-from-bottom-4 duration-700">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-slate-900/50 p-10 rounded-[40px] border-2 border-slate-800 shadow-2xl relative overflow-hidden">
                <div className="absolute -top-4 -right-4 opacity-5 text-9xl font-black italic select-none">鬼</div>
                
                <div className="absolute top-8 right-8 flex flex-col gap-2 z-10 items-end">
                  <button onClick={toggleEditMode} className={`w-44 text-[10px] font-black px-6 py-2 rounded-full uppercase tracking-widest transition-all shadow-lg cursor-pointer whitespace-nowrap ${isEditing ? 'bg-green-600 hover:bg-green-500 text-white' : (isViewingOnly ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : (pendingRequest && !isMasterInPlayerView ? 'bg-emerald-600 text-white' : 'bg-yellow-600 hover:bg-yellow-500 text-black'))}`}>
                    {isEditing ? "CONCLUIR" : (isViewingOnly ? "CONTINUAR EDIÇÃO" : (pendingRequest && !isMasterInPlayerView ? "PEDIDO ENVIADO" : "EDITAR FICHA"))}
                  </button>
                  {(isEditing || isViewingOnly) && (
                    <>
                      {isEditing && (
                        <button onClick={() => { setIsEditing(false); setIsViewingOnly(true); }} className="w-44 bg-white/10 hover:bg-white/20 text-[9px] font-bold px-4 py-2 rounded-full uppercase transition-all cursor-pointer whitespace-nowrap">Ver Ficha</button>
                      )}
                      <button onClick={async () => { 
                          if(isMasterInPlayerView) await supabase.from('characters').update({ master_editing_id: null }).eq('id', viewingTarget);
                          setTempChar({...character}); setIsEditing(false); setIsViewingOnly(false); 
                        }} className="w-44 bg-red-900/40 hover:bg-red-900/60 text-red-500 text-[9px] font-bold px-4 py-2 rounded-full uppercase transition-all cursor-pointer whitespace-nowrap">Cancelar</button>
                    </>
                  )}
                </div>

                <div className="max-w-[calc(100%-180px)] mb-10">
                   <h2 className="text-5xl font-black text-yellow-500 italic uppercase tracking-tighter break-words leading-tight drop-shadow-md">
                      {activeChar?.char_name || "NOVO RECRUTA"}
                   </h2>
                   <p className="text-gray-500 text-[10px] font-bold uppercase mt-1 tracking-widest italic">
                      ID Discord: {isMasterInPlayerView ? character?.discord_username : user?.user_metadata?.full_name}
                   </p>
                </div>

                <div className="grid grid-cols-2 gap-x-10 gap-y-8">
                  <div className="space-y-1"><span className="text-gray-500 uppercase text-[9px] font-black block tracking-widest">Rank:</span>
                    {isEditing ? <select value={activeChar?.rank || ""} onChange={(e) => updateField('rank', e.target.value)} className="bg-slate-800 border border-white/10 rounded px-3 py-2 w-full text-sm outline-none">{RANKS.map(r => <option key={r} value={r}>{r}</option>)}</select> : <span className="font-bold text-lg uppercase text-white tracking-tight">{activeChar?.rank}</span>}
                  </div>
                  <div className="space-y-1"><span className="text-gray-500 uppercase text-[9px] font-black block tracking-widest">Dólares:</span>
                    {isEditing ? <input type="number" value={activeChar?.dollars ?? ""} onChange={(e) => updateField('dollars', e.target.value)} className="bg-slate-800 border border-white/10 rounded px-3 py-2 w-full text-sm outline-none" /> : <span className="font-bold text-white text-lg tracking-tight">{activeChar?.dollars || 0}$</span>}
                  </div>
                  <div className="space-y-1"><span className="text-gray-500 uppercase text-[9px] font-black block tracking-widest">Respiração:</span>
                    {isEditing ? (
                      <div className="flex gap-2">
                        <select value={activeChar?.breathing_style || "Nenhuma"} onChange={(e) => updateField('breathing_style', e.target.value)} className="bg-slate-800 border border-white/10 rounded px-3 py-2 flex-1 text-sm outline-none h-[38px]">{RESPIRACOES.map(r => <option key={r} value={r}>{r}</option>)}</select>
                        <div className="w-20 relative"><span className="absolute -top-4 left-0 text-[8px] text-gray-300 font-bold uppercase tracking-tighter">Nível</span><input type="number" value={activeChar?.breathing_lvl ?? ""} onChange={(e) => updateField('breathing_lvl', e.target.value)} className="bg-slate-800 border border-white/10 rounded px-3 py-2 w-full text-sm outline-none h-[38px]" /></div>
                      </div>
                    ) : <span className="font-bold text-white text-lg italic tracking-tight">{activeChar?.breathing_style && activeChar.breathing_style !== "Nenhuma" ? `${activeChar.breathing_style} (Lvl.${activeChar.breathing_lvl})` : 'Nenhuma'}</span>}
                  </div>
                  <div className="space-y-1"><span className="text-gray-500 uppercase text-[9px] font-black block tracking-widest">Linhagem:</span>
                    {isEditing ? <select value={activeChar?.bloodline || "Nenhuma"} onChange={(e) => updateField('bloodline', e.target.value)} className="bg-slate-800 border border-white/10 rounded px-3 py-2 w-full text-sm outline-none">{LINHAGENS.map(l => <option key={l} value={l}>{l}</option>)}</select> : <span className="font-bold text-lg text-white tracking-tight">{activeChar?.bloodline || "Nenhuma"}</span>}
                  </div>
                  <div className="col-span-full space-y-1"><span className="text-gray-500 uppercase text-[9px] font-black block tracking-widest">Cor de Nichirin:</span>
                    {isEditing ? <select value={activeChar?.nichirin_color || "Nenhuma"} onChange={(e) => updateField('nichirin_color', e.target.value)} className="bg-slate-800 border border-white/10 rounded px-3 py-2 w-full text-sm outline-none">{CORES.map(c => <option key={c} value={c}>{c}</option>)}</select> : <span className="font-bold text-white text-lg tracking-tight">{activeChar?.nichirin_color || "Nenhuma"}</span>}
                  </div>
                </div>

                <div className="mt-8 p-6 bg-black/20 rounded-2xl border border-white/5">
                  <div className="flex justify-between items-center mb-3"><span className="text-gray-500 uppercase text-[9px] font-black block tracking-widest">Anomalias:</span>
                    {isEditing && <select onChange={(e) => { const v = e.target.value; if(v) { const curr = activeChar.anomalies || []; if(!curr.includes(v)) updateField('anomalies', [...curr, v]) } }} className="bg-slate-800 text-[10px] text-white border border-white/10 rounded px-2 py-1 outline-none cursor-pointer"><option value="">+ ADICIONAR</option>{ANOMALIAS_LIST.filter(a => !(activeChar.anomalies || []).includes(a)).map(a => (<option key={a} value={a}>{a}</option>))}</select>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {activeChar?.anomalies?.length > 0 ? activeChar.anomalies.map((anom, idx) => (<span key={idx} className="text-xs text-gray-300 italic bg-white/5 px-2 py-1 rounded border border-white/5 flex items-center gap-2">{anom}{isEditing && <button onClick={() => removeAnomaly(anom)} className="text-red-500 cursor-pointer">×</button>}</span>)) : <p className="text-xs text-gray-500 italic">Nenhuma detectada</p>}
                  </div>
                </div>

                <div className="mt-12 grid grid-cols-3 gap-6 text-center">
                  <div className="bg-black/40 p-5 rounded-2xl border-2 border-red-600 shadow-lg"><p className="text-[10px] text-red-500 font-black uppercase tracking-widest">Vida</p><p className="text-4xl font-black text-white tracking-tighter">{life}</p></div>
                  <div className="bg-black/40 p-5 rounded-2xl border-2 border-blue-500 shadow-lg"><p className="text-[10px] text-blue-500 font-black uppercase tracking-widest">Presença</p><p className="text-4xl font-black text-white tracking-tighter">{presence}</p></div>
                  <div className="bg-black/40 p-5 rounded-2xl border-2 border-green-500 shadow-lg"><p className="text-[10px] text-green-500 font-black uppercase tracking-widest">Postura</p><p className="text-4xl font-black text-white tracking-tighter">{posture.toFixed(1)}</p></div>
                </div>
              </div>
            </div>

            <div className="bg-slate-900/50 p-8 rounded-[40px] border-2 border-slate-800 shadow-2xl h-fit">
              <div className="flex justify-between items-center mb-8 pb-3 border-b border-slate-800"><h3 className="font-black text-gray-500 uppercase tracking-widest text-[10px]">Atributos</h3><div className="bg-yellow-500/10 px-4 py-2 rounded border border-yellow-500/30"><span className="text-yellow-500 font-black text-xs tracking-tighter italic">{activeChar?.stat_points_available || 0} PS</span></div></div>
              <ul className="space-y-2">
                <StatLine label="Força" statKey="strength" />
                <StatLine label="Resistência" statKey="resistance" />
                <StatLine label="Aptidão" statKey="aptitude" />
                <StatLine label="Agilidade" statKey="agility" />
                <StatLine label="Precisão" statKey="precision" />
              </ul>
              <div className="mt-10 pt-6 border-t border-slate-800">
                <p className="text-[9px] text-cyan-500 font-black uppercase mb-4 tracking-widest">Especialidades</p>
                <ul className="space-y-2">
                  <StatLine label="Inteligência" statKey="intelligence" isSpecial />
                  <StatLine label="Sorte" statKey="luck" isSpecial />
                  <StatLine label="Carisma" statKey="charisma" isSpecial />
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}