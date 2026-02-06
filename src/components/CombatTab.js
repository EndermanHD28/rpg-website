"use client";
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { handleCommand } from '../lib/commands';

export default function CombatTab({ user, allPlayers, messages, isCombatActive, isMaster }) {
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  const scrollRef = useRef();

  const combatants = allPlayers.filter(p => p.is_in_combat && p.rank !== 'Mestre');

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const groupMessages = (msgs) => {
    const groups = [];
    if (!msgs || msgs.length === 0) return groups;

    msgs.forEach((m) => {
      const lastGroup = groups[groups.length - 1];
      const mDate = new Date(m.created_at);
      
      if (lastGroup && lastGroup.player_name === m.player_name) {
        const firstInGroupDate = new Date(lastGroup.messages[0].created_at);
        const diffMinutes = (mDate - firstInGroupDate) / (1000 * 60);

        if (lastGroup.messages.length < 6 && diffMinutes < 3) {
          lastGroup.messages.push(m);
          return;
        }
      }

      groups.push({
        id: m.id,
        player_name: m.player_name,
        created_at: m.created_at,
        messages: [m]
      });
    });

    return groups;
  };

  const filteredMessages = messages.filter(m => !m.is_system || isMaster);
  const groupedMessages = groupMessages(filteredMessages);

  const validateHP = (val) => {
    if (!val) return true;
    if (val.toLowerCase() === 'full') return true;
    if (val.endsWith('%')) return !isNaN(parseInt(val.replace('%', '')));
    return !isNaN(parseInt(val));
  };

  const [commandHelp, setCommandHelp] = useState(null);
  const [isInvalid, setIsInvalid] = useState(false);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setInput(value);

    if (!isMaster) {
      setSuggestions([]);
      setCommandHelp(null);
      setIsInvalid(false);
      return;
    }

    const parts = value.trimStart().split(/\s+/);
    const lastWord = value.split(" ").slice(-1)[0] || "";

    // 1. Mentions (Trigger if the word being typed contains @)
    const atIndex = lastWord.lastIndexOf("@");
    if (atIndex !== -1) {
      const query = lastWord.substring(atIndex + 1).toLowerCase();
      const filtered = allPlayers
        .filter(p => p.rank !== 'Mestre' && (
          p.discord_username?.toLowerCase().includes(query) ||
          p.char_name?.toLowerCase().includes(query)
        ))
        .map(p => ({ display: p.char_name, value: `.${p.discord_username}` }));
      
      setSuggestions(filtered);
      setActiveSuggestionIndex(0);
      setCommandHelp(null);
      return;
    }

    // 2. Command Logic
    if (value.startsWith("/")) {
      const cmd = parts[0];
      const sub = parts[1];
      const hp = parts[2];

      if (parts.length === 1) {
        // Suggest base commands
        const commands = [
          { display: "/combat", value: "combat" }
        ];
        const query = value.substring(1).toLowerCase();
        setSuggestions(commands.filter(c => c.value.includes(query)));
        setCommandHelp(null);
      } else if (cmd === "/combat") {
        const subcommands = ["start", "add-player", "remove-player", "ko-player", "finish"];
        
        if (parts.length === 2 && !value.endsWith(" ")) {
          // Suggest subcommands
          const query = sub.toLowerCase();
          setSuggestions(subcommands.filter(s => s.includes(query)).map(s => ({ display: s, value: s })));
          setCommandHelp(null);
        } else {
          setSuggestions([]);
          // Positional help
          if (sub === "start" || sub === "add-player") {
            setCommandHelp("healthAmount players");
            setIsInvalid(hp && !validateHP(hp));
          } else if (sub === "remove-player" || sub === "ko-player") {
            setCommandHelp("players");
            setIsInvalid(false);
          } else if (sub === "finish") {
            setCommandHelp("");
            setIsInvalid(false);
          } else {
            setCommandHelp(null);
            setIsInvalid(false);
          }
        }
      }
    } else {
      setSuggestions([]);
      setCommandHelp(null);
      setIsInvalid(false);
    }
  };

  const applySuggestion = (suggestion) => {
    const valueTrimmed = input.trimEnd();
    const words = valueTrimmed.split(/\s+/);
    const lastWord = words[words.length - 1] || "";
    
    words.pop();

    let newValue = "";
    const atIndex = lastWord.lastIndexOf("@");
    if (atIndex !== -1) {
      const prefix = lastWord.substring(0, atIndex + 1); // everything including the @
      newValue = [...words, prefix + suggestion.value].join(" ") + " ";
    } else if (lastWord.startsWith("/")) {
      newValue = [...words, "/" + suggestion.value].join(" ") + " ";
    } else {
      // For subcommands (start, add-player etc) that don't have their own prefix but are part of a command
      newValue = [...words, suggestion.value].join(" ") + " ";
    }

    setInput(newValue);
    setSuggestions([]);
    
    // Trigger help update for the new input
    handleInputChange({ target: { value: newValue } });
  };

  const onKeyDown = (e) => {
    if (suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveSuggestionIndex(prev => (prev + 1) % suggestions.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveSuggestionIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        applySuggestion(suggestions[activeSuggestionIndex]);
      } else if (e.key === 'Escape') {
        setSuggestions([]);
      }
    }
  };

  const sendMsg = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    if (input.startsWith('/')) {
      const res = await handleCommand(input, user, allPlayers);
      if (res.success) {
        await supabase.from('messages').insert({
          player_name: "SISTEMA",
          content: `✅ ${res.message}`,
          is_system: true
        });
      } else {
        await supabase.from('messages').insert({
          player_name: "SISTEMA",
          content: `❌ ${res.message}`,
          is_system: true
        });
      }
    } else {
      await supabase.from('messages').insert({
        player_name: user?.user_metadata?.full_name || user?.user_metadata?.preferred_username,
        content: input
      });
    }
    setInput("");
    setSuggestions([]);
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
        <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
          {groupedMessages.map((group, i) => {
            const sender = allPlayers.find(p => p.char_name === group.player_name || p.user_metadata?.full_name === group.player_name || p.user_metadata?.preferred_username === group.player_name);
            const avatar = sender?.image_url;

            return (
              <div key={group.id || i} className="group animate-in fade-in slide-in-from-left-2 duration-300 flex flex-col gap-2">
                <div className="flex items-start gap-4">
                  {/* Avatar near name */}
                  <div className="shrink-0 mt-1">
                    {avatar ? (
                      <img src={avatar} className="w-8 h-8 rounded-full object-cover border border-white/10" alt="" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-zinc-800 border border-white/5 flex items-center justify-center text-[10px] opacity-40">
                        {group.player_name === 'SISTEMA' ? '⚙️' : '👤'}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 flex flex-col gap-1">
                    <div className="flex items-baseline gap-2">
                      <span className={`font-black italic uppercase text-[11px] tracking-tight shrink-0 ${group.player_name === 'SISTEMA' ? 'text-cyan-500' : 'text-red-600'}`}>
                        {group.player_name}
                      </span>
                      <span className="text-[7px] font-black text-zinc-700 uppercase font-mono">
                        {new Date(group.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </span>
                    </div>
                    <div className="flex flex-col gap-2 mt-1">
                  {group.messages.map((m, mi) => (
                    <p key={m.id || `${i}-${mi}`} className={`text-sm leading-relaxed font-medium break-words ${group.player_name === 'SISTEMA' ? 'text-cyan-400 italic font-bold' : 'text-zinc-300'}`}>
                      {m.content}
                    </p>
                  ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={scrollRef} />
        </div>

        {/* Input Area */}
        <form onSubmit={sendMsg} className="shrink-0 p-8 bg-black/60 border-t border-white/5 relative">
          {suggestions.length > 0 && (
            <div className="absolute bottom-full left-8 mb-2 w-64 bg-zinc-900 border border-white/10 rounded-xl overflow-hidden shadow-2xl z-50">
              {suggestions.map((s, i) => (
                <div
                  key={i}
                  onClick={() => applySuggestion(s)}
                  className={`px-4 py-2 text-xs font-bold cursor-pointer transition-colors ${i === activeSuggestionIndex ? 'bg-red-600 text-white' : 'text-zinc-400 hover:bg-white/5'}`}
                >
                  {s.display}
                </div>
              ))}
            </div>
          )}
          <div className="relative">
            <input
              value={input}
              onChange={handleInputChange}
              onKeyDown={onKeyDown}
              placeholder="Interaja com o mundo..."
              className={`w-full bg-zinc-900 border ${isInvalid ? 'border-red-600' : 'border-white/10'} rounded-2xl px-8 py-5 text-white text-sm outline-none focus:border-red-600 transition-all shadow-2xl`}
            />
            {commandHelp && (
              <div className="absolute left-8 top-1/2 -translate-y-1/2 pointer-events-none text-sm font-mono opacity-20 whitespace-pre">
                <span className="text-transparent">{input}</span>
                <span className="text-white">{commandHelp}</span>
              </div>
            )}
          </div>

          {isMaster && (
            <div className="mt-6 space-y-2">
              <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest ml-2">Comandos Comuns</p>
              <div className="bg-zinc-900/50 rounded-2xl p-4 border border-white/5 flex flex-wrap gap-3">
                {[
                  '/combat start full @.player',
                  '/combat add-player 100% @.player',
                  '/combat finish',
                  '/combat remove-player @.player',
                  '/combat ko-player @.player'
                ].map(cmd => (
                  <code
                    key={cmd}
                    onClick={() => { setInput(cmd); handleInputChange({ target: { value: cmd } }); }}
                    className="text-[10px] bg-black/40 px-3 py-1.5 rounded-lg border border-white/5 text-zinc-400 hover:text-white hover:border-zinc-500 cursor-pointer transition-all font-mono"
                  >
                    {cmd}
                  </code>
                ))}
              </div>
            </div>
          )}
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
            <div key={p.id} className="relative group bg-zinc-900 border border-white/5 rounded-2xl p-6 shadow-2xl hover:border-red-600/40 transition-all duration-500 overflow-hidden shrink-0">
              <div className="flex items-center gap-4 mb-4">
                {p.image_url ? (
                  <img src={p.image_url} className="w-12 h-12 rounded-lg object-cover border border-white/5 shrink-0" alt="" />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-black/40 border border-white/5 flex items-center justify-center text-xl shrink-0">
                    👤
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-black italic text-white uppercase text-sm tracking-tighter truncate">{p.char_name}</p>
                  <span className="font-mono text-[10px] font-black text-red-500">{currentLife}/{maxLife}</span>
                </div>
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