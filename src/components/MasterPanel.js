"use client";

export default function MasterPanel({ requests, allPlayers, onApprove, onReject, onVisualize, onAddPS, onReset, onDelete, now, globalLock }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-500">
      <div className="lg:col-span-2 space-y-6">
        <h2 className="text-3xl font-black text-red-500 italic uppercase tracking-tighter">Pedidos de Mudança</h2>
        {requests.length === 0 ? <p className="text-gray-500 italic text-sm">Nenhum pedido pendente.</p> : (
          <div className="grid grid-cols-1 gap-4">
            {requests.map((req) => {
              const disabled = (now - new Date(req.created_at).getTime()) < 3000 || now < globalLock;
              return (
                <div key={req.id} className="bg-slate-900 p-6 rounded-2xl border border-red-500/30 flex flex-col gap-4 shadow-xl">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-xl font-bold text-white italic tracking-tighter uppercase leading-none">{req.player_name}</h3>
                      <p className="text-[9px] text-gray-500 uppercase mt-1">Solicitou mudanças</p>
                    </div>
                    <div className="flex gap-3">
                      <button disabled={disabled} onClick={() => onApprove(req)} className={`px-4 py-2 rounded font-bold text-xs uppercase transition-all ${disabled ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-green-600 hover:bg-green-500 hover:scale-105 cursor-pointer'}`}>Aprovar</button>
                      <button disabled={disabled} onClick={() => onReject(req.id)} className={`px-4 py-2 rounded font-bold text-xs uppercase transition-all ${disabled ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-red-600 hover:bg-red-400 hover:scale-105 cursor-pointer'}`}>Recusar</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 bg-black/40 p-4 rounded-xl text-[10px] font-mono italic">
                    <div className="border-r border-white/5 pr-2 text-red-500"><p className="mb-2 font-bold underline uppercase">Atual</p>
                      {Object.keys(req.new_data).map(k => JSON.stringify(req.old_data[k]) !== JSON.stringify(req.new_data[k]) ? <p key={k}>{k}: {JSON.stringify(req.old_data[k])}</p> : null)}
                    </div>
                    <div className="pl-2 text-green-500"><p className="mb-2 font-bold underline uppercase">Novo</p>
                      {Object.keys(req.new_data).map(k => JSON.stringify(req.old_data[k]) !== JSON.stringify(req.new_data[k]) ? <p key={k}>{k}: <span className="text-white font-bold">{JSON.stringify(req.new_data[k])}</span></p> : null)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-slate-900/50 p-6 rounded-[30px] border-2 border-slate-800 h-fit shadow-2xl">
        <h3 className="font-black text-gray-500 uppercase tracking-widest text-xs mb-6 border-b border-slate-800 pb-2 italic leading-none">Lista de Jogadores</h3>
        <div className="space-y-3">
          {allPlayers.map(p => (
            <div key={p.id} className="bg-black/20 p-4 rounded-xl border border-white/5 flex flex-col gap-3">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-black text-yellow-500 uppercase italic tracking-tighter leading-none">@{p.discord_username}</p>
                  <p className="text-[10px] text-gray-400 font-bold uppercase mt-1 tracking-tighter">Persona: {p.char_name}</p>
                </div>
                <span className="text-[10px] bg-yellow-500/10 text-yellow-500 px-2 py-0.5 rounded border border-yellow-500/20 font-bold font-mono">{p.stat_points_available} PS</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => onVisualize(p)} className="text-[8px] font-bold bg-blue-600/20 text-blue-400 border border-blue-600/30 py-1.5 rounded hover:bg-blue-600 hover:text-white transition-all cursor-pointer">VISUALIZAR</button>
                <button onClick={() => onAddPS(p)} className="text-[8px] font-bold bg-green-600/20 text-green-400 border border-green-600/30 py-1.5 rounded hover:bg-green-600 hover:text-white transition-all cursor-pointer">+ PS</button>
                <button onClick={() => onReset(p)} className="text-[8px] font-bold bg-gray-600/20 text-gray-400 border border-gray-600/30 py-1.5 rounded hover:bg-gray-600 hover:text-white transition-all cursor-pointer">RESETAR</button>
                <button onClick={() => onDelete(p)} className="text-[8px] font-bold bg-red-600/20 text-red-400 border border-red-600/30 py-1.5 rounded hover:bg-red-600 hover:text-white transition-all cursor-pointer">EXCLUIR</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}