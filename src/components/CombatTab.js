"use client";
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

export default function CombatTab({ user, allPlayers, messages, isCombatActive, isMaster }) {
  const [input, setInput] = useState("");
  const scrollRef = useRef();

  const combatants = allPlayers.filter(p => p.is_in_combat && p.rank !== 'Mestre');

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMsg = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    await supabase.from('messages').insert({
      player_name: user?.user_metadata?.full_name || user?.user_metadata?.preferred_username,
      content: input
    });
    setInput("");
  };

  return (
    <div className="h-full w-full flex overflow-hidden bg-black">
      
      {/* CHAT AREA - Grows to fill space */}
      <div className="flex-1 flex flex-col min-w-0 bg-zinc-950">
        
        {/* Header */}
        <div className="shrink-0 p-8 flex justify-between items-center bg-black/40 border-b border-white/5">
          <div>
            <h2 className="text-3xl font-black italic text-white uppercase tracking-tighter">Sessão Ativa</h2>
            <div className="flex items-center gap-3 mt-1">
              <span className={`w-2 h-2 rounded-full ${isCombatActive ? 'bg-red-600 animate-ping' : 'bg-green-500'}`} />
              <p className={`text-[9px] font-black uppercase tracking-[0.2em] ${isCombatActive ? 'text-red-600' : 'text-green-500'}`}>
                {isCombatActive ? "Protocolo de Combate" : "Modo Roleplay Livre"}
              </p>
            </div>
          </div>
        </div>

        {/* Messages List */}
        <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
          {messages.map((m, i) => (
            <div key={m.id || i} className="group animate-in fade-in slide-in-from-left-2 duration-300">
              <div className="flex items-baseline gap-4">
                <span className="text-[8px] font-black text-zinc-700 uppercase font-mono shrink-0">
                  {new Date(m.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </span>
                <span className="font-black text-red-600 italic uppercase text-[11px] tracking-tight shrink-0">
                  {m.player_name}:
                </span>
                <p className="text-zinc-300 text-sm leading-relaxed font-medium break-words">
                  {m.content}
                </p>
              </div>
            </div>
          ))}
          <div ref={scrollRef} />
        </div>

        {/* Input Area */}
        <form onSubmit={sendMsg} className="shrink-0 p-8 bg-black/60 border-t border-white/5">
          <input 
            value={input} onChange={(e) => setInput(e.target.value)}
            placeholder="Interaja com o mundo..."
            className="w-full bg-zinc-900 border border-white/10 rounded-2xl px-8 py-5 text-white text-sm outline-none focus:border-red-600 transition-all shadow-2xl"
          />
        </form>
      </div>

      {/* PARTICIPANTS SIDEBAR - Fixed Width */}
      <div className="w-[400px] shrink-0 bg-zinc-950 p-8 flex flex-col gap-6 overflow-y-auto custom-scrollbar border-l border-white/5">
        <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.4em] italic text-center mb-2">Combatentes</h3>
        
        {combatants.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 opacity-20 grayscale">
            <span className="text-4xl mb-4">⚔️</span>
            <p className="text-[10px] font-black uppercase tracking-widest text-center">Nenhum combatente ativo</p>
          </div>
        ) : combatants.map(p => {
          const presence = (p.strength || 0) + (p.resistance || 0) + (p.aptitude || 0) + (p.agility || 0) + (p.precision || 0);
          const maxLife = (p.strength || 0) + (p.resistance || 0) * 4;
          const currentLife = p.current_hp ?? maxLife;
          const hpPerc = Math.max(0, (currentLife / maxLife) * 100);

          return (
            <div key={p.id} className="relative group bg-zinc-900 border border-white/5 rounded-[35px] p-6 shadow-2xl hover:border-red-600/40 transition-all duration-500 overflow-hidden shrink-0">
              <div className="flex justify-between items-center mb-4">
                <p className="font-black italic text-white uppercase text-sm tracking-tighter truncate pr-2">{p.char_name}</p>
                <span className="font-mono text-[10px] font-black text-red-500 shrink-0">{currentLife}/{maxLife}</span>
              </div>
              
              <div className="w-full h-2 bg-black/60 rounded-full overflow-hidden mb-5 border border-white/5">
                <div
                  className={`h-full transition-all duration-1000 ${hpPerc < 30 ? 'bg-red-600' : 'bg-red-500'}`}
                  style={{ width: `${hpPerc}%` }}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {p.inventory?.filter(i => i.equipped).map((item, idx) => (
                  <span key={idx} className="text-[7px] bg-blue-600/10 text-blue-500 border border-blue-500/20 px-2 py-1 rounded-lg font-black uppercase">
                    {item.name}
                  </span>
                ))}
              </div>

              {/* EXPANDABLE SECTION */}
              <div className="grid grid-rows-[0fr] group-hover:grid-rows-[1fr] transition-all duration-500 ease-in-out">
                <div className="overflow-hidden">
                  <div className="pt-6 mt-6 border-t border-white/5 space-y-4">
                    <div className="flex justify-around items-center">
                      <DiceBadge label="PAT (Arma)" val={`1d20+${p.precision}`} />
                      <DiceBadge label="PAT (Punho)" val={`1d20+${p.strength}`} />
                      <DiceBadge label="Loot" val={`1d${Math.round(15 + (5 * Math.pow(((p.luck / (presence || 1))*100) / 15, 0.8)))}`} />
                    </div>
                    
                    {p.nichirin_color && (
                      <div className="flex items-center justify-between px-2 pt-2">
                        <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Cor da Nichirin</span>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.5)]" style={{ backgroundColor: p.nichirin_color }} />
                          <span className="text-[10px] font-bold text-white uppercase font-mono" style={{ color: p.nichirin_color }}>{p.nichirin_color}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DiceBadge({ label, val }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-[8px] font-black text-zinc-500 uppercase tracking-tighter mb-1">{label}</span>
      <span className="text-base font-black text-red-500 font-mono">{val}</span>
    </div>
  );
}