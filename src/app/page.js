"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { MASTER_DISCORD_ID, ANOMALIAS_LIST, SKILLS_LIST, RARITY_CONFIG } from '../constants/gameData';

// Components
import Inventory from '../components/InventoryTemp';
import MasterPanel from '../components/MasterPanel';
import BioGrid from '../components/BioGrid';
import DicePanel from '../components/DicePanel';
import { Toast, Modal } from '../components/UIElements';
import Celebration from '../components/Celebration';

export default function Home() {
  // --- UI STATE ---
  const [activeTab, setActiveTab] = useState('home');
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState([]);
  const [modal, setModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null, type: 'confirm', input: false, inputValue: '', fields: false });
  const [showCelebration, setShowCelebration] = useState(false);

  // --- DATA STATE ---
  const [user, setUser] = useState(null);
  const [character, setCharacter] = useState(null);
  const [tempChar, setTempChar] = useState(null);
  const [allPlayers, setAllPlayers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [pendingRequest, setPendingRequest] = useState(null);
  const [viewingTarget, setViewingTarget] = useState(null);

  // --- PERMISSIONS ---
  const [isEditing, setIsEditing] = useState(false);
  const [previewAsPlayer, setPreviewAsPlayer] = useState(false);
  const [itemLibrary, setItemLibrary] = useState([]);

  const isMaster = user?.user_metadata?.sub === MASTER_DISCORD_ID;
  const isActingAsMaster = isMaster && !previewAsPlayer;
  const isViewingOthers = isMaster && !!viewingTarget;
  const activeChar = isEditing ? tempChar : character;

  // --- MATH HELPERS ---
  const presence = activeChar ? (Number(activeChar.strength) || 0) + (Number(activeChar.resistance) || 0) + (Number(activeChar.aptitude) || 0) + (Number(activeChar.agility) || 0) + (Number(activeChar.precision) || 0) : 0;
  const life = activeChar ? (Number(activeChar.strength) || 0) + ((Number(activeChar.resistance) || 0) * 4) : 0;
  const posture = activeChar ? ((Number(activeChar.resistance) || 0) * 0.25) + (Number(activeChar.aptitude) || 0) : 0;

  const getPerc = (val) => presence > 0 ? ((Number(val) / presence) * 100).toFixed(1) : "0.0";
  const luckPerc = activeChar ? parseFloat(getPerc(activeChar.luck || 0)) : 0;

  const [now, setNow] = useState(Date.now());
  const [globalLockUntil, setGlobalLockUntil] = useState(0);

  // --- UTILS ---
  const showToast = (message) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  const closeModal = () => setModal(m => ({ ...m, isOpen: false, inputValue: '', fields: false }));

  // --- DATA FETCH & REALTIME ---
  useEffect(() => {
    const fetchData = async () => {
      const { data: libraryData } = await supabase.from('items').select('*').order('name', { ascending: true });
      setItemLibrary(libraryData || []);
      const { data: { user: activeUser } } = await supabase.auth.getUser();
      setUser(activeUser);
      if (activeUser) {
        const tId = viewingTarget || activeUser.id;
        const { data: char } = await supabase.from('characters').select('*').eq('id', tId).maybeSingle();
        if (char) { setCharacter(char); setTempChar(char); }
      }
      setLoading(false);
    };
    fetchData();

    const ch = supabase.channel('db')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'characters' }, (p) => {
        if (p.new.id === (viewingTarget || user?.id)) {
          setCharacter(p.new);
          // Sync tempChar only if not currently editing to avoid overwriting player typing
          if (!isEditing) setTempChar(p.new);
        }

        // Also update the Master's list if the Master is looking at the panel
        if (isMaster) {
          setAllPlayers(prev => prev.map(pl => pl.id === p.new.id ? p.new : pl));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'change_requests' }, (p) => {
        if (isMaster) {
          if (p.eventType === 'INSERT') {
            setRequests(prev => [...prev, p.new]);
            setGlobalLockUntil(Date.now() + 500); // Trigger 0.5s cooldown
          }
          else if (p.eventType === 'UPDATE') {
            // Update the list and filter out anything that isn't 'pending'
            setRequests(prev => prev.map(r => r.id === p.new.id ? p.new : r).filter(r => r.status === 'pending'));
          }
          else if (p.eventType === 'DELETE') {
            setRequests(prev => prev.filter(r => r.id !== p.old.id));
            setGlobalLockUntil(Date.now() + 500); // Trigger 0.5s cooldown
          }
        }
        // Update player's own pending request status
        if (p.new?.player_id === user?.id || p.old?.player_id === user?.id) {
          if (p.eventType === 'DELETE' || p.new.status !== 'pending') setPendingRequest(null);
          else setPendingRequest(p.new);
        }
      }).subscribe();
    return () => supabase.removeChannel(ch);
  }, [viewingTarget, user?.id, isEditing]);

  useEffect(() => {
    if (activeTab === 'master' && isMaster) {
      supabase.from('change_requests').select('*').eq('status', 'pending').then(({ data }) => setRequests(data || []));
      supabase.from('characters').select('*').order('char_name', { ascending: true }).then(({ data }) => setAllPlayers(data || []));
    }
  }, [activeTab, isMaster]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (character?.needs_celebration) {
      // SECURITY: Don't show fireworks if Master is just browsing sheets
      if (isMaster && !previewAsPlayer && viewingTarget) return;

      setShowCelebration(true);
      showToast("✨ FICHA APROVADA PELO MESTRE! ✨");

      // Reset the flag in the database immediately so it doesn't repeat
      supabase.from('characters')
        .update({ needs_celebration: false })
        .eq('id', character.id)
        .then();

      // Stop particles after 6 seconds
      setTimeout(() => setShowCelebration(false), 6000);
    }
  }, [character?.needs_celebration]);

  // --- HANDLERS ---
  const handleStatChange = (stat, val) => {
    if (val === "") { setTempChar({ ...tempChar, [stat]: "" }); return; }
    const nVal = Math.max(1, parseInt(val) || 1);
    const keys = ['strength', 'resistance', 'aptitude', 'agility', 'precision', 'intelligence', 'luck', 'charisma'];
    const used = keys.reduce((acc, k) => acc + (((k === stat) ? nVal : (Number(tempChar[k]) || 1)) - character[k]), 0);
    if (isActingAsMaster || (character.stat_points_available - used >= 0)) {
      setTempChar({ ...tempChar, [stat]: nVal, stat_points_available: character.stat_points_available - used });
    }
  };

  const toggleEditMode = async () => {
    if (isEditing) {
      const sanitized = { ...tempChar };

      // Check if anything actually changed
      if (JSON.stringify(character) === JSON.stringify(sanitized)) {
        setIsEditing(false);
        return;
      }

      setModal({
        isOpen: true,
        title: isActingAsMaster ? "Confirmar" : "Enviar Pedido",
        message: isActingAsMaster ? "Aplicar mudanças na ficha agora?" : "Enviar mudanças para aprovação do Mestre?",
        onConfirm: async () => {
          setLoading(true);
          closeModal();

          if (isActingAsMaster) {
            // MASTER LOGIC: Direct update to 'characters'
            const { error } = await supabase.from('characters')
              .update({ ...sanitized, master_editing_id: null })
              .eq('id', viewingTarget || user.id);

            // Clear any pending requests for this player since master manually fixed it
            if (viewingTarget) {
              await supabase.from('change_requests').update({ status: 'rejected' }).eq('player_id', viewingTarget).eq('status', 'pending');
            }

            if (!error) showToast("Ficha Sincronizada!");
          } else {
            // PLAYER LOGIC: Insert into 'change_requests'
            const { error } = await supabase.from('change_requests').insert({
              player_id: user.id,
              player_name: user?.user_metadata?.full_name || user?.user_metadata?.preferred_username,
              old_data: character,
              new_data: sanitized,
              status: 'pending'
            });

            if (!error) showToast("Pedido Enviado!");
            else showToast("Erro ao enviar pedido.");
          }

          setIsEditing(false);
          setLoading(false);
        }
      });
    } else {
      setIsEditing(true);
    }
  };

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-red-600 font-black italic">CARREGANDO...</div>;

  if (!user) return (
    <div className="min-h-screen bg-black flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 opacity-70 bg-[url('/red-moon.jpg')] bg-cover bg-right" style={{ maskImage: 'linear-gradient(to left, #000 0%, transparent 95%)', WebkitMaskImage: 'linear-gradient(to right, #000 0%, transparent 80%)' }}></div>
      <div className="relative z-10 text-center space-y-6">
        <h1 className="text-6xl font-black text-red-600 italic tracking-tighter uppercase leading-none">KIMETSU NO YAIBA<br /><span className="text-white text-4xl">BLOODBATH</span></h1>
        <button onClick={() => supabase.auth.signInWithOAuth({ provider: 'discord' })} className="bg-red-600 text-white px-10 py-4 rounded-full font-black uppercase hover:scale-110 transition-all border-b-4 border-red-900">Entrar com Discord</button>
      </div>
    </div>
  );

  return (
    <main className="h-screen bg-black text-white flex overflow-hidden">

      {/* SIDEBAR */}
      <nav className="w-64 h-full bg-zinc-950 border-r border-zinc-900 p-8 flex flex-col justify-between shrink-0 z-[100]">
        <div className="space-y-12">
          <div onClick={() => setActiveTab('home')} className="cursor-pointer">
            <h1 className="text-xl font-black text-red-600 italic leading-none uppercase">Bloodbath</h1>
            <p className="text-[8px] text-zinc-500 font-bold tracking-widest uppercase mt-1">What-If RPG</p>
          </div>
          <div className="flex flex-col gap-4">
            <NavButton active={activeTab === 'home'} label="Início" onClick={() => setActiveTab('home')} />
            <NavButton active={activeTab === 'sheet'} label="Ficha" onClick={() => { setActiveTab('sheet'); setViewingTarget(null); }} />
            {isMaster && !previewAsPlayer && <NavButton active={activeTab === 'master'} label="Mestre" onClick={() => setActiveTab('master')} />}
          </div>
        </div>
        <div className="space-y-4">
          <div className="p-4 bg-zinc-900/50 rounded-2xl border border-white/5">
            <p className="text-[8px] text-zinc-500 font-black uppercase mb-1 leading-none">Logado como</p>
            <p className="text-[10px] font-bold text-white truncate leading-none">@{user?.user_metadata?.full_name || user?.user_metadata?.preferred_username}</p>
          </div>
          {isMaster && (
            <button onClick={() => { setPreviewAsPlayer(!previewAsPlayer); setActiveTab('home'); }} className="w-full text-[9px] font-black uppercase py-2 rounded-lg border border-zinc-700 text-zinc-500 hover:text-white transition-all">
              {previewAsPlayer ? "MODO MESTRE" : "MODO JOGADOR"}
            </button>
          )}
          {/* FIXED LOGOUT BUTTON */}
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.reload();
            }}
            className="w-full text-[10px] text-red-600/70 hover:text-red-500 transition-all uppercase font-black cursor-pointer text-center py-2 border-t border-white/5"
          >
            Sair da Conta
          </button>
        </div>
      </nav>

      {/* CONTENT AREA */}
      <section className="flex-1 h-full overflow-y-auto bg-zinc-950 relative">
        {activeTab === 'home' && (
          <div className="h-full flex items-center relative">
            <div className="absolute inset-0 bg-[url('/red-moon.jpg')] bg-cover bg-right opacity-70" style={{ maskImage: 'linear-gradient(to left, #000 0%, transparent 80%)', WebkitMaskImage: 'linear-gradient(to left, #000 0%, transparent 100%)' }}></div>
            <div className="relative z-10 p-20 space-y-4 max-w-2xl">
              <h2 className="text-7xl font-black italic uppercase tracking-tighter leading-[0.85] text-white">O SANGUE<br /><span className="text-red-600">NÃO MENTE.</span></h2>
              <p className="text-zinc-400 font-medium italic text-lg leading-relaxed">Bem-vindo ao Bloodbath. Prepare sua Nichirin, pois neste "What-if", a noite é eterna e o mestre é impiedoso.</p>
              <button onClick={() => setActiveTab('sheet')} className="mt-8 px-8 py-3 bg-white text-black font-black uppercase text-xs rounded-full hover:bg-red-600 hover:text-white transition-all">Ver minha Ficha</button>
            </div>
          </div>
        )}

        {activeTab === 'sheet' && (
          <div className="p-12">
            <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-8">
                <div className="bg-zinc-900/50 p-10 rounded-[40px] border border-zinc-800 relative">
                  <div className="absolute top-8 right-8 z-20">
                    <button onClick={toggleEditMode} className={`px-6 py-2 rounded-full font-black text-[10px] uppercase shadow-xl ${isEditing ? 'bg-green-600' : 'bg-yellow-600 text-black'}`}>{isEditing ? "CONCLUIR" : "EDITAR"}</button>
                  </div>
                  <h2 className="text-5xl font-black text-red-600 italic uppercase mb-10">{activeChar?.char_name}</h2>
                  <BioGrid activeChar={activeChar} isEditing={isEditing} setTempChar={setTempChar} />
                  <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <TagBox label="Anomalias" list={ANOMALIAS_LIST} activeList={activeChar?.anomalies} field="anomalies" isEditing={isEditing} setTempChar={setTempChar} />
                    <TagBox label="Habilidades" list={SKILLS_LIST} activeList={activeChar?.skills} field="skills" isEditing={isEditing} setTempChar={setTempChar} color="text-cyan-200 bg-cyan-950/30 border-cyan-500/20" />
                  </div>
                  <div className="mt-12 grid grid-cols-3 gap-6 text-center">
                    <StatBox label="VIDA" value={life} color="border-red-600" textColor="text-red-500" />
                    <StatBox label="PRESENÇA" value={presence} color="border-blue-500" textColor="text-blue-500" />
                    <StatBox label="POSTURA" value={posture.toFixed(1)} color="border-green-500" textColor="text-green-500" />
                  </div>
                </div>
                <Inventory
                  inventory={activeChar?.inventory || []}
                  isActingAsMaster={isActingAsMaster}
                  rarityConfig={RARITY_CONFIG}
                  onMove={(idx, dir) => {
                    const targetIdx = idx + dir;
                    if (targetIdx < 0 || targetIdx >= (activeChar.inventory?.length || 0)) return;

                    const newList = [...(activeChar.inventory || [])];
                    const [movedItem] = newList.splice(idx, 1);
                    newList.splice(targetIdx, 0, movedItem);

                    setTempChar(prev => ({ ...prev, inventory: newList }));

                    // If not in a "Change Request" session (Master direct edit or simple move), sync DB
                    if (!isEditing) {
                      supabase.from('characters').update({ inventory: newList }).eq('id', activeChar.id).then();
                    }
                  }}
                  onSort={(type) => {
                    const newList = [...(activeChar.inventory || [])];
                    newList.sort((a, b) => type === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name));

                    setTempChar(prev => ({ ...prev, inventory: newList }));
                    if (!isEditing) {
                      supabase.from('characters').update({ inventory: newList }).eq('id', activeChar.id).then();
                    }
                  }}
                  onDelete={(idx) => setModal({
                    isOpen: true,
                    title: "Descartar",
                    message: `Deseja jogar fora "${activeChar.inventory[idx].name}"?`,
                    type: 'danger',
                    onConfirm: () => {
                      const newList = [...(activeChar.inventory || [])];
                      newList.splice(idx, 1);
                      setTempChar(prev => ({ ...prev, inventory: newList }));
                      if (!isEditing) {
                        supabase.from('characters').update({ inventory: newList }).eq('id', activeChar.id).then();
                      }
                      closeModal();
                      showToast("Item removido.");
                    }
                  })}
                  onAddItem={() => setModal({
                    isOpen: true,
                    title: "Novo Item",
                    fields: true,
                    library: itemLibrary,
                    rarityConfig: RARITY_CONFIG,
                    onConfirm: async (newItem) => {
                      if (!newItem.name) return;

                      const itemWithId = { ...newItem, id: Date.now() };
                      const newList = [...(activeChar.inventory || []), itemWithId];

                      setTempChar(prev => ({ ...prev, inventory: newList }));

                      // Auto-save new unique items to the global library
                      const exists = itemLibrary.find(i => i.name.toLowerCase() === newItem.name.toLowerCase());
                      if (!exists) {
                        await supabase.from('items').insert([newItem]);
                      }

                      if (!isEditing) {
                        await supabase.from('characters').update({ inventory: newList }).eq('id', activeChar.id);
                      }

                      closeModal();
                      showToast("Item Adicionado!");
                    }
                  })}
                />
              </div>

              <div className="space-y-6">
                <DicePanel activeChar={activeChar} luckPerc={luckPerc} />
                <div className="bg-zinc-900/50 p-8 rounded-[40px] border border-zinc-800 shadow-2xl">
                  <div className="flex justify-between items-center mb-8 border-b border-zinc-800 pb-3">
                    <h3 className="font-black text-zinc-500 text-[10px] italic">ATRIBUTOS</h3>
                    <div className="bg-yellow-500/10 text-yellow-500 px-3 py-1 rounded border border-yellow-500/30 text-[10px] font-black font-mono leading-none">
                      {activeChar?.stat_points_available || 0} PS
                    </div>
                  </div>
                  <ul className="space-y-2">
                    <StatLine label="Força" statKey="strength" val={activeChar?.strength} isEditing={isEditing} handleStatChange={handleStatChange} getPerc={getPerc} />
                    <StatLine label="Resistência" statKey="resistance" val={activeChar?.resistance} isEditing={isEditing} handleStatChange={handleStatChange} getPerc={getPerc} />
                    <StatLine label="Aptidão" statKey="aptitude" val={activeChar?.aptitude} isEditing={isEditing} handleStatChange={handleStatChange} getPerc={getPerc} />
                    <StatLine label="Agilidade" statKey="agility" val={activeChar?.agility} isEditing={isEditing} handleStatChange={handleStatChange} getPerc={getPerc} />
                    <StatLine label="Precisão" statKey="precision" val={activeChar?.precision} isEditing={isEditing} handleStatChange={handleStatChange} getPerc={getPerc} />
                  </ul>
                  <div className="mt-8 border-t border-zinc-800 pt-6 uppercase italic text-[9px] text-cyan-500 font-black mb-4 tracking-widest">Especialidades</div>
                  <ul className="space-y-2">
                    <StatLine label="Inteligência" statKey="intelligence" val={activeChar?.intelligence} isEditing={isEditing} handleStatChange={handleStatChange} getPerc={getPerc} isSpecial />
                    <StatLine label="Sorte" statKey="luck" val={activeChar?.luck} isEditing={isEditing} handleStatChange={handleStatChange} getPerc={getPerc} isSpecial />
                    <StatLine label="Carisma" statKey="charisma" val={activeChar?.charisma} isEditing={isEditing} handleStatChange={handleStatChange} getPerc={getPerc} isSpecial />
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'master' && isMaster && (
          <div className="p-12">
            <MasterPanel
              requests={requests}
              allPlayers={allPlayers}
              showToast={showToast}
              setModal={setModal}
              closeModal={closeModal}
              onVisualize={(p) => { setViewingTarget(p.id); setActiveTab('sheet'); }}
              now={now}                   // Pass current time
              globalLock={globalLockUntil} // Pass the 0.5s trigger
            />
          </div>
        )}
      </section>

      {isViewingOthers && (
        <div className="fixed bottom-6 right-6 z-[200]">
          <button onClick={() => { setViewingTarget(null); setActiveTab('master'); }} className="px-8 py-3 rounded-full font-black text-[10px] uppercase bg-blue-600 text-white shadow-2xl">Sair da Visualização</button>
        </div>
      )}

      <Toast toasts={toasts} setToasts={setToasts} />
      <Modal modal={modal} closeModal={closeModal} />
      <Celebration active={showCelebration} />
    </main>
  );
}

