"use client";
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { handleCommand, COMMANDS } from '../lib/commands';
import { rollDice, calculateWeaponPAT, calculateDisarmedPAT } from '../lib/rpg-math';
import GifPicker from './GifPicker';

export default function CombatTab({ user, allPlayers, messages, isCombatActive, isSessionActive, isMaster, isActingAsMaster, setActiveTab, turn, sharedImage }) {
  const [displayImage, setDisplayImage] = useState(sharedImage);
  const [isVisible, setIsVisible] = useState(!!sharedImage?.url);
  const [isContrastActive, setIsContrastActive] = useState(false);
  const [isBigImage, setIsBigImage] = useState(false);
  const [input, setInput] = useState("");
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  const scrollRef = useRef();
  const chatContainerRef = useRef(null);
  const isAtBottomRef = useRef(true);
  const [editingHP, setEditingHP] = useState(null); // { playerId, value }
  const [hpInput, setHpInput] = useState("");
  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);
  const [targetingRoll, setTargetingRoll] = useState(null); // { input, diceResult }

  const combatants = isCombatActive ? allPlayers.filter(p => p.is_in_combat && p.rank !== 'Mestre') : [];

  const handleScroll = () => {
    if (!chatContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    // Allow for a small margin of error (10px)
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    isAtBottomRef.current = isAtBottom;
  };

  useEffect(() => {
    if (isAtBottomRef.current) {
      scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  useEffect(() => {
    if (sharedImage?.url) {
      const isNewImage = sharedImage.url !== displayImage.url || (sharedImage.contrast && !displayImage.contrast);
      
      setDisplayImage(sharedImage);
      setIsVisible(true);

      // Effect for contrast and big image
      if (sharedImage.contrast && isNewImage) {
        setIsContrastActive(true);
        setIsBigImage(true);

        // Gradually return to normal size after 5 seconds
        const timer = setTimeout(() => {
          setIsBigImage(false);
          // Wait for the transition to finish before removing the backdrop effect
          setTimeout(() => setIsContrastActive(false), 1000);
        }, 5000);
        return () => clearTimeout(timer);
      }
    } else {
      setIsVisible(false);
      setIsContrastActive(false);
      setIsBigImage(false);
      // We keep displayImage.url as it is during the 700ms animation
      const timer = setTimeout(() => {
        setDisplayImage(sharedImage);
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [sharedImage?.url, sharedImage?.contrast]);

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

  const filteredMessages = messages.filter(m => !m.is_system || isMaster || m.content.startsWith('DICE_ROLL|'));
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
    const matches = COMMANDS.filter(c =>
      inputContent.startsWith(c.name) || c.name.startsWith(inputContent)
    );
    
    if (matches.length > 0 && inputContent.length > 0) {
      const bestMatch = matches.find(c => inputContent.startsWith(c.name)) || matches[0];
      
      setSuggestionData({
        match: bestMatch,
        fullHelp: `/${bestMatch.name} ` + bestMatch.args.map(a => a.optional ? `(${a.name})` : `[${a.name}]`).join(" ")
      });

      // Hide suggestions if the input exactly matches a command and we are likely typing arguments now
      const isExactMatch = matches.some(c => inputContent.trim() === c.name);
      const hasSpaceAfterMatch = value.trim().length < value.length;

      if (isExactMatch && hasSpaceAfterMatch) {
        setSuggestions([]);
      } else {
        const dropdownSuggestions = matches.map(c => ({
          display: `/${c.name}`,
          value: c.name
        }));
        setSuggestions(dropdownSuggestions);
      }
    } else {
      setSuggestionData(null);
      setSuggestions([]);
    }
  };

  const applySuggestion = (suggestion) => {
    if (!suggestion) return;

    const valueTrimmed = input.trimEnd();
    const words = valueTrimmed.split(/\s+/);
    const lastWord = words[words.length - 1] || "";
    
    words.pop();

    let newValue = "";
    const atIndex = lastWord.lastIndexOf("@");
    if (atIndex !== -1) {
      const prefix = lastWord.substring(0, atIndex + 1); // everything including the @
      newValue = [...words, prefix + (suggestion.value || "")].join(" ") + " ";
    } else if (lastWord.startsWith("/") || (suggestion?.display && suggestion.display.startsWith("/"))) {
      // If the suggestion already includes the slash (from command list) or the word being replaced starts with one
      const val = suggestion.value || "";
      const cleanValue = val.startsWith("/") ? val : "/" + val;
      newValue = [...words, cleanValue].join(" ") + " ";
    } else {
      // For subcommands (start, add-player etc) that don't have their own prefix but are part of a command
      newValue = [...words, suggestion.value || ""].join(" ") + " ";
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
      } else if (e.key === 'Tab') {
        e.preventDefault();
        applySuggestion(suggestions[activeSuggestionIndex]);
      } else if (e.key === 'Enter') {
        // Only autocomplete if the input doesn't already fully match a command
        const currentInput = input.trim().toLowerCase();
        const fullMatch = COMMANDS.some(c => {
          const cmdPrefix = "/" + c.name;
          return currentInput === cmdPrefix || currentInput.startsWith(cmdPrefix + " ");
        });
        
        if (!fullMatch) {
          e.preventDefault();
          applySuggestion(suggestions[activeSuggestionIndex]);
        }
        // If it is a full match, we don't preventDefault, allowing the form onSubmit (sendMsg) to trigger
      } else if (e.key === 'Escape') {
        setSuggestions([]);
      }
    } else if (targetingRoll && e.key === 'Escape') {
      setTargetingRoll(null);
    }
  };

  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (e.key === 'Escape' && targetingRoll) {
        setTargetingRoll(null);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [targetingRoll]);

  const handleHPSubmit = async (player, isShiftPressed = false) => {
    try {
      const baseLife = (player.strength || 0) + (player.resistance || 0) * 7;
      let maxLife = baseLife;
      if (Array.isArray(player.effects)) {
        player.effects.forEach(eff => {
          if (eff.modifiers?.maxLife) maxLife *= eff.modifiers.maxLife;
        });
      }
      maxLife = Math.floor(maxLife);

      // 1. Prepare equation: replace 'random' with Math.random()
      let equation = hpInput.toLowerCase().replace(/random/g, () => Math.random().toString());
      
      // 2. Evaluate equation safely
      let newHP;
      try {
        // Only allow numbers, math operators and decimal points
        // Scientific notation like 1e-5 might appear from Math.random()
        if (/[^0-9+\-*/().\s|e]/.test(equation)) {
           throw new Error("Invalid characters in equation");
        }
        newHP = Math.round(new Function(`return ${equation}`)());
      } catch (e) {
        console.error("Equation error:", e);
        alert("Equação inválida! " + e.message);
        return;
      }

      if (isNaN(newHP)) {
        alert("Resultado inválido!");
        return;
      }

      // If shift is not pressed, cap the HP at maxLife
      if (!isShiftPressed && newHP > maxLife) {
        newHP = maxLife;
      }

      // 3. Update Supabase
      console.log("Updating HP to:", newHP, "for player:", player.id);
      const { error, data } = await supabase
        .from('characters')
        .update({ current_hp: newHP })
        .eq('id', player.id)
        .select();

      if (error) {
        console.error("Supabase Error detail:", error);
        throw error;
      }

      console.log("Update success:", data);
      setEditingHP(null);
    } catch (err) {
      console.error("Error updating HP full object:", JSON.stringify(err, null, 2));
      alert("Erro ao atualizar HP: " + (err.message || "Verifique o console"));
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
      const playerName = user?.user_metadata?.full_name || user?.user_metadata?.preferred_username;
      const playerChar = allPlayers?.find(p => p.discord_username === user?.user_metadata?.preferred_username || p.discord_username === user?.user_metadata?.full_name);
      const playerImage = playerChar?.image_url || "";
      
      // Try to roll dice
      const diceResult = rollDice(input, playerChar);
      
      if (diceResult) {
        const isTargetingType = (diceResult.type === 'ataque' || diceResult.type === 'acerto' || diceResult.type === 'desvio' || diceResult.type === 'dano');
        
        if (isTargetingType) {
          setTargetingRoll({ input, diceResult, playerName, playerImage });
          setInput("");
          setSuggestions([]);
          setSuggestionData(null);
          return;
        }

        await finishDiceRoll(diceResult, input, playerName, playerImage);
      } else {
        // Normal message
        await supabase.from('messages').insert({
          player_name: playerName,
          content: input
        });
      }
    }
    setInput("");
    setSuggestions([]);
    setSuggestionData(null);
  };

  const finishDiceRoll = async (diceResult, originalInput, playerName, playerImage, targetPlayer = null) => {
    // Build detail string
    let detail = diceResult.original;
    diceResult.rolls.forEach(r => {
      detail = detail.replace(r.notation, `<span class="text-zinc-500 font-mono text-[10px]">[${r.results.join(', ')}]</span>`);
    });

    const statusLabel = diceResult.status !== "Normal" ? ` <span class="${diceResult.statusColor} text-[10px] font-black uppercase tracking-widest bg-black/40 px-2 py-0.5 rounded-full border border-white/5 shadow-sm">${diceResult.status}</span>` : "";

    // Categorize roll for coloring
    let category = "normal";
    const lowerInput = originalInput.toLowerCase();
    if (lowerInput.includes('pat') || diceResult.type === 'ataque' || diceResult.type === 'desvio' || diceResult.type === 'dano') {
      category = "combat";
    } else if (lowerInput.includes('convencimento') || lowerInput.includes('raciocínio') || lowerInput.includes('raciocinio')) {
      category = "secondary";
    } else if (lowerInput.includes('loot') || lowerInput.includes('prosperidade')) {
      category = "luck";
    }

    let finalTotal = diceResult.total;
    let effectNote = "";

    // Apply target-based effects (like Bleeding increasing damage taken)
    if (targetPlayer && diceResult.type === 'dano') {
      const targetEffects = Array.isArray(targetPlayer.effects) ? targetPlayer.effects : [];
      let damageMult = 1.0;
      targetEffects.forEach(eff => {
        if (eff.modifiers?.damageTaken) {
          damageMult *= eff.modifiers.damageTaken;
          effectNote += ` (${eff.emoji} +${Math.round((eff.modifiers.damageTaken - 1) * 100)}% de dano por ${eff.name})`;
        }
      });
      
      if (damageMult !== 1.0) {
        finalTotal = Math.round(finalTotal * damageMult);
      }
    }

    const targetInfo = targetPlayer ? `|${targetPlayer.char_name}${effectNote}` : "";

    await supabase.from('messages').insert({
      player_name: "SISTEMA",
      content: `DICE_ROLL|${playerName}|${originalInput}|${finalTotal}|${detail}|${statusLabel}|${category}|${playerImage}|${diceResult.type || ''}${targetInfo}`,
      is_system: true
    });
  };

  const sendGif = async (url, width, height) => {
    const playerName = user?.user_metadata?.full_name || user?.user_metadata?.preferred_username;
    
    await supabase.from('messages').insert({
      player_name: playerName,
      content: `GIF|${url}|${width}|${height}`
    });
    
    setShowGifPicker(false);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 1. Validate file type
    if (!file.type.startsWith('image/')) {
      alert("Por favor, selecione uma imagem.");
      return;
    }

    setIsUploading(true);
    try {
      // 2. Check bucket count (limit 50)
      const { data: files, error: listError } = await supabase.storage.from('chat_images').list();
      if (listError) throw listError;

      if (files.length >= 50) {
        // If limit reached, delete the oldest file
        const oldest = files.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))[0];
        await supabase.storage.from('chat_images').remove([oldest.name]);
      }

      // 3. Compression / Resize to stay under 3MB (Simple implementation using Canvas)
      let finalFile = file;
      if (file.size > 3 * 1024 * 1024) {
        finalFile = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
              const canvas = document.createElement('canvas');
              let width = img.width;
              let height = img.height;
              
              // Scale down if too big
              const maxDim = 1200;
              if (width > maxDim || height > maxDim) {
                if (width > height) {
                  height *= maxDim / width;
                  width = maxDim;
                } else {
                  width *= maxDim / height;
                  height = maxDim;
                }
              }
              
              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(img, 0, 0, width, height);
              canvas.toBlob((blob) => {
                resolve(new File([blob], file.name, { type: 'image/jpeg' }));
              }, 'image/jpeg', 0.8);
            };
          };
        });
      }

      // 4. Upload to Supabase
      const fileExt = finalFile.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('chat_images')
        .upload(fileName, finalFile);

      if (uploadError) throw uploadError;

      // 5. Get Public URL
      const { data: { publicUrl } } = supabase.storage
        .from('chat_images')
        .getPublicUrl(fileName);

      // 6. Send as Message
      const playerName = user?.user_metadata?.full_name || user?.user_metadata?.preferred_username;
      
      // Get dimensions for aspect-ratio
      const img = new Image();
      img.src = publicUrl;
      img.onload = async () => {
        await supabase.from('messages').insert({
          player_name: playerName,
          content: `IMAGE|${publicUrl}|${img.width}|${img.height}`
        });
      };

    } catch (err) {
      console.error("Erro no upload:", err);
      alert("Erro ao enviar imagem: " + err.message);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Effect event trigger: reduction of HP on specific events (Advanced Eletrification)
  useEffect(() => {
    const handleCombatEvents = async () => {
      // Automated event logic removed as per user request (Master decides live)
      // The 10% reduction per turn is handled in handleNextTurn.
    };
    handleCombatEvents();
  }, [messages.length]);

  const handleNextTurn = async () => {
    if (!isActingAsMaster) return;
    const nextTurn = (turn || 1) + 1;

    // Process Effects for each player in combat
    const { EFFECTS } = await import('../constants/gameData');
    
    for (const p of combatants) {
      const currentEffects = Array.isArray(p.effects) ? p.effects : [];
      if (currentEffects.length === 0) continue;

      let newHP = p.current_hp ?? ((p.strength || 0) + (p.resistance || 0) * 7);
      let newEffects = [...currentEffects];
      let effectsChanged = false;

      for (let i = 0; i < newEffects.length; i++) {
        const eff = newEffects[i];
        const mods = eff.modifiers;
        
        // 1. HP Reduction per turn
        if (mods?.hpReductionTurn) {
          const baseLife = (p.strength || 0) + (p.resistance || 0) * 7;
          let maxLife = baseLife;
          if (Array.isArray(p.effects)) {
            p.effects.forEach(eff => {
              if (eff.modifiers?.maxLife) maxLife *= eff.modifiers.maxLife;
            });
          }
          maxLife = Math.floor(maxLife);
          const reduction = Math.floor(maxLife * mods.hpReductionTurn);
          newHP = Math.max(0, newHP - reduction);
        }

        // 2. Eletrificação -> Eletrificação Avançada trigger
        if (eff.key === 'eletrification' && mods?.triggerAdvancedEletrification) {
          const baseLife = (p.strength || 0) + (p.resistance || 0) * 7;
          let maxLife = baseLife;
          if (Array.isArray(p.effects)) {
            p.effects.forEach(eff => {
              if (eff.modifiers?.maxLife) maxLife *= eff.modifiers.maxLife;
            });
          }
          maxLife = Math.floor(maxLife);
          if (newHP / maxLife <= mods.triggerAdvancedEletrification) {
            // Transform into Advanced
            const advanced = EFFECTS['advanced-eletrification'];
            newEffects[i] = { ...advanced, key: 'advanced-eletrification', addedAtTurn: turn, duration: 2 };
            effectsChanged = true;
          }
        }

        // 3. Duration handle (for temporary effects like Advanced Eletrification)
        if (eff.duration !== undefined && eff.duration !== null) {
          eff.duration--;
          effectsChanged = true;
          if (eff.duration <= 0) {
            newEffects.splice(i, 1);
            i--;
          }
        }
      }

      // Update player if HP or effects changed
      if (newHP !== p.current_hp || effectsChanged) {
        await supabase.from('characters').update({
          current_hp: newHP,
          effects: newEffects
        }).eq('id', p.id);
      }
    }

    const { error } = await supabase.from('global').update({ current_turn: nextTurn }).eq('id', 1);
    if (error) {
      console.error("Error updating turn:", error);
      alert("Erro ao atualizar turno: " + error.message);
    }
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
      {/* Universal Targeting Overlay - Blocks interactions with EVERYTHING except the combatant cards */}
      {targetingRoll && (
        <div className="fixed inset-0 z-[65] bg-black/20 backdrop-blur-sm animate-in fade-in duration-300 pointer-events-auto" />
      )}
      
      {/* CHAT AREA - Grows to fill space */}
      <div className={`flex-1 flex flex-col min-w-0 bg-zinc-950 relative h-full transition-all duration-500 ${targetingRoll ? 'blur-sm pointer-events-none select-none' : ''}`}>
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
        <div
          ref={chatContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar relative"
        >
          {/* Contrast Backdrop */}
          {isContrastActive && (
            <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-all duration-1000 animate-in fade-in" />
          )}

          {/* Floating Shared Image Component */}
          <div
            className={`sticky top-0 float-right ml-6 z-[60] transition-all duration-700 ease-in-out ${
              isVisible ? 'max-h-[800px] opacity-100 mb-8' : 'max-h-0 opacity-0 mb-0'
            } ${isBigImage ? 'scale-150 origin-top-right translate-x-[-10%] translate-y-[10%]' : 'scale-100'}`}
          >
            <div className={`flex flex-col items-end transition-all duration-1000 ${isBigImage ? 'max-w-[400px]' : 'max-w-[180px]'} group py-1 pr-1`}>
              {/* Brutalist Frame */}
              <div className="relative">
                {/* Decorative Industrial Corners */}
                <div className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-red-600 z-10" />
                <div className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-red-600 z-10" />
                
                <div className="bg-zinc-950 border border-white/5 p-1.5 shadow-[0_0_40px_rgba(0,0,0,0.8)] transition-all duration-500 group-hover:border-red-600/40">
                  <div className={`relative aspect-square transition-all duration-1000 overflow-hidden grayscale-[0.2] group-hover:grayscale-0 ${isBigImage ? 'w-[380px]' : 'w-[160px]'}`}>
                    {displayImage?.url && (
                      <img
                        src={displayImage.url}
                        alt={displayImage.title || "Shared Image"}
                        className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
                      />
                    )}
                    {/* Scanline Effect Overlay */}
                    <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.03),rgba(0,255,0,0.01),rgba(0,0,255,0.03))] bg-[length:100%_4px,3px_100%] opacity-20" />
                  </div>
                </div>
              </div>
              
              {displayImage?.title && (
                <div className="mt-3 flex flex-col items-end">
                  <div className="bg-red-600 text-black px-3 py-0.5 text-[9px] font-black uppercase tracking-[0.2em] mb-1 skew-x-[-12deg]">
                    TRANSMISSÃO_ATIVA
                  </div>
                  <h3 className="text-xl font-black italic text-white uppercase tracking-tighter leading-none text-right pr-1 drop-shadow-2xl">
                    {displayImage.title}
                  </h3>
                </div>
              )}
              
              {/* Background Glitch Glow */}
              <div className="absolute -inset-2 bg-red-600/5 blur-2xl -z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
            </div>
          </div>
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
                      {group.messages.map((m, mi) => {
                        const isDice = m.content.startsWith('DICE_ROLL|');
                        
                        if (isDice) {
                          const parts = m.content.split('|');
                          const [, pName, expr, total, detail, status, category = "normal", pImage = "", diceType = "", targetName = ""] = parts;

                          const categoryStyles = {
                            combat: {
                              bg: "bg-red-500/5",
                              border: "border-red-500/20",
                              accent: "text-red-500",
                              icon: "⚔️"
                            },
                            secondary: {
                              bg: "bg-blue-500/5",
                              border: "border-blue-500/20",
                              accent: "text-blue-400",
                              icon: "🧠"
                            },
                            luck: {
                              bg: "bg-yellow-500/5",
                              border: "border-yellow-500/20",
                              accent: "text-yellow-500",
                              icon: "🍀"
                            },
                            normal: {
                              bg: "bg-zinc-900/80",
                              border: "border-white/5",
                              accent: "text-zinc-500",
                              icon: "🎲"
                            }
                          };

                          const style = categoryStyles[category] || categoryStyles.normal;

                          return (
                            <div key={m.id || `${i}-${mi}`} className={`${style.bg} border ${style.border} rounded-2xl p-6 my-2 shadow-2xl relative overflow-hidden group/dice`}>
                              <div className="flex justify-between items-start gap-6">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-4">
                                    <span className={`${style.accent} text-[10px] font-black uppercase tracking-widest`}>Tentativa de</span>
                                    <span className="text-white text-[11px] font-bold italic">{expr}</span>
                                    <div dangerouslySetInnerHTML={{ __html: status }} />
                                    {diceType && (
                                      <span className="ml-auto bg-white/10 text-white text-[8px] font-black uppercase px-2 py-0.5 rounded border border-white/10 tracking-widest italic">
                                        {diceType}
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-end gap-4">
                                    <div className="text-5xl font-black italic text-white tracking-tighter drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">
                                      {total}
                                    </div>
                                    <div className="pb-1.5">
                                      <div className="flex items-center gap-1.5" dangerouslySetInnerHTML={{ __html: detail }} />
                                    </div>
                                  </div>

                                  <div className="mt-6 flex items-center gap-3">
                                    <div className="h-[1px] w-8 bg-zinc-800" />
                                    <div className="text-[9px] font-black text-zinc-500 uppercase tracking-widest italic">
                                      Por @{pName}
                                    </div>
                                    {targetName && (
                                      <div className="text-[9px] font-black text-red-500 uppercase tracking-widest italic mt-1">
                                        Alvo: {targetName}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {pImage && (
                                  <div className="relative group/diceimg shrink-0">
                                    {/* Geometric Decoration */}
                                    <div className="absolute -top-2 -left-2 w-4 h-4 border-t-2 border-l-2 border-white/10 group-hover/diceimg:border-white/30 transition-colors" />
                                    <div className="absolute -bottom-2 -right-2 w-4 h-4 border-b-2 border-r-2 border-white/10 group-hover/diceimg:border-white/30 transition-colors" />
                                    
                                    <div className="relative w-28 h-28 overflow-hidden rounded-xl border border-white/10 shadow-2xl transition-all duration-500 group-hover/diceimg:border-white/30 group-hover/diceimg:scale-105 group-hover/diceimg:-rotate-2">
                                      <img
                                        src={pImage}
                                        alt=""
                                        className="w-full h-full object-cover transition-transform duration-1000 group-hover/diceimg:scale-110"
                                      />
                                      {/* Scanline Effect overlay on player image */}
                                      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%)] bg-[length:100%_4px] opacity-20" />
                                    </div>

                                    {/* Ambient Glow */}
                                    <div className="absolute -inset-4 bg-white/5 blur-2xl -z-10 opacity-0 group-hover/diceimg:opacity-100 transition-opacity duration-700" />
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        }

                        if (m.content.startsWith('IMAGE|') || m.content.startsWith('GIF|')) {
                          const isImage = m.content.startsWith('IMAGE|');
                          const [, url, width, height] = m.content.split('|');
                          const aspectRatio = width && height ? `${width} / ${height}` : 'auto';
                          
                          return (
                            <div
                              key={m.id || `${i}-${mi}`}
                              className={`my-2 overflow-hidden rounded-xl border border-white/5 shadow-2xl bg-zinc-900/50 ${isImage ? 'max-w-md' : 'max-w-[200px]'}`}
                              style={{
                                aspectRatio: aspectRatio,
                                width: isImage
                                  ? (width ? `min(${width}px, 100%)` : '100%')
                                  : (width ? `min(200px, 100%)` : '200px')
                              }}
                            >
                              <img
                                src={url}
                                alt={isImage ? "Sent image" : "GIF"}
                                className="w-full h-full block object-cover"
                              />
                            </div>
                          );
                        }

                        return (
                          <p
                            key={m.id || `${i}-${mi}`}
                            className={`text-sm leading-relaxed font-medium break-words whitespace-pre-wrap ${
                              group.player_name === 'SISTEMA'
                                ? 'text-cyan-400 italic font-bold'
                                : 'text-zinc-300'
                            }`}
                            dangerouslySetInnerHTML={{
                              __html: m.content
                                .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white bg-white/10 px-1.5 py-0.5 rounded">$1</strong>')
                                .replace(/\n/g, '<br/>')
                            }}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={scrollRef} className="h-px w-full" style={{ overflowAnchor: 'auto' }} />
        </div>

        {/* Input Area */}
        <form onSubmit={sendMsg} className="shrink-0 p-8 bg-black/60 border-t border-white/5 relative">
          {suggestionData && (
            <div className="absolute bottom-full left-8 mb-4 px-6 py-2 bg-zinc-900/90 border border-white/10 rounded-full shadow-2xl backdrop-blur-md">
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                <span className="text-red-500">⚡</span> {suggestionData.fullHelp}
              </p>
            </div>
          )}
          {suggestions.length > 0 && (
            <div className="absolute bottom-full left-8 mb-4 w-[600px] bg-zinc-900/95 border border-white/10 rounded-[20px] shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-50 backdrop-blur-md overflow-hidden flex flex-col">
              {suggestions.map((s, i) => {
                const isSelected = i === activeSuggestionIndex;
                const match = COMMANDS.find(c => c.name === s.value);
                
                return (
                  <div
                    key={i}
                    onClick={() => applySuggestion(s)}
                    className={`px-8 py-4 cursor-pointer text-sm font-mono whitespace-pre flex border-b border-white/5 last:border-0 ${isSelected ? 'bg-red-600/20' : 'opacity-80 hover:opacity-100 hover:bg-white/[0.02]'}`}
                  >
                    {(() => {
                      if (!match) return <span className="text-white">{s.display}</span>;

                      const cmdPartWithSlash = `/${match.name}`;
                      
                      // Identify how many arguments we have typed (respecting quotes)
                      const fullContent = input.substring(1).trim();
                      const remaining = fullContent.substring(match.name.length).trim();
                      const parts = [];
                      const regex = /"([^"]*)"|(\S+)/g;
                      let m;
                      while ((m = regex.exec(remaining)) !== null) {
                        parts.push(m[1] !== undefined ? m[1] : m[2]);
                      }
                      
                      const isTypedCompletely = remaining.length > 0 && input.endsWith(' ');
                      const currentArgIdx = isTypedCompletely ? parts.length : Math.max(0, parts.length - 1);

                      const isArgValid = (val, type) => {
                        if (!val) return true;
                        if (type === 'number') return !isNaN(parseFloat(val));
                        if (type === 'boolean') return val === 'true' || val === 'false';
                        if (type === 'array') return val.split(',').every(x => x.length > 0);
                        return true;
                      };
                      
                      const helpParts = [cmdPartWithSlash, ...match.args.map(a => `[${a.name}]`)];
                      
                      return helpParts.map((part, pIdx) => {
                        const isCommandPart = pIdx === 0;
                        
                        if (isCommandPart) {
                          return (
                            <span key={pIdx} className="flex">
                              {part.split("").map((char, cIdx) => {
                                // Simplified logic: compare input character directly with suggestion character
                                const inputChar = input[cIdx];
                                let charColor = 'text-zinc-600'; // Default gray for future letters
                                
                                if (inputChar !== undefined) {
                                  // We are at a position where the user has typed something
                                  if (inputChar.toLowerCase() === char.toLowerCase()) {
                                    charColor = 'text-white'; // Match
                                  } else {
                                    charColor = 'text-red-600'; // Mismatch
                                  }
                                }
                                return <span key={cIdx} className={charColor}>{char}</span>;
                              })}
                              <span className="text-zinc-600">&nbsp;</span>
                            </span>
                          );
                        } else {
                          const argIndex = pIdx - 1;
                          const argDef = match.args[argIndex];
                          const wordInInput = parts[argIndex];
                          const isCurrent = argIndex === currentArgIdx;
                          
                          let color = 'text-zinc-600';
                          if (wordInInput !== undefined) {
                            color = isArgValid(wordInInput, argDef.type) ? 'text-white' : 'text-red-600';
                          }

                          return (
                            <span key={pIdx} className={`${color} ${isCurrent ? 'font-black' : ''}`}>
                              {part}
                              <span className="text-zinc-600">&nbsp;</span>
                            </span>
                          );
                        }
                      });
                    })()}
                  </div>
                );
              })}
            </div>
          )}
          <div className="relative flex gap-4 items-center">
            <div className="relative flex-1">
              {showGifPicker && (
                <GifPicker
                  onSelect={(url, w, h) => sendGif(url, w, h)}
                  onClose={() => setShowGifPicker(false)}
                />
              )}
              
              <input
                value={input}
                onChange={handleInputChange}
                onKeyDown={onKeyDown}
                placeholder="Interaja com o mundo..."
                disabled={!!targetingRoll}
                className="w-full bg-zinc-900 border border-white/10 rounded-2xl pl-8 pr-24 py-5 text-white text-sm outline-none focus:border-red-600 transition-all shadow-2xl disabled:opacity-50"
              />

              <div className="absolute right-3 top-1/2 -translate-y-[60%] flex items-center gap-1">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                  accept="image/*"
                  className="hidden"
                />
                <button
                  type="button"
                  disabled={isUploading}
                  onClick={() => fileInputRef.current?.click()}
                  className={`p-2 transition-all ${isUploading ? 'animate-pulse text-yellow-500' : 'text-zinc-500 hover:text-white'}`}
                  title="Anexar Imagem"
                >
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                  </svg>
                </button>

                <button
                  type="button"
                  onClick={() => setShowGifPicker(!showGifPicker)}
                  className={`p-2 transition-all ${showGifPicker ? 'text-red-500 scale-110' : 'text-zinc-500 hover:text-white'}`}
                  title="Inserir GIF"
                >
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21 15 16 10 5 21"/>
                  </svg>
                </button>

                <button
                  type="submit"
                  disabled={!input.trim()}
                  className="p-2 text-zinc-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Enviar mensagem"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-6 h-6"
                  >
                    <line x1="22" y1="2" x2="11" y2="13"></line>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                  </svg>
                </button>
              </div>
            </div>
          </div>

        </form>
      </div>

      {/* PARTICIPANTS SIDEBAR - Fixed Width */}
      <div className="w-[400px] shrink-0 bg-zinc-950 flex flex-col border-l border-white/5 relative">
        
        {/* Targeting Overlay for Sidebar */}
        {targetingRoll && (
          <div className="absolute inset-0 z-[80] flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-300 pointer-events-none">
            {/* The actual clickable backdrop for this section */}
            <div className="absolute inset-0 bg-black/40 pointer-events-none" />
            
            <div className="relative z-[100] flex flex-col items-center">
              <div className="bg-red-600 text-black px-4 py-1 text-[10px] font-black uppercase tracking-[0.2em] mb-4 skew-x-[-12deg]">
                SELECIONE UM ALVO
              </div>
              <p className="text-white font-bold italic text-sm mb-8">
                Selecione um alvo para esta ação
              </p>
              <button
                type="button"
                onClick={(e) => {
                  console.log("Cancelar button clicked!");
                  e.preventDefault();
                  e.stopPropagation();
                  setTargetingRoll(null);
                }}
                className="px-6 py-2 border border-white/20 text-white text-[9px] font-black uppercase tracking-widest hover:bg-white/10 transition-all rounded-full cursor-pointer pointer-events-auto"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* SCROLLABLE LIST OF COMBATANTS */}
        <div className={`flex-1 overflow-y-auto p-8 custom-scrollbar transition-all duration-500 ${targetingRoll ? 'relative z-[75]' : ''}`}>
          <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.4em] italic text-center mb-6">Combatentes</h3>
        
        {combatants.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 opacity-20 grayscale">
            <span className="text-4xl mb-4">⚔️</span>
            <p className="text-[10px] font-black uppercase tracking-widest text-center">Nenhum combatente ativo</p>
          </div>
        ) : combatants.map(p => {
          const presence = (p.strength || 0) + (p.resistance || 0) + (p.aptitude || 0) + (p.agility || 0) + (p.precision || 0);
          const baseLife = (p.strength || 0) + (p.resistance || 0) * 7;
          let maxLife = baseLife;
          if (Array.isArray(p.effects)) {
            p.effects.forEach(eff => {
              if (eff.modifiers?.maxLife) maxLife *= eff.modifiers.maxLife;
            });
          }
          maxLife = Math.floor(maxLife);
          const currentLife = p.current_hp ?? maxLife;
          const hpPerc = Math.max(0, (currentLife / maxLife) * 100);

          return (
            <div
              key={p.id}
              onClick={() => {
                if (targetingRoll) {
                  const currentUserChar = allPlayers?.find(ap => ap.discord_username === user?.user_metadata?.preferred_username || ap.discord_username === user?.user_metadata?.full_name);
                  const isSelf = currentUserChar?.id === p.id;
                  
                  // Restriction: Players cannot select themselves. Only master can select self (in master mode).
                  if (isSelf && !isActingAsMaster) return;

                  finishDiceRoll(targetingRoll.diceResult, targetingRoll.input, targetingRoll.playerName, targetingRoll.playerImage, p);
                  setTargetingRoll(null);
                }
              }}
              className={`relative group bg-zinc-900 border border-white/5 rounded-2xl p-6 shadow-2xl transition-all duration-500 shrink-0 overflow-hidden ${
                targetingRoll
                  ? 'cursor-crosshair ring-1 ring-red-600/50 animate-pulse hover:bg-zinc-800'
                  : 'hover:border-red-600/40'
              }`}
            >
              {/* Background Accent */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-red-600/5 blur-[60px] -z-10 group-hover:bg-red-600/10 transition-colors" />
              
              <div className="flex flex-col gap-5">
                {/* Header: Avatar, Name, HP Text */}
                <div className="flex items-start gap-4">
                  <div className="relative shrink-0">
                    <div className="absolute -inset-1 bg-gradient-to-tr from-red-600/20 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                    {p.image_url ? (
                      <img src={p.image_url} className="w-16 h-16 rounded-xl object-cover border border-white/10 shadow-xl relative z-10" alt="" />
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-black/40 border border-white/10 flex items-center justify-center text-2xl relative z-10">
                        👤
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0 pt-1">
                    <h4 className="font-black italic text-white uppercase text-base tracking-tighter truncate leading-tight mb-1">{p.char_name}</h4>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Vitalidade:</span>
                      {isActingAsMaster && editingHP === p.id ? (
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <input
                            autoFocus
                            type="text"
                            value={hpInput}
                            onChange={(e) => setHpInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleHPSubmit(p, e.shiftKey);
                              }
                              if (e.key === 'Escape') {
                                e.preventDefault();
                                setEditingHP(null);
                              }
                            }}
                            className="bg-zinc-800 border border-red-500/50 rounded px-2 py-0.5 text-white font-mono text-xs w-20 outline-none focus:border-red-500"
                          />
                          <span className="font-mono text-xs font-black text-red-500/40">/{maxLife}</span>
                        </div>
                      ) : (
                        <div
                          onClick={(e) => {
                            if (isActingAsMaster) {
                              e.stopPropagation();
                              setEditingHP(p.id);
                              setHpInput(currentLife.toString());
                            }
                          }}
                          className={`flex items-baseline gap-0.5 ${isActingAsMaster ? 'cursor-pointer hover:bg-white/5 px-1.5 py-0.5 rounded transition-colors' : ''}`}
                        >
                          <span className="font-mono text-xl font-black text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.3)]">{currentLife}</span>
                          <span className="font-mono text-sm font-black text-red-900/60">/{maxLife}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Status Effects - More organized row */}
                <div className="flex flex-wrap gap-1.5">
                  {Array.isArray(p.effects) && p.effects.length > 0 ? (
                    p.effects.map((eff, idx) => (
                      <div
                        key={idx}
                        className={`flex items-center gap-1.5 bg-zinc-950 border border-red-900/30 pl-1 pr-2.5 py-1 rounded-md transition-colors relative ${targetingRoll ? 'pointer-events-none' : 'hover:border-red-600/50 cursor-help group/eff'}`}
                        title={targetingRoll ? "" : eff.description}
                      >
                        <div className="min-w-[1.25rem] h-5 px-1 flex items-center justify-center bg-red-600/10 rounded text-[10px]">
                          {eff.emoji}
                        </div>
                        <span className="text-[8px] font-black uppercase tracking-wider text-red-500/80 group-hover/eff:text-red-400">{eff.name}</span>
                        <span className="text-[10px] font-black font-mono text-zinc-500 ml-1 border-l border-white/10 pl-1.5">{eff.duration ?? '-'}</span>
                        
                        {isActingAsMaster && (
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              const newEffects = p.effects.filter((_, i) => i !== idx);
                              
                              // Calculate new Max Life without the removed effect
                              const baseLife = (p.strength || 0) + (p.resistance || 0) * 7;
                              let newMaxLife = baseLife;
                              newEffects.forEach(eff => {
                                if (eff.modifiers?.maxLife) newMaxLife *= eff.modifiers.maxLife;
                              });
                              newMaxLife = Math.floor(newMaxLife);

                              const updateData = { effects: newEffects };
                              
                              // Although removing an effect usually increases Max HP, we still clamp for safety
                              if ((p.current_hp || baseLife) > newMaxLife) {
                                updateData.current_hp = newMaxLife;
                              }

                              await supabase.from('characters').update(updateData).eq('id', p.id);
                            }}
                            className="absolute -top-1 -right-1 bg-red-900/80 text-white/70 rounded p-0.5 opacity-0 group-hover/eff:opacity-100 transition-opacity hover:text-white z-20 flex items-center justify-center"
                            title="Remover Efeito"
                          >
                            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M18 6L6 18M6 6l12 12"/>
                            </svg>
                          </button>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="w-full flex items-center gap-2 opacity-20">
                      <div className="h-[1px] flex-1 bg-zinc-800" />
                      <span className="text-[7px] text-zinc-500 uppercase font-black tracking-[0.2em]">Sem Anomalias</span>
                      <div className="h-[1px] flex-1 bg-zinc-800" />
                    </div>
                  )}
                </div>

                {/* Main Health Bar - Centered and stylized */}
                <div className="relative h-4 bg-zinc-950 rounded-full border border-white/5 overflow-hidden group/hp shadow-inner">
                  {/* Background Track Highlights */}
                  <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.02)_50%,transparent_100%)] animate-pulse" />
                  
                  {/* Progress Bar */}
                  <div
                    className={`h-full relative transition-all duration-1000 ease-out shadow-[0_0_20px_rgba(239,68,68,0.2)] ${
                      hpPerc < 25 ? 'bg-gradient-to-r from-red-800 to-red-600 animate-pulse' : 'bg-gradient-to-r from-red-700 to-red-500'
                    }`}
                    style={{ width: `${hpPerc}%` }}
                  >
                    {/* Glass Effect */}
                    <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.1)_0%,transparent_50%,rgba(0,0,0,0.2)_100%)]" />
                    {/* Glowing Tip */}
                    <div className="absolute top-0 right-0 bottom-0 w-1 bg-white/40 blur-[2px]" />
                  </div>

                  {/* Segment Markers */}
                  <div className="absolute inset-0 flex justify-between px-1 pointer-events-none">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="w-[1px] h-full bg-black/40" />
                    ))}
                  </div>
                </div>

                {/* Equipment Row */}
                <div className="flex flex-wrap gap-1.5">
                  {p.inventory?.filter(i => i.equipped).length > 0 ? (
                    p.inventory?.filter(i => i.equipped).map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-blue-600/5 border border-blue-500/20 px-2.5 py-1 rounded-md">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500/40 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                        <span className="text-[8px] text-blue-400 font-black uppercase tracking-tight">
                          {item.name}
                        </span>
                      </div>
                    ))
                  ) : (
                    <span className="text-[7px] text-zinc-700 uppercase font-bold italic">Desarmado</span>
                  )}
                </div>
              </div>

              {/* EXPANDABLE SECTION */}
              <div className={`grid grid-rows-[0fr] ${targetingRoll ? '' : 'group-hover:grid-rows-[1fr]'} transition-all duration-500 ease-in-out`}>
                <div className="overflow-hidden">
                  <div className="pt-6 mt-6 border-t border-white/5 space-y-4">
                    <div className="space-y-4">
                      {(() => {
                        const equippedWeapon = p.inventory?.find(i => i.equipped && (i.category === "Arma de Fogo" || i.category === "Arma Branca"));
                        const weaponPAT = equippedWeapon ? calculateWeaponPAT(equippedWeapon, p) : 0;
                        const disarmedPAT = calculateDisarmedPAT(p);

                        // Derived stats for secondary ones
                        const presenceVal = (Number(p.strength) || 0) + (Number(p.resistance) || 0) + (Number(p.aptitude) || 0) + (Number(p.agility) || 0) + (Number(p.precision) || 0);
                        const calcPerc = (val) => presenceVal > 0 ? Math.min((val / presenceVal) * 100, 100).toFixed(1) : "0.0";
                        
                        const charPerc = calcPerc(p.charisma);
                        const intPerc = calcPerc(p.intelligence);
                        const luckPerc = calcPerc(p.luck);

                        const calcSecondary = (perc) => {
                          const val = parseFloat(perc) || 0;
                          return Math.round(20 * Math.pow(val / 20, 0.6215));
                        };

                        const convincimento = calcSecondary(charPerc);
                        const raciocinio = calcSecondary(intPerc);
                        const prosperidade = calcSecondary(luckPerc);
                        const lootDie = Math.round(15 + (5 * Math.pow(parseFloat(luckPerc) / 15, 0.8)));
                        
                        return (
                          <div className="flex flex-col gap-4">
                            {/* COMBAT CATEGORY */}
                            <div className="grid grid-cols-2 gap-2">
                              <DiceBadge label="Ataque (Arma)" val={`1d${Math.round(weaponPAT)}`} category="combat" />
                              <DiceBadge label="Ataque (Punho)" val={`1d${Math.round(disarmedPAT)}`} category="combat" />
                            </div>

                            {/* TECHNICAL CATEGORY */}
                            <div className="grid grid-cols-2 gap-2">
                              <DiceBadge label="Persuasão" val={`1d${convincimento}`} category="secondary" />
                              <DiceBadge label="Lógica" val={`1d${raciocinio}`} category="secondary" />
                            </div>

                            {/* LUCK CATEGORY */}
                            <div className="grid grid-cols-2 gap-2">
                              <DiceBadge label="Sorte" val={`1d${prosperidade}`} category="luck" />
                              <DiceBadge label="Espólio" val={`1d${lootDie}`} category="luck" />
                            </div>
                          </div>
                        );
                      })()}
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

        {/* FIXED TURN INDICATOR AT BOTTOM */}
        {isCombatActive && (
          <div className={`shrink-0 p-4 bg-zinc-900 border-t border-white/10 z-50 flex items-center ${isActingAsMaster ? 'justify-between' : 'justify-center'} gap-4 ${targetingRoll ? 'blur-sm pointer-events-none' : ''}`}>
            <div className={`flex flex-col ${!isActingAsMaster ? 'items-center' : ''}`}>
              <span className="text-[7px] font-black text-red-500/60 uppercase tracking-[0.3em] mb-1">Turno Atual</span>
              <div key={turn} style={{ animation: 'turnChange 0.5s ease-out' }} className="flex items-center justify-center">
                <span className="text-3xl font-black italic text-white drop-shadow-[0_0_15px_rgba(220,38,38,0.5)] leading-none">
                  {turn || 1}
                </span>
                <style>{`
                  @keyframes turnChange {
                    0% { transform: scale(1.5); opacity: 0; filter: brightness(2); }
                    100% { transform: scale(1); opacity: 1; filter: brightness(1); }
                  }
                `}</style>
              </div>
            </div>

            {isActingAsMaster && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  handleNextTurn();
                }}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white font-black text-[9px] uppercase rounded-lg transition-all hover:scale-[1.02] active:scale-[0.95] shadow-xl shadow-red-900/40 border border-red-400/20 flex items-center justify-center gap-2 group/btn"
              >
                <span>Próximo Turno</span>
                <span className="text-sm group-hover/btn:animate-bounce">⚔️</span>
              </button>
            )}
            
            {/* Visual glow */}
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/2 h-1 bg-red-600 blur-lg opacity-20" />
          </div>
        )}
      </div>
    </div>
  );
}

function DiceBadge({ label, val, category }) {
  const styles = {
    combat: {
      bg: 'bg-red-500/5',
      border: 'border-red-500/10',
      text: 'text-red-500',
      glow: 'shadow-[0_0_10px_rgba(239,68,68,0.1)]'
    },
    luck: {
      bg: 'bg-yellow-500/5',
      border: 'border-yellow-500/10',
      text: 'text-yellow-500',
      glow: 'shadow-[0_0_10px_rgba(234,179,8,0.1)]'
    },
    secondary: {
      bg: 'bg-blue-500/5',
      border: 'border-blue-500/10',
      text: 'text-blue-400',
      glow: 'shadow-[0_0_10px_rgba(96,165,250,0.1)]'
    }
  };
  const style = styles[category] || styles.combat;

  return (
    <div className={`flex flex-col items-center justify-center p-2 rounded-xl border ${style.border} ${style.bg} ${style.glow}`}>
      <span className="text-[7px] font-black text-zinc-500 uppercase tracking-widest mb-1">{label}</span>
      <span className={`text-sm font-black font-mono ${style.text}`}>{val}</span>
    </div>
  );
}
