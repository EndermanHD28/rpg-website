"use client";
import { useState, useRef, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { handleCommand, COMMANDS } from '../../lib/commands';
import { 
  rollDice, 
  calculateWeaponPAT, 
  calculateDisarmedPAT, 
  rollLoot,
  calculateAcerto,
  calculateDesvio,
  calculateBloqueio,
  calculateDerivedStats 
} from '../../lib/rpg-math';
import { RARITY_CONFIG } from '../../constants/gameData';
import GifPicker from '../GifPicker';

export default function CombatLog({ 
  user, 
  allPlayers, 
  allNPCs, 
  messages, 
  isSessionActive, 
  isCombatActive, 
  isMaster, 
  isActingAsMaster,
  targetingRoll,
  setTargetingRoll,
  selectedCombatantId,
  setSelectedCombatantId,
  combatants,
  finishDiceRoll,
  sharedImage,
  lootTables = []
}) {
  const [input, setInput] = useState("");
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [showDiceQuickMenu, setShowDiceQuickMenu] = useState(false);
  const [quickDiceInputs, setQuickDiceInputs] = useState({
    acerto: "",
    desvio: "",
    bloqueio: "",
    dano: ""
  });
  const [showLootSelector, setShowLootSelector] = useState(false);
  const [lootSearch, setLootSearch] = useState("");
  const [lootDicePlaceholder, setLootDicePlaceholder] = useState("1d20");
  const [suggestions, setSuggestions] = useState([]);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  const [suggestionData, setSuggestionData] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  
  const [displayImage, setDisplayImage] = useState(sharedImage);
  const [isVisible, setIsVisible] = useState(!!sharedImage?.url);
  const [isContrastActive, setIsContrastActive] = useState(false);
  const [isBigImage, setIsBigImage] = useState(false);

  const [editingHP, setEditingHP] = useState(null);
  const [editingPosture, setEditingPosture] = useState(null);
  const [hpInput, setHpInput] = useState("");
  const [postureInput, setPostureInput] = useState("");

  const handleHPSubmit = async (player, isShiftPressed = false) => {
    try {
      const { life: maxLife } = calculateDerivedStats(player);
      let equation = hpInput.toLowerCase().replace(/random/g, () => Math.random().toString());
      let newHP;
      try {
        if (/[^0-9+\-*/().\s|e]/.test(equation)) throw new Error("Invalid characters");
        newHP = Math.round(new Function(`return ${equation}`)());
      } catch (e) {
        alert("Equação inválida!");
        return;
      }
      if (isNaN(newHP)) return;
      if (!isShiftPressed && newHP > maxLife) newHP = maxLife;
      const table = player.is_npc ? 'npcs' : 'characters';
      const dbId = player.is_npc ? player.dbId : player.id;
      await supabase.from(table).update({ current_hp: newHP }).eq('id', dbId);
      setEditingHP(null);
    } catch (err) {
      alert("Erro ao atualizar HP: " + err.message);
    }
  };

  const handlePostureSubmit = async (player, isShiftPressed = false) => {
    try {
      const { posture: maxPosture } = calculateDerivedStats(player);
      let equation = postureInput.toLowerCase().replace(/random/g, () => Math.random().toString());
      let newPosture;
      try {
        if (/[^0-9+\-*/().\s|e]/.test(equation)) throw new Error("Invalid characters");
        newPosture = Math.round(new Function(`return ${equation}`)());
      } catch (e) {
        alert("Equação inválida!");
        return;
      }
      if (isNaN(newPosture)) return;
      if (!isShiftPressed && newPosture > maxPosture) newPosture = maxPosture;
      const table = player.is_npc ? 'npcs' : 'characters';
      const dbId = player.is_npc ? player.dbId : player.id;
      await supabase.from(table).update({ current_posture: newPosture }).eq('id', dbId);
      setEditingPosture(null);
    } catch (err) {
      alert("Erro ao atualizar Postura: " + err.message);
    }
  };

  const scrollRef = useRef();
  const chatContainerRef = useRef(null);
  const isAtBottomRef = useRef(true);
  const fileInputRef = useRef(null);

  const handleScroll = () => {
    if (!chatContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
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
      const isNewImage = sharedImage.url !== displayImage?.url || (sharedImage.contrast && !displayImage?.contrast);
      setDisplayImage(sharedImage);
      setIsVisible(true);

      if (sharedImage.contrast && isNewImage) {
        setIsContrastActive(true);
        setIsBigImage(true);
        const timer = setTimeout(() => {
          setIsBigImage(false);
          setTimeout(() => setIsContrastActive(false), 1000);
        }, 5000);
        return () => clearTimeout(timer);
      }
    } else {
      setIsVisible(false);
      setIsContrastActive(false);
      setIsBigImage(false);
      const timer = setTimeout(() => {
        setDisplayImage(sharedImage);
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [sharedImage?.url, sharedImage?.contrast]);

  const handlePickUp = async (msgId, itemIdx) => {
    const msg = messages.find(m => m.id === msgId);
    if (!msg) return;

    const parts = msg.content.split('|');
    const items = JSON.parse(parts[6]);
    const itemToPick = items[itemIdx];

    if (!itemToPick || itemToPick.qty <= 0) return;

    // 1. Get current player character
    const playerChar = allPlayers?.find(p => p.id === user?.id);
    if (!playerChar) {
      alert("Personagem não encontrado.");
      return;
    }

    // 2. Add to inventory
    const newInventory = [...(playerChar.inventory || [])];
    const itemToAdd = {
      ...itemToPick,
      id: Date.now() + Math.random(),
      equipped: false
    };
    newInventory.push(itemToAdd);

    // 3. Update character in Supabase
    const { error: charError } = await supabase.from('characters').update({ inventory: newInventory }).eq('id', playerChar.id);
    if (charError) {
      alert("Erro ao atualizar inventário: " + charError.message);
      return;
    }

    // 4. Remove from message or decrement quantity
    let newItems = [...items];
    newItems[itemIdx] = { ...itemToPick, qty: Math.max(0, itemToPick.qty - 1) };

    // 5. Update message in Supabase
    parts[6] = JSON.stringify(newItems);
    const newContent = parts.join('|');
    
    // If no items left, we could delete the message or keep it empty
    await supabase.from('messages').update({ content: newContent }).eq('id', msg.id);
    
    // 6. Record in loot history (optional but good)
    await supabase.from('loot_history').insert({
      player_name: playerChar.char_name,
      item_name: itemToPick.name,
      rarity: itemToPick.rarity || 'Comum'
    });
  };

  const handleLootRoll = async (msgId) => {
    const msg = messages.find(m => m.id === msgId);
    if (!msg) return;

    const parts = msg.content.split('|');
    const diceExpr = parts[5];
    
    // Perform the roll
    const result = rollDice(diceExpr);
    if (!result) return;

    const rollerName = user?.user_metadata?.full_name || user?.user_metadata?.preferred_username;
    
    // Update the message content
    // Parts: 0:LOOT_INTERACTION, 1:location, 2:tier, 3:masterName, 4:masterAvatar, 5:diceExpr, 6:itemsJson, 7:rollResult, 8:rollerName
    parts[7] = result.total.toString();
    parts[8] = rollerName;
    
    const newContent = parts.join('|');
    await supabase.from('messages').update({ content: newContent }).eq('id', msg.id);
  };

  const sendLoot = async (lootTable) => {
    const rolledItems = rollLoot(lootTable);
    if (rolledItems.length === 0) {
      alert("Nenhum item gerado nesta rolagem.");
      return;
    }

    // Format items for the interaction string
    // items in rollLoot are { item_id, amount }. We need full item data.
    // We can fetch full data from supabase.from('items') or use itemLibrary if we have it.
    // Actually, I should probably use the items defined in lootTable.items which should have names.
    // Wait, rollLoot returns grouped results with item_id.
    
    const itemIds = [...new Set(rolledItems.map(ri => ri.item_id))];
    const { data: allItems, error: itemsError } = await supabase.from('items').select('*').in('item_id', itemIds);
    
    if (itemsError) {
      alert("Erro ao buscar dados dos itens: " + itemsError.message);
      return;
    }
    
    const itemsWithData = rolledItems.map(ri => {
      const itemData = allItems?.find(i => i.item_id === ri.item_id);
      return {
        id: ri.item_id,
        name: itemData?.name || ri.item_id,
        qty: ri.amount,
        rarity: itemData?.rarity || 'Comum',
        type: itemData?.type || 'Item',
        value: itemData?.value || 0,
        description: itemData?.description || "",
        category: itemData?.category || "",
        subtype: itemData?.subtype || "",
        hands: itemData?.hands || "",
        tier: itemData?.tier || 0,
        upgrade: itemData?.upgrade || 0,
        isBackpack: !!itemData?.isBackpack
      };
    });

    const masterChar = allPlayers.find(p => p.rank === 'Mestre');
    const avatar = masterChar?.image_url || "";
    const username = masterChar?.discord_username || ".enderu";
    
    const content = `LOOT_INTERACTION|${lootTable.name}|${lootTable.max_rolls}|${username}|${avatar}|${lootDicePlaceholder}|${JSON.stringify(itemsWithData)}|0|none`;
    
    await supabase.from('messages').insert({
      player_name: "SISTEMA",
      content,
      is_system: true
    });
    
    setShowLootSelector(false);
  };

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

  const filteredMessages = messages.filter(m => !m.is_system || isMaster || m.content.startsWith('DICE_ROLL|') || m.content.startsWith('LOOT_INTERACTION|'));
  const groupedMessages = groupMessages(filteredMessages);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setInput(value);

    if (!isActingAsMaster || !value.startsWith('/')) {
      setSuggestionData(null);
      setSuggestions([]);
      return;
    }

    const inputContent = value.substring(1).toLowerCase();
    const lastWord = value.split(" ").slice(-1)[0] || "";
    const atIndex = lastWord.lastIndexOf("@");
    
    if (atIndex !== -1) {
      const query = lastWord.substring(atIndex + 1).toLowerCase();
      const filteredPlayers = allPlayers
        .filter(p => p.rank !== 'Mestre' && (
          p.discord_username?.toLowerCase().includes(query) ||
          p.char_name?.toLowerCase().includes(query)
        ))
        .map(p => ({ display: p.char_name, value: `.${p.discord_username}` }));

      const filteredNPCs = allNPCs
        .filter(n =>
          n.npc_id?.toLowerCase().includes(query) ||
          n.name?.toLowerCase().includes(query)
        )
        .map(n => ({ display: n.name, value: `.${n.npc_id}` }));

      setSuggestions([...filteredPlayers, ...filteredNPCs]);
      setSuggestionData(null);
      return;
    }

    const matches = COMMANDS.filter(c =>
      inputContent.startsWith(c.name) || c.name.startsWith(inputContent)
    );
    
    if (matches.length > 0 && inputContent.length > 0) {
      const bestMatch = matches.find(c => inputContent.startsWith(c.name)) || matches[0];
      setSuggestionData({
        match: bestMatch,
        fullHelp: `/${bestMatch.name} ` + bestMatch.args.map(a => a.optional ? `(${a.name})` : `[${a.name}]`).join(" ")
      });

      const isExactMatch = matches.some(c => inputContent.trim() === c.name);
      const hasSpaceAfterMatch = value.trim().length < value.length;

      if (isExactMatch && hasSpaceAfterMatch) {
        setSuggestions([]);
      } else {
        setSuggestions(matches.map(c => ({ display: `/${c.name}`, value: c.name })));
      }
    } else {
      setSuggestionData(null);
      setSuggestions([]);
    }
  };

  const applySuggestion = (suggestion) => {
    if (!suggestion) return;
    const words = input.trimEnd().split(/\s+/);
    const lastWord = words.pop() || "";
    let newValue = "";
    const atIndex = lastWord.lastIndexOf("@");
    
    if (atIndex !== -1) {
      const prefix = lastWord.substring(0, atIndex + 1);
      newValue = [...words, prefix + (suggestion.value || "")].join(" ") + " ";
    } else if (lastWord.startsWith("/") || (suggestion?.display && suggestion.display.startsWith("/"))) {
      const val = suggestion.value || "";
      newValue = [...words, val.startsWith("/") ? val : "/" + val].join(" ") + " ";
    } else {
      newValue = [...words, suggestion.value || ""].join(" ") + " ";
    }

    setInput(newValue);
    setSuggestions([]);
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
        const currentInput = input.trim().toLowerCase();
        const fullMatch = COMMANDS.some(c => {
          const cmdPrefix = "/" + c.name;
          return currentInput === cmdPrefix || currentInput.startsWith(cmdPrefix + " ");
        });
        if (!fullMatch) {
          e.preventDefault();
          applySuggestion(suggestions[activeSuggestionIndex]);
        }
      } else if (e.key === 'Escape') {
        setSuggestions([]);
      }
    }
  };

  const sendMsg = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    if (input.startsWith('/') && isActingAsMaster) {
      const res = await handleCommand(input, user, allPlayers, allNPCs);
      await supabase.from('messages').insert({
        player_name: "SISTEMA",
        content: `${res.success ? '✅' : '❌'} ${res.message}`,
        is_system: true
      });
    } else {
      let playerChar = allPlayers?.find(p => p.id === user?.id);
      let playerName = playerChar?.char_name || user?.user_metadata?.full_name || user?.user_metadata?.preferred_username;
      
      if (isActingAsMaster && selectedCombatantId) {
        const selected = combatants.find(p => p.id === selectedCombatantId);
        if (selected) {
          playerChar = selected;
          playerName = selected.char_name;
        }
      }

      const playerImage = playerChar?.image_url || "";
      const diceResult = rollDice(input, playerChar);
      
      if (diceResult) {
        const isTargetingType = ['ataque', 'acerto', 'desvio', 'dano', 'bloqueio'].includes(diceResult.type);
        if (isTargetingType) {
          setTargetingRoll({ input, diceResult, playerName, playerImage });
          setInput("");
          setSuggestions([]);
          setSuggestionData(null);
          return;
        }
        await finishDiceRoll(diceResult, input, playerName, playerImage);
      } else {
        await supabase.from('messages').insert({ player_name: playerName, content: input });
      }
    }
    setInput("");
    setSuggestions([]);
    setSuggestionData(null);
  };

  const handleQuickRoll = async (type, inputVal) => {
    if (!inputVal.trim()) return;
    const fullInput = `/${type} ${inputVal}`;
    
    let playerChar = allPlayers?.find(p => p.id === user?.id);
    let playerName = playerChar?.char_name || user?.user_metadata?.full_name || user?.user_metadata?.preferred_username;
    
    if (isActingAsMaster && selectedCombatantId) {
      const selected = combatants.find(p => p.id === selectedCombatantId);
      if (selected) {
        playerChar = selected;
        playerName = selected.char_name;
      }
    }

    const playerImage = playerChar?.image_url || "";
    const diceResult = rollDice(fullInput, playerChar);
    
    if (diceResult) {
      const isTargetingType = ['ataque', 'acerto', 'desvio', 'dano', 'bloqueio'].includes(diceResult.type);
      if (isTargetingType) {
        setTargetingRoll({ input: fullInput, diceResult, playerName, playerImage });
      } else {
        await finishDiceRoll(diceResult, fullInput, playerName, playerImage);
      }
    }
    setShowDiceQuickMenu(false);
  };

  const sendGif = async (url, width, height) => {
    const playerChar = allPlayers?.find(p => p.id === user?.id);
    const playerName = playerChar?.char_name || user?.user_metadata?.full_name || user?.user_metadata?.preferred_username;
    await supabase.from('messages').insert({
      player_name: playerName,
      content: `GIF|${url}|${width}|${height}`
    });
    setShowGifPicker(false);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;

    setIsUploading(true);
    try {
      const { data: files } = await supabase.storage.from('chat_images').list();
      if (files?.length >= 50) {
        const oldest = files.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))[0];
        await supabase.storage.from('chat_images').remove([oldest.name]);
      }

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
              let { width, height } = img;
              const maxDim = 1200;
              if (width > maxDim || height > maxDim) {
                if (width > height) { height *= maxDim / width; width = maxDim; }
                else { width *= maxDim / height; height = maxDim; }
              }
              canvas.width = width; canvas.height = height;
              canvas.getContext('2d').drawImage(img, 0, 0, width, height);
              canvas.toBlob(blob => resolve(new File([blob], file.name, { type: 'image/jpeg' })), 'image/jpeg', 0.8);
            };
          };
        });
      }

      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${finalFile.name.split('.').pop()}`;
      await supabase.storage.from('chat_images').upload(fileName, finalFile);
      const publicUrl = supabase.storage.from('chat_images').getPublicUrl(fileName).data.publicUrl;

      const playerChar = allPlayers?.find(p => p.id === user?.id);
      const playerName = playerChar?.char_name || user?.user_metadata?.full_name || user?.user_metadata?.preferred_username;
      const img = new Image();
      img.src = publicUrl;
      img.onload = () => supabase.from('messages').insert({
        player_name: playerName,
        content: `IMAGE|${publicUrl}|${img.width}|${img.height}`
      });
    } catch (err) {
      alert("Erro ao enviar imagem: " + err.message);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-zinc-950 relative h-full transition-all duration-500">
      {isContrastActive && <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm animate-in fade-in transition-all duration-1000" />}

      <div className={`absolute top-8 right-8 z-[90] transition-all duration-700 ease-in-out ${isVisible ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0 pointer-events-none'} ${isBigImage ? 'scale-150 origin-top-right translate-x-[-10%] translate-y-[10%]' : 'scale-100'}`}>
        <div className={`flex flex-col items-end transition-all duration-1000 ${isBigImage ? 'max-w-[400px]' : 'max-w-[180px]'} group py-1 pr-1`}>
          <div className="relative">
            <div className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-red-600 z-10" />
            <div className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-red-600 z-10" />
            <div className="bg-zinc-950 border border-white/5 p-1.5 shadow-[0_0_40px_rgba(0,0,0,0.8)] transition-all duration-500 group-hover:border-red-600/40">
              <div className={`relative aspect-square transition-all duration-1000 overflow-hidden grayscale-[0.2] group-hover:grayscale-0 ${isBigImage ? 'w-[380px]' : 'w-[160px]'}`}>
                {displayImage?.url && <img src={displayImage.url} alt={displayImage.title || "Shared"} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105" />}
                <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.03),rgba(0,255,0,0.01),rgba(0,0,255,0.03))] bg-[length:100%_4px,3px_100%] opacity-20" />
              </div>
            </div>
          </div>
          {displayImage?.title && (
            <div className="mt-3 flex flex-col items-end">
              <div className="bg-red-600 text-black px-3 py-0.5 text-[9px] font-black uppercase tracking-[0.2em] mb-1 skew-x-[-12deg]">TRANSMISSÃO_ATIVA</div>
              <h3 className="text-xl font-black italic text-white uppercase tracking-tighter leading-none text-right pr-1 drop-shadow-2xl">{displayImage.title}</h3>
            </div>
          )}
          <div className="absolute -inset-2 bg-red-600/5 blur-2xl -z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
        </div>
      </div>

      {!isSessionActive && isMaster && (
        <div className="absolute top-0 left-0 right-0 bg-yellow-500/10 border-b border-yellow-500/20 py-2 px-8 z-50 flex justify-center items-center gap-3">
          <span className="text-[10px] font-black text-yellow-500 uppercase tracking-widest">Aviso: A sessão está encerrada para os jogadores</span>
        </div>
      )}
      
      <div className={`shrink-0 bg-black/40 border-b border-white/5 relative transition-all duration-700 ${targetingRoll ? 'z-[75]' : 'z-[60]'}`}>
        <div className="p-8 flex justify-between items-center transition-all duration-700">
          <div>
            <h2 className="text-3xl font-black italic text-white uppercase tracking-tighter">Sessão Ativa</h2>
            <div className="flex items-center gap-3 mt-1">
              <span className={`w-2 h-2 rounded-full transition-all duration-700 ${isCombatActive ? 'bg-red-600 animate-ping' : 'bg-green-500'}`} />
              <p className={`text-[9px] font-black uppercase tracking-[0.2em] transition-all duration-700 ${isCombatActive ? 'text-red-600' : 'text-green-500'}`}>
                {isCombatActive ? "Protocolo de Combate" : "Modo Roleplay Livre"}
              </p>
            </div>
          </div>
        </div>

        <div className={`px-8 transition-all duration-1000 ease-in-out overflow-hidden flex gap-4 overflow-x-auto custom-scrollbar no-scrollbar ${isCombatActive ? 'pb-8 opacity-100 max-h-[200px]' : 'pb-0 opacity-0 max-h-0 pointer-events-none'}`}>
          {combatants.filter(c => c.is_enemy).slice(0, 5).map(enemy => {
              const { life: maxLife, posture: maxPosture } = calculateDerivedStats(enemy);
              const currentLife = enemy.current_hp ?? maxLife;
              const hpPerc = Math.max(0, (currentLife / maxLife) * 100);

              const currentPosture = enemy.current_posture ?? maxPosture;
              const posturePerc = Math.max(0, (currentPosture / maxPosture) * 100);

              return (
                <div
                  key={enemy.id}
                  onClick={() => {
                    if (targetingRoll) {
                      const actorId = isActingAsMaster ? selectedCombatantId : user?.id;
                      if (enemy.id === actorId) return;
                      finishDiceRoll(targetingRoll.diceResult, targetingRoll.input, targetingRoll.playerName, targetingRoll.playerImage, enemy);
                      setTargetingRoll(null);
                    }
                  }}
                  className={`flex-1 min-w-[280px] max-w-[320px] bg-zinc-900/50 border border-white/5 rounded-2xl p-4 flex gap-4 items-center group transition-all duration-500 hover:border-red-600/40 relative overflow-hidden ${targetingRoll ? 'cursor-crosshair ring-2 ring-red-600/50 animate-pulse' : ''}`}
                >
                  <div className="absolute top-0 right-0 w-24 h-24 bg-red-600/5 blur-[40px] -z-10 group-hover:bg-red-600/10 transition-colors" />
                  
                  {isActingAsMaster && !targetingRoll && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedCombatantId(selectedCombatantId === enemy.id ? null : enemy.id); }}
                      className={`absolute top-2 right-2 z-20 p-1 rounded-full border transition-all ${selectedCombatantId === enemy.id ? 'bg-green-500 border-green-400 text-white scale-110 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-black/40 border-white/10 text-white/20 hover:text-white/50'}`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                    </button>
                  )}

                  <div className="relative shrink-0">
                    {enemy.image_url ? (
                      <img src={enemy.image_url} className="w-16 h-16 rounded-xl object-cover border border-white/10 shadow-xl group-hover:scale-105 transition-transform" alt="" />
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-black/40 border border-white/10 flex items-center justify-center text-3xl">👤</div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-black italic text-white uppercase text-sm tracking-tighter truncate">{enemy.char_name}</h4>
                      <div className="flex items-center gap-3">
                        {isActingAsMaster && editingHP === enemy.id ? (
                          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                            <input autoFocus value={hpInput} onChange={e => setHpInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleHPSubmit(enemy, e.shiftKey); if (e.key === 'Escape') setEditingHP(null); }} className="bg-zinc-800 border border-red-500/50 rounded px-1.5 py-0.5 text-white font-mono text-[10px] w-12 outline-none" />
                            <span className="font-mono text-[8px] font-black text-red-500/40">/{maxLife}</span>
                          </div>
                        ) : (
                          <div onClick={e => { if (isActingAsMaster) { e.stopPropagation(); setEditingHP(enemy.id); setHpInput(currentLife.toString()); } }} className={`flex items-baseline gap-1 ${isActingAsMaster ? 'cursor-pointer hover:bg-white/5 px-1 rounded' : ''}`}>
                            <span className="font-mono text-[10px] font-black text-red-500">{currentLife}</span>
                            <span className="font-mono text-[8px] font-black text-red-900/60">/{maxLife}</span>
                          </div>
                        )}

                        {isActingAsMaster && editingPosture === enemy.id ? (
                          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                            <input autoFocus value={postureInput} onChange={e => setPostureInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handlePostureSubmit(enemy, e.shiftKey); if (e.key === 'Escape') setEditingPosture(null); }} className="bg-zinc-800 border border-green-500/50 rounded px-1.5 py-0.5 text-white font-mono text-[10px] w-12 outline-none" />
                            <span className="font-mono text-[8px] font-black text-green-500/40">/{maxPosture}</span>
                          </div>
                        ) : (
                          <div onClick={e => { if (isActingAsMaster) { e.stopPropagation(); setEditingPosture(enemy.id); setPostureInput(currentPosture.toString()); } }} className={`flex items-baseline gap-1 ${isActingAsMaster ? 'cursor-pointer hover:bg-white/5 px-1 rounded' : ''}`}>
                            <span className="font-mono text-[10px] font-black text-green-500">{currentPosture}</span>
                            <span className="font-mono text-[8px] font-black text-green-900/60">/{maxPosture}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1 mb-1.5">
                      <div className="relative h-1 bg-black rounded-full overflow-hidden border border-white/5">
                        <div
                          className={`h-full transition-all duration-1000 ease-out ${hpPerc < 25 ? 'bg-gradient-to-r from-red-800 to-red-600 animate-pulse' : 'bg-gradient-to-r from-red-700 to-red-500'}`}
                          style={{ width: `${hpPerc}%` }}
                        />
                      </div>
                      <div className="relative h-1 bg-black rounded-full overflow-hidden border border-white/5">
                        <div
                          className={`h-full transition-all duration-1000 ease-out bg-gradient-to-r from-green-700 to-green-500`}
                          style={{ width: `${posturePerc}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex flex-wrap gap-1">
                        {Array.isArray(enemy.effects) && enemy.effects.slice(0, 4).map((eff, idx) => (
                          <div key={idx} className="flex items-center gap-1 bg-black/40 border border-red-900/30 pl-0.5 pr-1 py-0.5 rounded cursor-help" title={`${eff.name}: ${eff.description}`}>
                            <span className="text-[10px]">{eff.emoji}</span>
                            <span className="text-[7px] font-black uppercase tracking-tight text-red-500/80">{eff.name}</span>
                          </div>
                        ))}
                      </div>
                      <span className="text-[7px] font-black text-zinc-600 uppercase tracking-widest italic group-hover:text-red-500/50 transition-colors">Combatente</span>
                    </div>

                    <div className="grid grid-rows-[0fr] group-hover:grid-rows-[1fr] transition-all duration-500">
                      <div className="overflow-hidden">
                        <div className="pt-2 mt-2 border-t border-white/5 flex flex-col gap-2">
                          {(() => {
                            if (enemy.type === 'Complex') {
                              const equippedWeapon = enemy.inventory?.find(i => i.equipped && (i.category === "Arma de Fogo" || i.category === "Arma Branca"));
                              const wPAT = Math.round(equippedWeapon ? calculateWeaponPAT(equippedWeapon, enemy) : 0);
                              const dPAT = Math.round(calculateDisarmedPAT(enemy));
                              
                              const acertoValue = calculateAcerto(enemy);
                              const desvioValue = calculateDesvio(enemy);
                              const bloqueioValue = calculateBloqueio(enemy);

                              return (
                                <>
                                  <div className="flex gap-2">
                                    <div className="flex-1 bg-red-500/5 border border-red-500/10 rounded-lg py-1 flex flex-col items-center">
                                      <span className="text-[6px] font-black text-zinc-500 uppercase tracking-tighter">Ataque Armado</span>
                                      <span className="text-[9px] font-black text-red-500 font-mono">{equippedWeapon ? `1d${wPAT}` : "---"}</span>
                                    </div>
                                    <div className="flex-1 bg-red-500/5 border border-red-500/10 rounded-lg py-1 flex flex-col items-center">
                                      <span className="text-[6px] font-black text-zinc-500 uppercase tracking-tighter">Desarmado</span>
                                      <span className="text-[9px] font-black text-red-500 font-mono">1d{dPAT}</span>
                                    </div>
                                  </div>
                                  <div className="flex gap-2">
                                    <div className="flex-1 bg-purple-500/5 border border-purple-500/20 rounded-lg py-1 flex flex-col items-center">
                                      <span className="text-[6px] font-black text-zinc-500 uppercase tracking-tighter text-purple-100">Acerto</span>
                                      <span className="text-[9px] font-black text-purple-100 font-mono">1d{acertoValue}</span>
                                    </div>
                                    <div className="flex-1 bg-purple-500/5 border border-purple-500/20 rounded-lg py-1 flex flex-col items-center">
                                      <span className="text-[6px] font-black text-zinc-500 uppercase tracking-tighter text-purple-100">Desvio</span>
                                      <span className="text-[9px] font-black text-purple-100 font-mono">1d{desvioValue}</span>
                                    </div>
                                    <div className="flex-1 bg-purple-500/5 border border-purple-500/20 rounded-lg py-1 flex flex-col items-center">
                                      <span className="text-[6px] font-black text-zinc-500 uppercase tracking-tighter text-purple-100">Bloqueio</span>
                                      <span className="text-[9px] font-black text-purple-100 font-mono">1d{bloqueioValue}</span>
                                    </div>
                                  </div>
                                </>
                              );
                            } else {
                              // Updated simple logic for simple NPCs
                              const wPAT = enemy.armed_pat ? (enemy.armed_pat.toString().startsWith('1d') ? enemy.armed_pat : `1d${enemy.armed_pat}`) : null;
                              const dPAT = Math.round(calculateDisarmedPAT(enemy));
                              
                              const acertoValue = calculateAcerto(enemy);
                              const desvioValue = calculateDesvio(enemy);
                              const bloqueioValue = calculateBloqueio(enemy);

                              return (
                                <>
                                  <div className="flex gap-2">
                                    <div className="flex-1 bg-red-500/5 border border-red-500/10 rounded-lg py-1 flex flex-col items-center">
                                      <span className="text-[6px] font-black text-zinc-500 uppercase tracking-tighter">Ataque Armado</span>
                                      <span className="text-[9px] font-black text-red-500 font-mono">{wPAT || "---"}</span>
                                    </div>
                                    <div className="flex-1 bg-red-500/5 border border-red-500/10 rounded-lg py-1 flex flex-col items-center">
                                      <span className="text-[6px] font-black text-zinc-500 uppercase tracking-tighter">Desarmado</span>
                                      <span className="text-[9px] font-black text-red-500 font-mono">1d{dPAT}</span>
                                    </div>
                                  </div>
                                  <div className="flex gap-2">
                                    <div className="flex-1 bg-purple-500/5 border border-purple-500/20 rounded-lg py-1 flex flex-col items-center">
                                      <span className="text-[6px] font-black text-zinc-500 uppercase tracking-tighter text-purple-100">Acerto</span>
                                      <span className="text-[9px] font-black text-purple-100 font-mono">1d{acertoValue}</span>
                                    </div>
                                    <div className="flex-1 bg-purple-500/5 border border-purple-500/20 rounded-lg py-1 flex flex-col items-center">
                                      <span className="text-[6px] font-black text-zinc-500 uppercase tracking-tighter text-purple-100">Desvio</span>
                                      <span className="text-[9px] font-black text-purple-100 font-mono">1d{desvioValue}</span>
                                    </div>
                                    <div className="flex-1 bg-purple-500/5 border border-purple-500/20 rounded-lg py-1 flex flex-col items-center">
                                      <span className="text-[6px] font-black text-zinc-500 uppercase tracking-tighter text-purple-100">Bloqueio</span>
                                      <span className="text-[9px] font-black text-purple-100 font-mono">1d{bloqueioValue}</span>
                                    </div>
                                  </div>
                                </>
                              );
                            }
                          })()}
                        </div>
                      </div>
                    </div>

                  </div>
                </div>
              );
            })}
            {combatants.filter(c => c.is_enemy).length === 0 && (
              <div className="flex-1 flex items-center justify-center border border-dashed border-white/5 rounded-2xl opacity-20">
                <span className="text-[10px] font-black uppercase tracking-widest">Nenhum Inimigo Detectado</span>
              </div>
            )}
          </div>
        </div>

      <div ref={chatContainerRef} onScroll={handleScroll} className={`flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar relative transition-all duration-500 ${targetingRoll ? 'blur-sm pointer-events-none select-none' : ''}`}>

        {groupedMessages.map((group, i) => {
          const sender = allPlayers.find(p => p.char_name === group.player_name || p.discord_username === group.player_name || p.discord_username === group.player_name?.replace(/^@/, '') || p.user_metadata?.full_name === group.player_name || p.user_metadata?.preferred_username === group.player_name) || allNPCs.find(n => n.name === group.player_name || n.npc_id === group.player_name);
          const avatar = sender?.image_url;

          return (
            <div key={group.id || i} className="group animate-in fade-in slide-in-from-left-2 duration-300 flex flex-col gap-2">
              <div className="flex items-start gap-4">
                <div className="shrink-0 mt-1">
                  {avatar ? <img src={avatar} className="w-8 h-8 rounded-full object-cover border border-white/10" alt="" /> : <div className="w-8 h-8 rounded-full bg-zinc-800 border border-white/5 flex items-center justify-center text-[10px] opacity-40">{group.player_name === 'SISTEMA' ? '⚙️' : '👤'}</div>}
                </div>
                <div className="flex-1 flex flex-col gap-1">
                  <div className="flex items-baseline gap-2">
                    <span className={`font-black italic uppercase text-[11px] tracking-tight shrink-0 ${group.player_name === 'SISTEMA' ? 'text-cyan-500' : 'text-red-600'}`}>{group.player_name}</span>
                    <span className="text-[7px] font-black text-zinc-700 uppercase font-mono">{new Date(group.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                  </div>
                  <div className="flex flex-col gap-2 mt-1">
                    {group.messages.map((m, mi) => {
                      if (m.content.startsWith('DICE_ROLL|')) {
                        const [, pName, expr, total, detail, status, category = "normal", pImage = "", diceType = "", targetInfo = ""] = m.content.split('|');
                        const [targetName, effectNote = ""] = targetInfo.split('|');
                        const styles = {
                          combat: { bg: "bg-red-500/5", border: "border-red-500/20", accent: "text-red-500" },
                          secondary: { bg: "bg-blue-500/5", border: "border-blue-500/20", accent: "text-blue-400" },
                          luck: { bg: "bg-yellow-500/5", border: "border-yellow-500/20", accent: "text-yellow-500" },
                          normal: { bg: "bg-zinc-900/80", border: "border-white/5", accent: "text-zinc-500" }
                        };
                        const style = styles[category] || styles.normal;
                        return (
                          <div key={m.id || `${i}-${mi}`} className={`${style.bg} border ${style.border} rounded-2xl p-6 my-2 shadow-2xl relative overflow-hidden group/dice`}>
                            <div className="flex justify-between items-start gap-6">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-4">
                                  <span className={`${style.accent} text-[10px] font-black uppercase tracking-widest`}>Tentativa de</span>
                                  <span className="text-white text-[11px] font-bold italic">{expr}</span>
                                  <div dangerouslySetInnerHTML={{ __html: status }} />
                                  {diceType && <span className="ml-auto bg-white/10 text-white text-[8px] font-black uppercase px-2 py-0.5 rounded border border-white/10 tracking-widest italic">{diceType}</span>}
                                </div>
                                <div className="flex items-end gap-4">
                                  <div className="text-5xl font-black italic text-white/40 tracking-tighter drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]">{total}</div>
                                  <div className="pb-1.5"><div className="flex items-center gap-1.5" dangerouslySetInnerHTML={{ __html: detail }} /></div>
                                </div>

                                <div className="mt-6 flex items-center gap-3">
                                  <div className="h-[1px] w-8 bg-zinc-800" />
                                  <div className="text-[9px] font-black text-zinc-500 uppercase tracking-widest italic">Por @{pName}</div>
                                  {targetName && <div className="text-[9px] font-black text-red-500 uppercase tracking-widest italic mt-1">Alvo: {targetName}{effectNote}</div>}
                                </div>
                              </div>
                              {pImage && (
                                <div className="relative group/diceimg shrink-0">
                                  <div className="absolute -top-2 -left-2 w-4 h-4 border-t-2 border-l-2 border-white/10 group-hover/diceimg:border-white/30" />
                                  <div className="absolute -bottom-2 -right-2 w-4 h-4 border-b-2 border-r-2 border-white/10 group-hover/diceimg:border-white/30" />
                                  <div className="relative w-28 h-28 overflow-hidden rounded-xl border border-white/10 shadow-2xl transition-all duration-500 group-hover/diceimg:scale-105 group-hover/diceimg:-rotate-2">
                                    <img src={pImage} alt="" className="w-full h-full object-cover transition-transform duration-1000 group-hover/diceimg:scale-110" />
                                    <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%)] bg-[length:100%_4px] opacity-20" />
                                  </div>
                                  <div className="absolute -inset-4 bg-white/5 blur-2xl -z-10 opacity-0 group-hover/diceimg:opacity-100 transition-opacity duration-700" />
                                </div>
                              )}
                            </div>

                            {diceType === 'dano' && (
                              <div className="mt-6 pt-6 border-t border-white/5 flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16 relative overflow-visible pb-4">
                                {/* Decorative Background Effect */}
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-red-600/5 blur-[60px] -z-10" />
                                
                                {/* Dano Final Section */}
                                <div className="flex flex-col items-center">
                                  <span className="text-[9px] font-black text-red-600/60 uppercase tracking-[0.4em] mb-3">Dano Final</span>
                                  <div className="relative">
                                    {/* Note: This value can include future RPG math bonuses/modifiers */}
                                    <span className="text-5xl font-black italic text-white tracking-tighter drop-shadow-[0_0_25px_rgba(220,38,38,0.5)]">{total}</span>
                                    <div className="absolute -bottom-1 left-0 right-0 h-1 bg-red-600/20 blur-md rounded-full" />
                                  </div>
                                </div>

                                <div className="hidden md:block w-px h-16 bg-white/5" />

                                {/* Dano de Postura Section */}
                                <div className="flex flex-col items-center">
                                  <span className="text-[9px] font-black text-green-500/40 uppercase tracking-[0.4em] mb-4">Dano de Postura</span>
                                  {(() => {
                                    const dmgValue = Number(total);
                                    const pLeve = Math.max(1, Math.floor(dmgValue / 5));
                                    const pMedio = Math.min(pLeve * 2, Math.max(1, Math.round(dmgValue / 3)));
                                    const pPesado = Math.min(pMedio * 3, Math.max(1, Math.ceil(dmgValue)));
                                    
                                    return (
                                      <div className="grid grid-cols-3 gap-10">
                                        <div className="flex flex-col items-center">
                                          <span className="text-[7px] font-black text-zinc-600 uppercase tracking-widest mb-1">Leve</span>
                                          <span className="text-2xl font-black text-green-600/80 font-mono drop-shadow-[0_0_10px_rgba(22,163,74,0.2)]">{pLeve}</span>
                                        </div>
                                        <div className="flex flex-col items-center">
                                          <span className="text-[7px] font-black text-zinc-600 uppercase tracking-widest mb-1">Médio</span>
                                          <span className="text-2xl font-black text-green-500 font-mono drop-shadow-[0_0_10px_rgba(34,197,94,0.2)]">{pMedio}</span>
                                        </div>
                                        <div className="flex flex-col items-center">
                                          <span className="text-[7px] font-black text-zinc-600 uppercase tracking-widest mb-1">Pesado</span>
                                          <span className="text-2xl font-black text-green-400 font-mono drop-shadow-[0_0_10px_rgba(74,222,128,0.2)]">{pPesado}</span>
                                        </div>
                                      </div>
                                    );
                                  })()}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      }
                      if (m.content.startsWith('LOOT_INTERACTION|')) {
                        const [, location, tier, masterName, masterAvatar, diceExpr, itemsJson, rollResult = "0", rollerName = "none"] = m.content.split('|');
                        const lootItems = JSON.parse(itemsJson);
                        const isRolled = parseInt(rollResult) > 0;
                        const allCollected = lootItems.length > 0 && lootItems.every(item => item.qty === 0);

                        if (lootItems.length === 0) {
                          return (
                            <div key={m.id || `${i}-${mi}`} className="bg-zinc-900/50 border border-white/5 rounded-2xl p-6 my-2 opacity-50 italic text-[10px] text-zinc-500 text-center uppercase tracking-widest">
                              O baú está vazio.
                            </div>
                          );
                        }

                        return (
                          <div key={m.id || `${i}-${mi}`} className={`bg-zinc-900 border ${allCollected ? 'border-white/5' : 'border-yellow-500/20'} rounded-2xl p-6 my-4 shadow-2xl relative overflow-hidden group/loot`}>
                            <div className={`absolute top-0 right-0 w-32 h-32 ${allCollected ? 'bg-white/5' : 'bg-yellow-500/5'} blur-[50px] -z-10`} />
                            
                            <div className="flex items-center gap-4 mb-6">
                              <div className={`w-12 h-12 shrink-0 ${allCollected ? 'bg-zinc-800/50 border-white/5' : 'bg-yellow-500/10 border-yellow-500/30'} border rounded-xl flex items-center justify-center shadow-xl`}>
                                <img src="/chest.png" alt="" className={`w-8 h-8 object-contain ${allCollected ? 'grayscale opacity-50' : 'animate-bounce'}`} />
                              </div>
                              <div>
                                <h4 className="text-white font-black italic uppercase text-sm tracking-tighter">{location}</h4>
                                <div className="flex items-center gap-2">
                                  <span className={`text-[9px] font-black uppercase tracking-widest ${allCollected ? 'text-zinc-500' : 'text-yellow-500'}`}>Espólio Encontrado</span>
                                  <span className="text-[8px] bg-white/5 px-1.5 py-0.5 rounded text-zinc-500 font-mono">{diceExpr}</span>
                                  {isRolled && <span className="text-[10px] font-black text-yellow-500 ml-2 animate-in zoom-in duration-500">Resultado: {rollResult}</span>}
                                </div>
                              </div>
                            </div>

                            {!isRolled ? (
                              <div className="flex flex-col items-center gap-4 py-8 bg-black/40 border border-white/5 rounded-2xl">
                                <div className="w-16 h-16 relative">
                                  <img src="/dice.gif" alt="" className="w-full h-full object-contain opacity-50" />
                                </div>
                                <button
                                  onClick={() => handleLootRoll(m.id)}
                                  className="px-8 py-3 bg-yellow-500/10 border border-yellow-500/30 text-yellow-500 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-yellow-500 hover:text-black transition-all"
                                >
                                  Rolar Dado para Saquear
                                </button>
                              </div>
                            ) : (
                              <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-700">
                                {lootItems.map((item, idx) => (
                                  <div key={idx} className={`flex items-center justify-between p-3 bg-black/40 border border-white/5 rounded-xl transition-all group/item ${item.qty === 0 ? 'opacity-50 grayscale' : 'hover:border-yellow-500/30'}`}>
                                    <div className="flex flex-col">
                                      <span className="text-xs font-bold text-zinc-200">{item.name} <span className={`text-[10px] ml-1 ${item.qty === 0 ? 'text-zinc-500' : 'text-yellow-500'}`}>x{item.qty}</span></span>
                                      <span className={`text-[8px] font-black uppercase tracking-tighter ${RARITY_CONFIG[item.rarity]?.color || 'text-zinc-500'}`}>{item.rarity}</span>
                                    </div>
                                    <button
                                      disabled={item.qty === 0}
                                      onClick={() => handlePickUp(m.id, idx)}
                                      className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${item.qty === 0 ? 'bg-zinc-800 text-zinc-500 border border-zinc-700 cursor-not-allowed' : 'bg-yellow-500/10 border border-yellow-500/30 text-yellow-500 hover:bg-yellow-500 hover:text-black'}`}
                                    >
                                      Coletar
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}

                            {isRolled && (
                              <div className="mt-4 pt-4 border-t border-white/5 flex justify-between items-center animate-in fade-in duration-1000">
                                <span className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.2em]">Espólio Saqueado por {rollerName}</span>
                                <div className="w-6 h-6 rounded-full overflow-hidden border border-white/10 opacity-50">
                                  {masterAvatar && <img src={masterAvatar} alt="" className="w-full h-full object-cover" />}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      }
                      if (m.content.startsWith('IMAGE|') || m.content.startsWith('GIF|')) {
                        const isImage = m.content.startsWith('IMAGE|');
                        const [, url, w, h] = m.content.split('|');
                        return (
                          <div key={m.id || `${i}-${mi}`} className={`my-2 overflow-hidden rounded-xl border border-white/5 shadow-2xl bg-zinc-900/50 ${isImage ? 'max-w-md' : 'max-w-[200px]'}`} style={{ aspectRatio: w && h ? `${w}/${h}` : 'auto', width: isImage ? `min(${w || 400}px, 100%)` : '200px' }}>
                            <img src={url} alt="" className="w-full h-full block object-cover" />
                          </div>
                        );
                      }
                      return <p key={m.id || `${i}-${mi}`} className={`text-sm leading-relaxed font-medium break-words whitespace-pre-wrap ${group.player_name === 'SISTEMA' ? 'text-cyan-400 italic font-bold' : 'text-zinc-300'}`} dangerouslySetInnerHTML={{ __html: m.content.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white bg-white/10 px-1.5 py-0.5 rounded">$1</strong>').replace(/\n/g, '<br/>') }} />;
                    })}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={scrollRef} className="h-px w-full" style={{ overflowAnchor: 'auto' }} />
      </div>

      <form onSubmit={sendMsg} className={`shrink-0 p-8 bg-black/60 border-t border-white/5 relative transition-all duration-500 ${targetingRoll ? 'blur-sm pointer-events-none select-none' : ''}`}>
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
                              const inputChar = input[cIdx];
                              let charColor = 'text-zinc-600';
                              if (inputChar !== undefined) {
                                if (inputChar.toLowerCase() === char.toLowerCase()) {
                                  charColor = 'text-white';
                                } else {
                                  charColor = 'text-red-600';
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
            {showGifPicker && <GifPicker onSelect={sendGif} onClose={() => setShowGifPicker(false)} />}
            {showLootSelector && (
              <div className="absolute bottom-full right-0 mb-4 w-80 bg-zinc-900 border border-white/10 rounded-[20px] shadow-2xl z-50 backdrop-blur-md overflow-hidden flex flex-col p-4 animate-in slide-in-from-bottom-2 duration-200">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-[10px] font-black text-yellow-500 uppercase tracking-widest">Enviar Espólio</h3>
                  <button onClick={() => setShowLootSelector(false)} className="text-zinc-500 hover:text-white text-xl">×</button>
                </div>
                <input 
                  value={lootSearch}
                  onChange={(e) => setLootSearch(e.target.value)}
                  placeholder="Buscar loot..."
                  className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2 text-xs text-white mb-4 outline-none focus:border-yellow-500/50 transition-all"
                />
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-[8px] font-black text-zinc-500 uppercase">Aparência do Dado:</span>
                  <input 
                    value={lootDicePlaceholder}
                    onChange={(e) => setLootDicePlaceholder(e.target.value)}
                    placeholder="1d20"
                    className="flex-1 bg-black/40 border border-white/5 rounded-lg px-3 py-1 text-[10px] text-white outline-none focus:border-yellow-500/50 transition-all font-mono"
                  />
                </div>
                <div className="max-h-60 overflow-y-auto space-y-1 custom-scrollbar">
                  {lootTables
                    .filter(lt => lt.name.toLowerCase().includes(lootSearch.toLowerCase()))
                    .map(lt => (
                      <button
                        key={lt.id}
                        onClick={() => sendLoot(lt)}
                        className="w-full text-left p-3 rounded-xl bg-white/[0.02] hover:bg-yellow-500/10 border border-white/5 hover:border-yellow-500/30 transition-all group"
                      >
                        <p className="text-[10px] font-black text-zinc-300 group-hover:text-yellow-500">{lt.name}</p>
                        <p className="text-[8px] text-zinc-600 uppercase font-bold">{lt.items?.length || 0} itens cadastrados</p>
                      </button>
                    ))}
                </div>
              </div>
            )}
            {showDiceQuickMenu && (
              <div className="absolute bottom-full right-0 mb-4 w-64 bg-zinc-900 border border-white/10 rounded-[20px] shadow-2xl z-50 backdrop-blur-md overflow-hidden flex flex-col p-4 animate-in slide-in-from-bottom-2 duration-200">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-[10px] font-black text-red-500 uppercase tracking-widest">Rolagem Rápida</h3>
                  <button onClick={() => setShowDiceQuickMenu(false)} className="text-zinc-500 hover:text-white text-xl">×</button>
                </div>
                <div className="space-y-4">
                  {[
                    { id: 'acerto', label: 'Dado de Acerto' },
                    { id: 'desvio', label: 'Dado de Desvio' },
                    { id: 'bloqueio', label: 'Dado de Bloqueio' },
                    { id: 'dano', label: 'Dado de Dano' }
                  ].map(dice => (
                    <div key={dice.id} className="flex flex-col gap-1.5">
                      <label className="text-[8px] font-black text-zinc-500 uppercase tracking-tighter ml-1">{dice.label}</label>
                      <div className="flex gap-2">
                        <input
                          value={quickDiceInputs[dice.id]}
                          onChange={(e) => setQuickDiceInputs(prev => ({ ...prev, [dice.id]: e.target.value }))}
                          onKeyDown={(e) => e.key === 'Enter' && handleQuickRoll(dice.id, quickDiceInputs[dice.id])}
                          placeholder="Ex: 1d20 / 5"
                          className="flex-1 bg-black/40 border border-white/5 rounded-lg px-3 py-1.5 text-[10px] text-white outline-none focus:border-red-600/50 transition-all font-mono"
                        />
                        <button
                          onClick={() => handleQuickRoll(dice.id, quickDiceInputs[dice.id])}
                          className="px-3 py-1.5 bg-red-600/10 border border-red-600/20 text-red-500 rounded-lg text-[10px] font-black uppercase tracking-tighter hover:bg-red-600 hover:text-white transition-all"
                        >
                          Rolar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <input value={input} onChange={handleInputChange} onKeyDown={onKeyDown} placeholder="Interaja com o mundo..." disabled={!!targetingRoll} className="w-full bg-zinc-900 border border-white/10 rounded-2xl pl-8 pr-24 py-5 text-white text-sm outline-none focus:border-red-600 transition-all shadow-2xl disabled:opacity-50" />
            <div className="absolute right-3 top-1/2 -translate-y-[60%] flex items-center gap-1">
              {isActingAsMaster && (
                <button type="button" onClick={() => setShowLootSelector(!showLootSelector)} className={`p-2 transition-all ${showLootSelector ? 'text-yellow-500 scale-110' : 'text-zinc-500 hover:text-white'}`} title="Enviar Espólio">
                  <span className="text-xl">📦</span>
                </button>
              )}
              <button type="button" onClick={() => setShowDiceQuickMenu(!showDiceQuickMenu)} className={`p-2 transition-all ${showDiceQuickMenu ? 'text-red-500 scale-110' : 'text-zinc-500 hover:text-white'}`} title="Rolagem Rápida">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="12" height="12" x="2" y="10" rx="2" ry="2"/><path d="m17.92 14 3.5-3.5a2.24 2.24 0 0 0 0-3l-5-5a2.24 2.24 0 0 0-3 0L10 6"/><path d="M6 14h.01"/><path d="M18 14h.01"/><path d="M15 6h.01"/><path d="M18 9h.01"/></svg>
              </button>
              <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
              <button type="button" disabled={isUploading} onClick={() => fileInputRef.current?.click()} className={`p-2 transition-all ${isUploading ? 'animate-pulse text-yellow-500' : 'text-zinc-500 hover:text-white'}`} title="Anexar Imagem"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg></button>
              <button type="button" onClick={() => setShowGifPicker(!showGifPicker)} className={`p-2 transition-all ${showGifPicker ? 'text-red-500 scale-110' : 'text-zinc-500 hover:text-white'}`} title="Inserir GIF"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></button>
              <button type="submit" disabled={!input.trim()} className="p-2 text-zinc-500 hover:text-white disabled:opacity-30 transition-colors" title="Enviar mensagem"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg></button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