// HELPERS (OUTSIDE Home to prevent focus loss)
const NavButton = ({ label, active, onClick }) => (
  <button onClick={onClick} className={`text-left px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${active ? 'bg-red-600 text-white' : 'text-zinc-500 hover:text-zinc-200'}`}>{label}</button>
);

const StatBox = ({ label, value, color, textColor }) => (
  <div className={`bg-black/40 p-5 rounded-2xl border-2 ${color} shadow-lg shrink-0`}><p className={`text-[10px] ${textColor} font-black italic mb-1`}>{label}</p><p className="text-4xl font-black">{value}</p></div>
);

const StatLine = ({ label, statKey, val, isEditing, handleStatChange, getPerc, isSpecial = false }) => {
  const v = val ?? 1;
  const perc = getPerc(v);
  const getStatColor = (p) => {
    const pf = parseFloat(p);
    if (pf >= 30) return 'text-cyan-400';
    if (pf >= 15) return 'text-green-400';
    if (pf >= 10) return 'text-yellow-400';
    return 'text-red-700';
  };
  return (
    <li className="flex justify-between items-center py-2 border-b border-white/5 last:border-0 uppercase font-bold text-xs">
      <span className="text-zinc-500">{label}</span>
      <div className="flex gap-3 items-center">
        <span className={`text-[11px] font-mono font-bold ${isSpecial ? getStatColor(perc) : 'text-zinc-500'}`}>{perc}%</span>
        {isEditing ? (
          <div className="flex items-center bg-black/40 rounded border border-white/10 overflow-hidden">
            <button onClick={() => handleStatChange(statKey, v - 1)} className="px-3 py-1 hover:bg-white/10">-</button>
            <input type="number" value={val} onChange={(e) => handleStatChange(statKey, e.target.value)} className="w-10 text-center bg-transparent font-bold text-yellow-500 text-sm outline-none" />
            <button onClick={() => handleStatChange(statKey, v + 1)} className="px-3 py-1 hover:bg-white/10">+</button>
          </div>
        ) : <span className="text-yellow-500 font-mono text-lg">{v}</span>}
      </div>
    </li>
  );
};

