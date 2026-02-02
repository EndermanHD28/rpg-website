"use client";
import { supabase } from '../lib/supabase';

export default function MasterPanel({ requests, allPlayers, onVisualize, showToast, setModal, closeModal, now, globalLock }) {
  const handleApprove = async (req) => {
    setModal({
      isOpen: true,
      title: "Aprovar Mudanças",
      message: `Deseja aplicar as alterações de ${req.player_name}?`,
      onConfirm: async () => {
        // 1. Update the character with the NEW data from the request
        const { error: charError } = await supabase.from('characters')
          .update({ ...req.new_data, needs_celebration: true })
          .eq('id', req.player_id);

        if (!charError) {
          // 2. Mark the request as approved so it disappears
          await supabase.from('change_requests').update({ status: 'approved' }).eq('id', req.id);
          showToast("Mudanças Aplicadas!");
        } else {
          showToast("Erro ao aplicar mudanças.");
        }
        closeModal();
      }
    });
  };

  const handleReject = async (id) => {
    const { error } = await supabase.from('change_requests').update({ status: 'rejected' }).eq('id', id);
    if (!error) showToast("Pedido Recusado.");
  };

  const handleAddPS = (p) => {
    setModal({
      isOpen: true,
      title: "Adicionar PS",
      message: `Quanto PS deseja dar para @${p.discord_username}?`,
      input: true,
      inputValue: '',
      setInputValue: (v) => setModal(prev => ({ ...prev, inputValue: v })),
      onConfirm: async (val) => {
        const pts = parseInt(val);
        if (isNaN(pts)) return;
        await supabase.from('characters').update({
          stat_points_available: (p.stat_points_available || 0) + pts
        }).eq('id', p.id);
        showToast(`${pts} PS Adicionados!`);
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
          breathing_lvl: 1, breathing_style: 'Nenhuma', anomalies: [], skills: []
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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-500">
      <div className="lg:col-span-2 space-y-6">
        <h2 className="text-3xl font-black text-red-600 italic uppercase">Pedidos Pendentes</h2>
        {requests.length === 0 ? (
          <p className="text-zinc-600 italic uppercase text-xs">Nenhum pedido no momento.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {requests.map((req) => {
              // SECURITY CHECK
              const isLocked = (now - new Date(req.created_at).getTime()) < 3000 || now < globalLock;

              return (
                <div key={req.id} className="bg-zinc-900 p-6 rounded-2xl border border-red-900/30 flex flex-col gap-4">
                  <div className="flex justify-between items-center border-b border-white/5 pb-2">
                    <h3 className="text-xl font-bold uppercase italic text-white">{req.player_name}</h3>
                    <div className="flex gap-2">
                      <button
                        disabled={isLocked}
                        onClick={() => handleApprove(req)}
                        className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${isLocked ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed' : 'bg-green-600 hover:bg-green-500 hover:scale-105'
                          }`}
                      >
                        {isLocked ? "Aguarde..." : "Aprovar"}
                      </button>
                      <button
                        disabled={isLocked}
                        onClick={() => handleReject(req.id)}
                        className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${isLocked ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed' : 'bg-red-600 hover:bg-red-500 hover:scale-105'
                          }`}
                      >
                        Recusar
                      </button>
                    </div>
                  </div>

                  {/* Diff View */}
                  <div className="grid grid-cols-2 gap-4 text-[10px] font-mono bg-black/40 p-4 rounded-xl border border-white/5">
                    <div className="space-y-1 text-red-500">
                      <p className="font-black uppercase border-b border-red-900/30 mb-2">Original</p>
                      {Object.keys(req.new_data).map(k =>
                        JSON.stringify(req.old_data[k]) !== JSON.stringify(req.new_data[k]) ? (
                          <p key={k}>{k}: {JSON.stringify(req.old_data[k])}</p>
                        ) : null
                      )}
                    </div>
                    <div className="space-y-1 text-green-500 border-l border-white/5 pl-4">
                      <p className="font-black uppercase border-b border-green-900/30 mb-2">Novo</p>
                      {Object.keys(req.new_data).map(k =>
                        JSON.stringify(req.old_data[k]) !== JSON.stringify(req.new_data[k]) ? (
                          <p key={k}>{k}: <span className="text-white">{JSON.stringify(req.new_data[k])}</span></p>
                        ) : null
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-zinc-900/50 p-6 rounded-[30px] border border-zinc-800 h-fit">
        <h3 className="font-black text-zinc-500 uppercase text-[10px] mb-6 border-b border-zinc-800 pb-2 italic">Lista de Caçadores</h3>
        <div className="space-y-3">
          {allPlayers.map(p => (
            <div key={p.id} className="bg-black/20 p-4 rounded-xl border border-white/5 flex flex-col gap-3">
              <div className="flex justify-between items-start">
                <p className="text-xs font-black text-red-600 uppercase italic">@{p.discord_username}</p>
                {/* RESTORED YELLOW PS BADGE STYLE */}
                <div className="bg-yellow-500/10 text-yellow-500 px-3 py-1 rounded border border-yellow-500/30 text-[10px] font-black font-mono">
                  {p.stat_points_available || 0} PS
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => onVisualize(p)} className="text-[8px] font-bold bg-blue-600/20 text-blue-400 border border-blue-600/30 py-1.5 rounded hover:bg-blue-600 hover:text-white transition-all">VISUALIZAR</button>
                <button onClick={() => handleAddPS(p)} className="text-[8px] font-bold bg-green-600/20 text-green-400 border border-green-600/30 py-1.5 rounded hover:bg-green-600 hover:text-white transition-all">+ PS</button>
                <button onClick={() => handleReset(p)} className="text-[8px] font-bold bg-zinc-600/20 text-zinc-400 border border-zinc-600/30 py-1.5 rounded hover:bg-zinc-600 hover:text-white transition-all">RESETAR FICHA</button>
                <button onClick={() => handleDelete(p)} className="text-[8px] font-bold bg-red-900/20 text-red-500 border border-red-900/30 py-1.5 rounded hover:bg-red-600 hover:text-white transition-all uppercase">Excluir</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}