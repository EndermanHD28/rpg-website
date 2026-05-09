/* src/components/MasterPanel.js */
"use client";
import { useState, useEffect } from 'react'; // THIS WAS MISSING
import { supabase } from '../lib/supabase';
import { useSound } from '../hooks/useSound';

export default function MasterPanel({ requests, setRequests, allPlayers, onVisualize, showToast, setModal, closeModal, now, globalLock, isCombatActive, isSessionActive, setActiveTab }) {
  const { playSound } = useSound();
  const [hpStage, setHpStage] = useState({});
  const [isMaintenanceActive, setIsMaintenanceActive] = useState(false);
  const [allowedUsers, setAllowedUsers] = useState("");
  const [blockedTabs, setBlockedTabs] = useState([]);

  const LOCKABLE_TABS = [
    { id: 'combat', label: 'Sessão' },
    { id: 'reports', label: 'Relatórios' },
    { id: 'investigation', label: 'Investigação' },
    { id: 'breathing', label: 'Respiração' },
    { id: 'traders', label: 'Comerciantes'},
    { id: 'npcs', label: 'NPCs' },
  ];

  // Fetch maintenance and blocked tabs status
  useEffect(() => {
    supabase.from('global').select('is_maintenance_active, allowed_discord_usernames, blocked_tabs').eq('id', 1).single()
      .then(({ data, error }) => {
        if (error) {
          console.error("MasterPanel: Error fetching global settings:", error);
          return;
        }
        if (data) {
          setIsMaintenanceActive(!!data.is_maintenance_active);
          
          const parseAllowedUsers = (val) => {
            if (Array.isArray(val)) return val.join(", ");
            if (typeof val === 'string') {
              try {
                // If it's a JSON string of an array (e.g. '["user1", "user2"]')
                const parsed = JSON.parse(val);
                if (Array.isArray(parsed)) return parsed.join(", ");
              } catch (e) {
                // Not a JSON string, or not an array JSON string
              }
              return val;
            }
            return "";
          };
          setAllowedUsers(parseAllowedUsers(data.allowed_discord_usernames));
          setBlockedTabs(Array.isArray(data.blocked_tabs) ? data.blocked_tabs : []);
        }
      });
  }, []);

  const toggleTabLock = async (tabId) => {
    playSound('random_button');
    const isCurrentlyBlocked = blockedTabs.includes(tabId);
    const newBlockedTabs = isCurrentlyBlocked 
      ? blockedTabs.filter(id => id !== tabId)
      : [...blockedTabs, tabId];
    
    const { data: existing } = await supabase.from('global').select('id').eq('id', 1).maybeSingle();
    
    let updateOp;
    if (!existing) {
      updateOp = supabase.from('global').insert({ id: 1, blocked_tabs: newBlockedTabs });
    } else {
      updateOp = supabase.from('global').update({ blocked_tabs: newBlockedTabs }).eq('id', 1);
    }

    const { error } = await updateOp;
    if (!error) {
      setBlockedTabs(newBlockedTabs);
      showToast(isCurrentlyBlocked ? `Aba "${tabId}" desbloqueada.` : `Aba "${tabId}" bloqueada.`);
    } else {
      showToast("Erro ao atualizar bloqueio de abas.");
    }
  };

  const toggleMaintenance = async () => {
    playSound('random_button');
    const newState = !isMaintenanceActive;
    const usernamesArray = allowedUsers.split(',').map(s => s.trim()).filter(s => s !== "");
    
    // Explicitly check for id=1 record first to ensure it exists
    const { data: existing } = await supabase.from('global').select('id').eq('id', 1).maybeSingle();
    
    let updateOp;
    if (!existing) {
      updateOp = supabase.from('global').insert({
        id: 1,
        is_maintenance_active: newState,
        allowed_discord_usernames: usernamesArray
      });
    } else {
      updateOp = supabase.from('global')
        .update({ 
          is_maintenance_active: newState,
          allowed_discord_usernames: usernamesArray
        })
        .eq('id', 1);
    }

    const { error } = await updateOp;

    if (!error) {
      setIsMaintenanceActive(newState);
      showToast(newState ? "⚠️ MANUTENÇÃO ATIVADA!" : "✅ SITE ONLINE!");
    } else {
      console.error("Maintenance toggle error:", error);
      showToast(`Erro ao atualizar manutenção: ${error.message}`);
    }
  };

  const updateAllowedUsers = async () => {
    playSound('random_button');
    const usernamesArray = allowedUsers.split(',').map(s => s.trim()).filter(s => s !== "");
    
    const { data: existing } = await supabase.from('global').select('id').eq('id', 1).maybeSingle();
    
    let updateOp;
    if (!existing) {
      updateOp = supabase.from('global').insert({
        id: 1,
        allowed_discord_usernames: usernamesArray
      });
    } else {
      updateOp = supabase.from('global')
        .update({ allowed_discord_usernames: usernamesArray })
        .eq('id', 1);
    }

    const { error } = await updateOp;

    if (!error) {
      showToast("Lista de usuários atualizada!");
    } else {
      console.error("Update allowed users error:", error);
      showToast(`Erro ao atualizar lista: ${error.message}`);
    }
  };

  const toggleCombatant = async (p) => {
    playSound('random_button');
    const maxLife = (p.strength || 0) + (p.resistance || 0) * 4;
    // Get HP from stage or default to max
    const stagedHP = hpStage[p.id] !== undefined ? hpStage[p.id] : maxLife;

    // Direct update. Don't wait for the return to keep the UI snappy.
    supabase.from('characters')
      .update({ 
        is_in_combat: !p.is_in_combat,
        current_hp: stagedHP 
      })
      .eq('id', p.id)
      .then(({error}) => {
        if (error) showToast("Erro ao sincronizar.");
      });
  };

  const toggleGlobalCombat = async () => {
    playSound('random_button');
    const newState = !isCombatActive;
    await supabase.from('characters').update({ is_in_combat: newState }).eq('rank', 'Mestre');
    await supabase.from('global').update({ is_combat_active: newState }).eq('id', 1);

    if (newState) {
      showToast("⚔️ COMBATE INICIADO!");
      setActiveTab('combat'); // Redirect to combat tab
    } else {
      showToast("🕊️ MODO ROLEPLAY");
    }
  };

  const startSession = async () => {
    playSound('random_button');
    if (isSessionActive) return;
    // Update global state and clear messages atomically
    const { error } = await supabase.rpc('toggle_session', { status: true });
    
    if (!error) {
      showToast("🟢 SESSÃO INICIADA!");
    } else {
      showToast(`Erro: ${error.message || "Falha na conexão"}`);
    }
  };

  const endSession = async () => {
    playSound('random_button');
    if (!isSessionActive) return;
    // Update global state
    const { error } = await supabase.rpc('toggle_session', { status: false });
    
    if (!error) {
      showToast("🔴 SESSÃO ENCERRADA!");
    } else {
      showToast(`Erro: ${error.message || "Falha na conexão"}`);
    }
  };

  // --- EXISTING ADMIN HANDLERS ---
  const handleApprove = async (req) => {
    setModal({
      isOpen: true,
      title: "Aprovar Mudanças",
      message: `Deseja aplicar as alterações de ${req.player_name}?`,
      onConfirm: async () => {


        const tempData = { ...req.new_data };
        if (tempData.name) {
          tempData.char_name = tempData.name;
          delete tempData.name;
        }
        console.log("Original new_data:", req.new_data);
        console.log("Modified new_data for update:", tempData);
        const { error: charError } = await supabase.from("characters")
          .update({ ...tempData, needs_celebration: true })
          .eq('id', req.player_id);

        if (!charError) {
          await supabase.from('change_requests').delete().match({ id: req.id });
          if (typeof setRequests === 'function') {
            setRequests(prev => prev.filter(r => r.id !== req.id));
          }
          playSound('celebration');
          showToast("Mudanças Aplicadas!");
        } else {
          console.error("Error updating character:", charError);
          showToast(`Erro ao aplicar mudanças: ${charError.message}`);
        }
        closeModal();
      }
    });
  };

  const handleReject = async (id) => {
    const { error } = await supabase.from('change_requests').delete().match({ id: id });
    if (!error) {
      showToast("Pedido Recusado.");
    } else {
      console.error("Error rejecting request:", error);
    }
  };

  const handleAddPS = (p) => {
    setModal({
      isOpen: true,
      title: "Adicionar Ponto de Status",
      message: `Quanto Ponto de Status deseja dar para @${p.discord_username}?`,
      input: true,
      inputValue: '',
      setInputValue: (v) => setModal(prev => ({ ...prev, inputValue: v })),
      onConfirm: async (val) => {
        const pts = parseInt(val);
        if (isNaN(pts)) return;
        await supabase.from('characters').update({
          stat_points_available: (p.stat_points_available || 0) + pts
        }).eq('id', p.id);
        showToast(`${pts} Pontos de Status Adicionados!`);
        closeModal();
      }
    });
  };

  const handleAddResp = (p) => {
    setModal({
      isOpen: true,
      title: "Adicionar Ponto de Respiração",
      message: `Quanto Ponto de Respiração deseja dar para @${p.discord_username}?`,
      input: true,
      inputValue: '',
      setInputValue: (v) => setModal(prev => ({ ...prev, inputValue: v })),
      onConfirm: async (val) => {
        const pts = parseInt(val);
        if (isNaN(pts)) return;
        await supabase.from('characters').update({
          breathing_points: (p.breathing_points || 0) + pts
        }).eq('id', p.id);
        showToast(`${pts} Pontos de Respiração Adicionados!`);
        closeModal();
      }
    });
  };

  const handleReset = (p) => {
    setModal({
      isOpen: true,
      title: "RESET TOTAL",
      message: `Deseja resetar totalmente a ficha de @${p.discord_username}? Esta ação é irreversível.`,
      type: 'danger',
      onConfirm: async () => {
        await supabase.from('characters').update({
          strength: 1, resistance: 1, aptitude: 1, agility: 1, precision: 1,
          intelligence: 1, luck: 1, charisma: 1, stat_points_available: 0,
          dollars: 0, age: 0, height: '0,00m', class: 'Civil', rank: 'E - Recruta',
          breathing_lvl: 1, breathing_style: 'Nenhuma', anomalies: [], skills: [],
          inventory: [], is_in_combat: false, approved_once: false
        }).eq('id', p.id);
        showToast("Ficha Resetada.");
        closeModal();
      }
    });
  };

  const handleDelete = (p) => {
    setModal({
      isOpen: true,
      title: "DELETAR FICHA",
      message: `Deseja excluir PERMANENTEMENTE a ficha de @${p.discord_username}? Esta ação não pode ser desfeita.`,
      type: 'danger',
      onConfirm: async () => {
        const { error } = await supabase.from('characters').delete().eq('id', p.id);
        if (!error) showToast("Ficha excluída permanentemente.");
        closeModal();
      }
    });
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* COMBAT MANAGER */}
        <div className="bg-zinc-900/50 p-8 rounded-[40px] border border-zinc-800 shadow-2xl flex flex-col h-full">
          <h3 className="font-black text-red-600 uppercase text-[10px] mb-2 tracking-[0.2em] italic">Controle de Sessão</h3>
          <p className="text-zinc-500 text-[10px] mb-6 font-bold uppercase">Gerencie a disponibilidade da aba de sessão.</p>
          
          <div className="flex-1 flex flex-col items-center justify-center space-y-6 py-8">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl shadow-2xl transition-all duration-500 ${isSessionActive ? 'bg-green-600/20 text-green-500 border border-green-500/50 animate-pulse' : 'bg-zinc-800 text-zinc-600 border border-zinc-700'}`}>
              {isSessionActive ? '⚔️' : '💤'}
            </div>
            <div className="text-center">
              <p className={`text-[10px] font-black uppercase tracking-[0.2em] ${isSessionActive ? 'text-green-500' : 'text-zinc-500'}`}>
                {isSessionActive ? "Sessão em Andamento" : "Sessão Hibernando"}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={(e) => { e.preventDefault(); startSession(); }}
              disabled={isSessionActive}
              className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all border shadow-2xl ${isSessionActive ? 'bg-zinc-900/50 text-zinc-600 border-zinc-800 cursor-not-allowed' : 'bg-green-600 text-white border-green-500 hover:scale-[1.02] hover:bg-green-500'}`}
            >
              INICIAR SESSÃO
            </button>

            <button
              onClick={(e) => { e.preventDefault(); endSession(); }}
              disabled={!isSessionActive}
              className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all border shadow-2xl ${!isSessionActive ? 'bg-zinc-900/50 text-zinc-600 border-zinc-800 cursor-not-allowed' : 'bg-red-600 text-white border-red-500 hover:scale-[1.02] hover:bg-red-500'}`}
            >
              FINALIZAR SESSÃO
            </button>
            
            {isSessionActive && (
              <button
                onClick={() => { playSound('tab_change'); setActiveTab('combat'); }}
                className="w-full py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all border border-red-600/50 text-red-500 hover:bg-red-600 hover:text-white"
              >
                IR PARA O CHAT
              </button>
            )}
          </div>
        </div>

        {/* MAINTENANCE MANAGER */}
        <div className="bg-zinc-900/50 p-8 rounded-[40px] border border-zinc-800 shadow-2xl flex flex-col h-full">
          <h3 className="font-black text-yellow-600 uppercase text-[10px] mb-2 tracking-[0.2em] italic">Manutenção</h3>
          <p className="text-zinc-500 text-[10px] mb-6 font-bold uppercase">Restrinja o acesso ao site para manutenção.</p>
          
          <div className="flex-1 space-y-4">
            <div className="space-y-2">
              <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest ml-2">Usuários Permitidos (Discord)</label>
              <textarea
                value={allowedUsers}
                onChange={(e) => setAllowedUsers(e.target.value)}
                placeholder="username1, username2..."
                className="w-full bg-black/40 border border-zinc-800 rounded-2xl p-4 text-xs text-white outline-none focus:border-yellow-500/50 h-24 resize-none font-mono"
              />
              <p className="text-[8px] text-zinc-600 italic px-2">Separe os nomes por vírgula. O mestre sempre tem acesso.</p>
            </div>

            <button
              onClick={updateAllowedUsers}
              className="w-full py-3 rounded-xl font-black uppercase tracking-widest text-[9px] bg-zinc-800 text-zinc-400 border border-zinc-700 hover:text-white hover:border-zinc-500 transition-all"
            >
              SALVAR LISTA
            </button>

            {/* TAB LOCKER */}
            <div className="mt-8 pt-8 border-t border-white/5 space-y-4">
              <h4 className="text-[9px] font-black text-zinc-600 uppercase tracking-widest ml-2">Bloqueio de Abas</h4>
              <div className="grid grid-cols-2 gap-2">
                {LOCKABLE_TABS.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => toggleTabLock(tab.id)}
                    className={`flex items-center justify-between px-4 py-2.5 rounded-xl border transition-all text-[9px] font-black uppercase ${blockedTabs.includes(tab.id) 
                      ? 'bg-red-600/10 border-red-600/50 text-red-500' 
                      : 'bg-zinc-800/50 border-zinc-700 text-zinc-500 hover:text-zinc-300'}`}
                  >
                    <span>{tab.label}</span>
                    <span>{blockedTabs.includes(tab.id) ? '🔒' : '🔓'}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-white/5">
            <button
              onClick={toggleMaintenance}
              className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all border shadow-2xl ${isMaintenanceActive ? 'bg-red-600 text-white border-red-500 hover:bg-red-500' : 'bg-yellow-600 text-black border-yellow-500 hover:bg-yellow-500'}`}
            >
              {isMaintenanceActive ? "DESATIVAR MANUTENÇÃO" : "ATIVAR MANUTENÇÃO"}
            </button>
          </div>
        </div>

        {/* PENDING REQUESTS */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-[10px] font-black text-zinc-500 italic uppercase tracking-[0.3em] mb-4">Pedidos de Alteração</h2>
          {requests.length === 0 ? (
            <div className="bg-zinc-900/20 p-20 rounded-[40px] border border-zinc-800 border-dashed flex flex-col items-center">
              <span className="text-3xl mb-2">🍃</span>
              <p className="text-zinc-600 italic uppercase text-[9px] font-black tracking-widest">Nenhuma pendência no radar</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {requests.map((req) => {
                const isLocked = (now - new Date(req.created_at).getTime()) < 3000 || now < globalLock;
                return (
                  <div key={req.id} className="bg-zinc-900 p-6 rounded-[30px] border border-white/5 flex flex-col gap-4 shadow-xl">
                    <div className="flex justify-between items-center border-b border-white/5 pb-3">
                      <h3 className="text-xl font-black uppercase italic text-white">{req.player_name}</h3>
                      <div className="flex gap-2">
                        <button disabled={isLocked} onClick={() => { playSound('random_button'); handleApprove(req); }} className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${isLocked ? 'bg-zinc-800 text-zinc-600' : 'bg-green-600 hover:bg-green-500'}`}>Aprovar</button>
                        <button disabled={isLocked} onClick={() => { playSound('random_button'); handleReject(req.id); }} className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${isLocked ? 'bg-zinc-800 text-zinc-600' : 'bg-red-600 hover:bg-red-500'}`}>Recusar</button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-[9px] font-mono bg-black/40 p-4 rounded-2xl border border-white/5">
                      <div className="space-y-1 text-red-500/70">
                        <p className="font-black uppercase border-b border-red-900/20 mb-2">Original</p>
                        {Object.keys(req.new_data).map(k => JSON.stringify(req.old_data[k]) !== JSON.stringify(req.new_data[k]) ? <p key={k}>{k}: {JSON.stringify(req.old_data[k])}</p> : null)}
                      </div>
                      <div className="space-y-1 text-green-500 border-l border-white/5 pl-4">
                        <p className="font-black uppercase border-b border-green-900/20 mb-2 text-green-500/70">Novo</p>
                        {Object.keys(req.new_data).map(k => JSON.stringify(req.old_data[k]) !== JSON.stringify(req.new_data[k]) ? <p key={k}>{k}: <span className="text-white">{JSON.stringify(req.new_data[k])}</span></p> : null)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* SECTION 2: PLAYER ADMINISTRATION */}
      <div className="bg-zinc-900/30 p-10 rounded-[50px] border border-zinc-800 shadow-2xl">
        <h3 className="font-black text-zinc-500 uppercase text-[10px] mb-8 italic tracking-[0.4em] text-center">Lista Geral de Caçadores</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {allPlayers.map(p => (
            <div key={p.id} className="bg-black/40 p-6 rounded-[30px] border border-white/5 flex flex-col gap-4 group hover:border-zinc-700 transition-all">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs font-black text-red-600 uppercase italic tracking-tighter">{p.char_name || "Sem Nome"}</p>
                  <p className="text-[8px] text-zinc-600 font-bold uppercase mt-1">@{p.discord_username}</p>
                </div>
                <div className="bg-yellow-500/10 text-yellow-500 px-3 py-1 rounded border border-yellow-500/30 text-[10px] font-black font-mono">
                  {p.stat_points_available || 0} PS | {p.breathing_points || 0} PR
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => { playSound('tab_change'); onVisualize(p); }} className="text-[8px] font-black bg-blue-600/20 text-blue-400 border border-blue-600/30 py-2.5 rounded-xl hover:bg-blue-600 hover:text-white transition-all">VISUALIZAR</button>
                <button onClick={() => { playSound('random_button'); handleAddPS(p); }} className="text-[8px] font-black bg-green-600/20 text-green-400 border border-green-600/30 py-2.5 rounded-xl hover:bg-green-600 hover:text-white transition-all">+ Ponto de Status</button>
                <button onClick={() => { playSound('random_button'); handleAddResp(p); }} className="text-[8px] font-black bg-cyan-600/20 text-cyan-400 border border-cyan-600/30 py-2.5 rounded-xl hover:bg-cyan-600 hover:text-white transition-all">+ Ponto de Resp.</button>
                <button onClick={() => { playSound('random_button'); handleReset(p); }} className="text-[8px] font-black bg-zinc-800 text-zinc-500 py-2.5 rounded-xl hover:bg-zinc-700 hover:text-white transition-all">RESETAR</button>
                <button onClick={() => { playSound('random_button'); handleDelete(p); }} className="text-[8px] font-black bg-red-900/20 text-red-500 border border-red-900/30 py-2.5 rounded-xl hover:bg-red-600 hover:text-white transition-all col-span-2">EXCLUIR</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