const TagBox = ({ label, list, activeList, field, isEditing, setTempChar, color = "text-gray-300 bg-white/5 border-white/5" }) => (
  <div className="p-4 bg-black/20 rounded-2xl border border-white/5">
    <div className="flex justify-between items-center mb-3">
      <span className="text-zinc-500 text-[9px] font-black italic uppercase leading-none">{label}:</span>
      {isEditing && (
        <select onChange={(e) => { if (e.target.value && !(activeList || []).includes(e.target.value)) setTempChar(p => ({ ...p, [field]: [...(activeList || []), e.target.value] })) }} className="bg-zinc-800 text-[10px] rounded px-2 outline-none">
          <option value="">ADICIONAR</option>
          {list.filter(x => !(activeList || []).includes(x)).map(x => (<option key={x} value={x}>{x}</option>))}
        </select>
      )}
    </div>
    <div className="flex flex-wrap gap-2">
      {(activeList || []).length > 0 ? activeList.map((x, i) => (<span key={i} className={`text-[10px] italic px-2 py-1 rounded border flex items-center gap-2 ${color} leading-none`}>{x}{isEditing && (<button onClick={() => setTempChar(p => ({ ...p, [field]: activeList.filter(y => y !== x) }))} className="text-red-500 ml-1">×</button>)}</span>)) : (<p className="text-[10px] text-zinc-600 italic uppercase">Nenhum</p>)}
    </div>
  </div>
);