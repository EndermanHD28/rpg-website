"use client";
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { handleCommand, COMMANDS } from '../lib/commands';

export default function CombatTab({ user, allPlayers, messages, isCombatActive, isSessionActive, isMaster, isActingAsMaster, setActiveTab }) {
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

  const [suggestionData, setSuggestionData] = useState(null);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setInput(value);

    if (!isActingAsMaster || !value.startsWith('/')) {
      setSuggestionData(null);
      setSuggestions([]);
      return;
    }

    const inputContent = value.substring(1).toLowerCase();
    
    // 1. Mentions check
    const lastWord = value.split(" ").slice(-1)[0] || "";
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
      setSuggestionData(null);
      return;
    } else {
      setSuggestions([]);
    }

    // 2. Command suggestions
    const match = COMMANDS.find(c =>
      inputContent.startsWith(c.name) || c.name.startsWith(inputContent)
    );
    
    if (match && inputContent.length > 0) {
      setSuggestionData({
        match,
        fullHelp: `/${match.name} ` + match.args.map(a => `[${a.name}]`).join(" ")
      });
    } else {
      setSuggestionData(null);
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

    if (input.startsWith('/') && isActingAsMaster) {
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

  if (!isSessionActive) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-black p-12 text-center flex-1">
        <div className="relative">
          <div className="absolute inset-0 bg-red-600 blur-[100px] opacity-20"></div>
          <span className="text-8xl mb-8 block relative z-10">💤</span>
        </div>
        <h2 className="text-4xl font-black italic text-white uppercase tracking-tighter mb-4">Nenhuma Sessão Ativa</h2>
        <p className="text-zinc-500 font-medium italic text-lg max-w-md mb-8">
          O mestre ainda não iniciou a sessão de hoje. Prepare seus dados e aguarde o chamado para o combate.
        </p>
        
        {isActingAsMaster && (
          <div className="p-6 bg-zinc-900/50 rounded-2xl border border-yellow-500/30 max-w-sm">
            <p className="text-yellow-500 text-[10px] font-black uppercase tracking-widest mb-4">Acesso de Mestre</p>
            <p className="text-zinc-400 text-xs mb-6">Você está vendo esta mensagem porque a sessão está desligada para os jogadores.</p>
            <button
              onClick={() => setActiveTab('master')}
              className="px-6 py-2 bg-yellow-500 text-black font-black text-[10px] uppercase rounded-full hover:scale-105 transition-all"
            >
              Ir para Painel do Mestre
            </button>
          </div>
        )}

        <div className="mt-12 flex gap-4">
          <div className="w-2 h-2 rounded-full bg-zinc-800 animate-pulse"></div>
          <div className="w-2 h-2 rounded-full bg-zinc-800 animate-pulse delay-75"></div>
          <div className="w-2 h-2 rounded-full bg-zinc-800 animate-pulse delay-150"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 flex overflow-hidden bg-black">
      
      {/* CHAT AREA - Grows to fill space */}
      <div className="flex-1 flex flex-col min-w-0 bg-zinc-950 relative h-full">
        {!isSessionActive && isMaster && (
          <div className="absolute top-0 left-0 right-0 bg-yellow-500/10 border-b border-yellow-500/20 py-2 px-8 z-50 flex justify-center items-center gap-3">
            <span className="text-[10px] font-black text-yellow-500 uppercase tracking-widest">Aviso: A sessão está encerrada para os jogadores</span>
          </div>
        )}
        
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
            const sender = allPlayers.find(p =>
              p.char_name === group.player_name ||
              p.discord_username === group.player_name ||
              p.discord_username === group.player_name?.replace(/^@/, '') ||
              p.user_metadata?.full_name === group.player_name ||
              p.user_metadata?.preferred_username === group.player_name
            );
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
            {suggestionData && (
              <div className="absolute bottom-[calc(100%+0.5rem)] left-0 w-full bg-zinc-900/90 border border-white/10 rounded-xl px-8 py-3 pointer-events-none text-sm font-mono whitespace-pre flex z-50 backdrop-blur-sm shadow-2xl overflow-hidden">
                {(() => {
                  const { match, fullHelp } = suggestionData;
                  const inputVal = input.toLowerCase();
                  const cmdPart = `/${match.name}`;
                  
                  // Helper to validate arg
                  const isArgValid = (val, type) => {
                    if (!val) return true;
                    if (type === 'number') return !isNaN(parseFloat(val));
                    if (type === 'boolean') return val === 'true' || val === 'false';
                    if (type === 'array') return val.split(',').every(x => x.length > 0);
                    return true;
                  };

                  const cmdPartWithSlash = `/${match.name}`;
                  const inputWords = input.split(/\s+/);
                  const cmdWordsCount = match.name.split(/\s+/).length; // e.g. "combat start" is 2
                  
                  // We'll map through parts of the help string
                  const helpParts = [cmdPartWithSlash, ...match.args.map(a => `[${a.name}]`)];
                  
                  return helpParts.map((part, pIdx) => {
                    let color = 'text-zinc-600';
                    const isCommandPart = pIdx === 0;
                    
                    if (isCommandPart) {
                      // Command part: character by character check
                      return (
                        <span key={pIdx} className="flex">
                          {part.split("").map((char, cIdx) => {
                            const inputChar = input[cIdx];
                            let charColor = 'text-zinc-600';
                            if (inputChar !== undefined) {
                              charColor = inputChar.toLowerCase() === char.toLowerCase() ? 'text-white' : 'text-red-500';
                            }
                            return <span key={cIdx} className={charColor}>{char}</span>;
                          })}
                          <span className="text-zinc-600">&nbsp;</span>
                        </span>
                      );
                    } else {
                      // Argument part: whole word check
                      const argIndex = pIdx - 1;
                      const argDef = match.args[argIndex];
                      
                      // We need to find the word in input that corresponds to this arg
                      // This is tricky because of spaces in command name
                      const wordInInput = inputWords[cmdWordsCount + argIndex];
                      
                      if (wordInInput !== undefined && wordInInput.length > 0) {
                        color = isArgValid(wordInInput, argDef.type) ? 'text-white' : 'text-red-500';
                      }
                      
                      return (
                        <span key={pIdx} className={color}>
                          {part}
                          <span className="text-zinc-600">&nbsp;</span>
                        </span>
                      );
                    }
                  });
                })()}
              </div>
            )}
            <input
              value={input}
              onChange={handleInputChange}
              onKeyDown={onKeyDown}
              placeholder="Interaja com o mundo..."
              className="w-full bg-zinc-900 border border-white/10 rounded-2xl px-8 py-5 text-white text-sm outline-none focus:border-red-600 transition-all shadow-2xl"
            />
          </div>

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
