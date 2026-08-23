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
  calculateDerivedStats,
  calculateCurrentWeight,
  evaluateCondition
} from '../../lib/rpg-math';
import { RARITY_CONFIG } from '../../constants/gameData';
import GifPicker from '../GifPicker';
import { TooltipWrapper } from '../UIElements';
import { createPortal } from 'react-dom';
import TaskFlowManager from './TaskFlowManager';

/* 
  NOTE: This system uses a server-side RPC function 'toggle_session' to clear the chat.
  If you need to preserve messages in the future, modify the 'toggle_session' 
  database function in Supabase to avoid the 'DELETE FROM messages' command.
*/

/* 
  NOTE: This system uses a server-side RPC function 'toggle_session' to clear the chat.
  If you need to preserve messages in the future, modify the 'toggle_session' 
  database function in Supabase to avoid the 'DELETE FROM messages' command.
*/

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
  lootTables = [],
  showToast,
  input,
  setInput,
  quickDiceInputs,
  setQuickDiceInputs,
  traders = [],
  tradeRequests = []
}) {

  const [hasMounted, setHasMounted] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [showDiceQuickMenu, setShowDiceQuickMenu] = useState(false);
  const [showSkillsMenu, setShowSkillsMenu] = useState(false);
  const [skillSearch, setSkillSearch] = useState("");
  const [showLootSelector, setShowLootSelector] = useState(false);
  const [lootSearch, setLootSearch] = useState("");
  const [lootDicePlaceholder, setLootDicePlaceholder] = useState("1d20");
  const [lootRollInputs, setLootRollInputs] = useState({});
  const [pendingOffers, setPendingOffers] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  const [suggestionData, setSuggestionData] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  const [displayImage, setDisplayImage] = useState(sharedImage);
  const [isVisible, setIsVisible] = useState(!!sharedImage?.url);
  const [isContrastActive, setIsContrastActive] = useState(false);
  const [isBigImage, setIsBigImage] = useState(false);

  const [editingHP, setEditingHP] = useState(null);
  const [editingPosture, setEditingPosture] = useState(null);
  const [editingDamage, setEditingDamage] = useState(null); // { msgId, field: 'final' | 'posture' }
  const [hpInput, setHpInput] = useState("");
  const [postureInput, setPostureInput] = useState("");
  const [damageInput, setDamageInput] = useState("");

  const [showTraderSelector, setShowTraderSelector] = useState(false);
  const [showTradeRequests, setShowTradeRequests] = useState(false);

  const [itemsDB, setItemsDB] = useState([]);
  const [hoveredSkill, setHoveredSkill] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    fetchItemsDB();
    fetchPendingTradeOffers();

    // Check every 5 seconds as a safety fallback for Realtime issues
    const pollInterval = setInterval(fetchPendingTradeOffers, 5000);

    return () => clearInterval(pollInterval);
  }, [user?.id]);

  // After first render, enable CSS transitions for the combat header
  // to avoid the initial flicker when entering a session with combat active
  useEffect(() => {
    setHasMounted(true);
  }, []);

  const fetchItemsDB = async () => {
    const { data } = await supabase.from('items').select('*');
    if (data) setItemsDB(data);
  };

  const fetchPendingTradeOffers = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('trade_requests')
      .select('item')
      .eq('player_id', user.id)
      .eq('status', 'pending');
    
    if (data) {
      const pendingIds = data.map(req => req.item?.id).filter(Boolean);
      setPendingOffers(pendingIds);
    }
  };

  const toggleTraderSelector = () => {
    setShowTraderSelector(!showTraderSelector);
    setShowGifPicker(false);
    setShowDiceQuickMenu(false);
    setShowSkillsMenu(false);
    setShowLootSelector(false);
    setShowTradeRequests(false);
  };

  const toggleTradeRequests = () => {
    setShowTradeRequests(!showTradeRequests);
    setShowTraderSelector(false);
    setShowGifPicker(false);
    setShowDiceQuickMenu(false);
    setShowSkillsMenu(false);
    setShowLootSelector(false);
  };

  const sendTrader = async (trader) => {
    const masterChar = allPlayers.find(p => p.rank === 'Mestre');
    const avatar = masterChar?.image_url || "";
    const username = masterChar?.discord_username || ".enderu";
    
    const content = `TRADER_INTERACTION|${trader.id}|${trader.name}|${username}|${avatar}`;
    
    await supabase.from('messages').insert({
      player_name: "SISTEMA",
      content,
      is_system: true
    });
    
    setShowTraderSelector(false);
  };

  const handleAcceptTradeRequest = async (request) => {
    console.log('Accepting trade request:', request.id);
    
    // We update the status to 'approved' FIRST so the player sees it immediately via Realtime
    // and the button re-enables/item clears. The select() ensures the payload is complete.
    await supabase.from('trade_requests').update({ status: 'approved' }).eq('id', request.id).select();

    const { data, error } = await supabase.rpc('approve_trade_request', {
      p_request_id: request.id,
      p_master_id: user.id
    });

    if (error || !data?.success) {
      console.error("Error approving trade:", error || data?.error);
      showToast(`Erro ao aprovar a venda: ${error?.message || data?.error || 'Erro desconhecido'}`);
      // If RPC fails, we might want to revert status but usually it's better to just log
      return;
    }
      
    showToast("Venda aprovada!");
  };

  const handleRejectTradeRequest = async (request) => {
    console.log('Rejecting trade request:', request.id);
    const { error } = await supabase.from('trade_requests').update({ status: 'declined' }).eq('id', request.id).select();
    if (!error) {
      showToast("Venda rejeitada.");
    } else {
      console.error("Error rejecting trade:", error);
      showToast("Erro ao rejeitar venda.");
    }
  };

  const handleHPSubmit = async (player, isShiftPressed = false) => {
    try {
      const { life: maxLife } = calculateDerivedStats(player);
      let equation = hpInput.toLowerCase().replace(/random/g, () => Math.random().toString());
      let newHP;
      try {
        if (/[^0-9+\-*/().\s|e]/.test(equation)) throw new Error("Invalid characters");
        newHP = Math.round(new Function(`return ${equation}`)());
      } catch (e) {
        showToast("Equação inválida!");
        return;
      }
      if (isNaN(newHP)) return;
      if (!isShiftPressed && newHP > maxLife) newHP = maxLife;
      const table = player.is_npc ? 'npcs' : 'characters';
      const dbId = player.is_npc ? player.dbId : player.id;
      await supabase.from(table).update({ current_hp: newHP }).eq('id', dbId);
      setEditingHP(null);
    } catch (err) {
      showToast("Erro ao atualizar HP: " + err.message);
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
        showToast("Equação inválida!");
        return;
      }
      if (isNaN(newPosture)) return;
      if (!isShiftPressed && newPosture > maxPosture) newPosture = maxPosture;
      const table = player.is_npc ? 'npcs' : 'characters';
      const dbId = player.is_npc ? player.dbId : player.id;
      await supabase.from(table).update({ current_posture: newPosture }).eq('id', dbId);
      setEditingPosture(null);
    } catch (err) {
      showToast("Erro ao atualizar Postura: " + err.message);
    }
  };

  const [showAddEffect, setShowAddEffect] = useState(null); // combatantId
  const [effectDuration, setEffectDuration] = useState("2");

  const addEffect = async (combatant, effectKey) => {
    const { EFFECTS } = await import('../../constants/gameData');
    const effectTemplate = EFFECTS[effectKey];
    if (!effectTemplate) return;

    const currentEffects = Array.isArray(combatant.effects) ? combatant.effects : [];
    const newEffect = {
      ...effectTemplate,
      key: effectKey,
      duration: parseInt(effectDuration) || 2,
      addedAtTurn: 1 // Assuming 1 if not passed from CombatManager context or we could pass turn as prop
    };

    const newEffects = [...currentEffects, newEffect];
    const table = combatant.is_npc ? 'npcs' : 'characters';
    const dbId = combatant.is_npc ? combatant.dbId : combatant.id;

    await supabase.from(table).update({ effects: newEffects }).eq('id', dbId);
    setShowAddEffect(null);
  };

  const scrollRef = useRef();
  const chatContainerRef = useRef(null);
  const isAtBottomRef = useRef(true);
  const fileInputRef = useRef(null);
  const lastMessageCountRef = useRef(0);

  const [sellPrices, setSellPrices] = useState({});
  const [traderActiveTab, setTraderActiveTab] = useState({});
  const [breathingRollInputs, setBreathingRollInputs] = useState({});

  const handleScroll = () => {
    if (!chatContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    
    // Calculate the average height of visible message groups to use as threshold
    // We look at the direct children of the scroll container (message group elements)
    const container = chatContainerRef.current;
    const messageGroups = container.querySelectorAll('[data-message-group]');
    let avgMessageHeight = 80; // fallback default
    if (messageGroups.length > 0) {
      let totalHeight = 0;
      messageGroups.forEach(el => { totalHeight += el.offsetHeight; });
      avgMessageHeight = totalHeight / messageGroups.length;
    }
    
    // Only consider "at bottom" if within one full message height from the bottom
    const isAtBottom = distanceFromBottom < Math.max(avgMessageHeight, 80);
    isAtBottomRef.current = isAtBottom;
  };

  // Instantly scroll to bottom, retrying to handle late layout shifts
  const scrollToBottomInstant = () => {
    if (!chatContainerRef.current) return;
    const el = chatContainerRef.current;
    el.scrollTop = el.scrollHeight;
  };

  // Scroll to bottom with retries — used for layout shifts (combat toggle, etc.)
  const scrollToBottomWithRetries = () => {
    scrollToBottomInstant();
    const timeouts = [10, 50, 150, 300, 500].map(delay =>
      setTimeout(scrollToBottomInstant, delay)
    );
    return () => timeouts.forEach(clearTimeout);
  };

  useEffect(() => {
    if (!chatContainerRef.current) return;
    
    const newCount = messages.length;
    const previousCount = lastMessageCountRef.current;
    lastMessageCountRef.current = newCount;
    
    // First load — transitioning from 0 to some messages
    const isFirstLoad = previousCount === 0 && newCount > 0;
    
    if (isFirstLoad) {
      // Instant scroll with no animation, then retry several times
      // to catch late layout shifts from many messages rendering
      return scrollToBottomWithRetries();
    }
    
    // Normal new message behavior — smooth scroll only if already at bottom
    if (isAtBottomRef.current) {
      requestAnimationFrame(() => {
        if (chatContainerRef.current) {
          chatContainerRef.current.scrollTo({
            top: chatContainerRef.current.scrollHeight,
            behavior: 'smooth'
          });
        }
      });
    }
  }, [messages]);

  // Re-scroll when combat starts/stops because the header expands/contracts
  // which changes the chat container height and can leave the scroll offset stale
  useEffect(() => {
    if (!chatContainerRef.current) return;
    if (!isAtBottomRef.current) return;
    return scrollToBottomWithRetries();
  }, [isCombatActive]);

  useEffect(() => {
    const handleTradeUpdates = (payload) => {
      console.log('Trade update received:', payload);
      const { new: newReq, old: oldReq, eventType } = payload;
      
      const targetReq = eventType === 'DELETE' ? oldReq : newReq;
      if (!targetReq) return;

      // Use a loose equality check or compare with user.id and check character state
      // The payload might contain player_id as a string or numeric, let's be robust
      const targetPlayerId = String(targetReq.player_id || targetReq.characters?.id || "");
      const currentPlayerId = String(user?.id || "");

      const itemId = targetReq.item?.id;
      if (!itemId) return;

      console.log(`Checking match: target=${targetPlayerId}, current=${currentPlayerId}, item=${itemId}`);

      // We remove from pendingOffers if:
      // 1. It belongs to us AND (status changed to approved/declined OR was deleted)
      // 2. OR if it was deleted (even if we don't have the player_id, we can try matching by itemId as a fallback)
      
      const isOurRequest = targetPlayerId === currentPlayerId;
      
      if (isOurRequest) {
          if (eventType === 'UPDATE') {
            if (targetReq.status === 'declined' || targetReq.status === 'approved') {
                if (targetReq.status === 'declined') {
                  showToast(`Sua oferta de venda para ${targetReq.item.name} foi recusada.`);
                } else {
                  showToast(`Sua oferta de venda para ${targetReq.item.name} foi aprovada!`);
                }
                setPendingOffers(prev => prev.filter(id => String(id) !== String(itemId)));
            }
          } else if (eventType === 'DELETE') {
            setPendingOffers(prev => prev.filter(id => String(id) !== String(itemId)));
          }
      } else if (eventType === 'DELETE') {
          // Fallback: if we see a delete for an item that is in our pending list, remove it
          setPendingOffers(prev => prev.filter(id => String(id) !== String(itemId)));
      }
    };

    const subscription = supabase
      .channel('trade_requests_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trade_requests' }, (p) => {
        handleTradeUpdates(p);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [user?.id, showToast]);

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
      setDisplayImage(null);
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
      showToast("Personagem não encontrado.");
      return;
    }

    // Calculate current weight
    const currentInventory = playerChar.inventory || [];
    const currentWeight = calculateCurrentWeight(currentInventory);
    const itemWeight = Number(itemToPick.carga) || 1; // Default to 1 if not specified
    const maxWeight = calculateDerivedStats(playerChar).weight_limit || 0;

    if (currentWeight + itemWeight > maxWeight) {
      showToast("Inventário Cheio! Você não tem Cargas suficientes.");
      return;
    }

    // 2. Add to inventory
    const newInventory = [...currentInventory];
    const itemToAdd = {
      ...itemToPick,
      id: Date.now() + Math.random(),
      equipped: false
    };
    newInventory.push(itemToAdd);

    // 3. Update character in Supabase
    const { error: charError } = await supabase.from('characters').update({ inventory: newInventory }).eq('id', playerChar.id);
    if (charError) {
      showToast("Erro ao atualizar inventário: " + charError.message);
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

  const handleDiscard = async (msgId, itemIdx) => {
    const msg = messages.find(m => m.id === msgId);
    if (!msg) return;

    const parts = msg.content.split('|');
    const items = JSON.parse(parts[6]);
    const itemToPick = items[itemIdx];

    if (!itemToPick || itemToPick.qty <= 0) return;

    // 1. Remove from message or decrement quantity
    let newItems = [...items];
    newItems[itemIdx] = { ...itemToPick, qty: Math.max(0, itemToPick.qty - 1) };

    // 2. Update message in Supabase
    parts[6] = JSON.stringify(newItems);
    const newContent = parts.join('|');
    
    await supabase.from('messages').update({ content: newContent }).eq('id', msg.id);
  };

  const handleBuyFromTrader = async (traderId, itemToBuy) => {
    if (!user) return;
    const playerChar = allPlayers.find(p => p.id === user.id);
    if (!playerChar) return;

    if (itemToBuy.qty <= 0) return showToast("Item esgotado!");

    if ((playerChar.dollars || 0) < itemToBuy.price) {
      return showToast("Dinheiro insuficiente!");
    }

    // 1. Find full item data
    const fullItemData = itemsDB.find(i => i.id === itemToBuy.item_id || i.item_id === itemToBuy.item_id);
    if (!fullItemData) return showToast("Item não encontrado no banco de dados.");
    
    // 2. Weight (Carga) check
    const currentInventory = playerChar.inventory || [];
    const currentWeight = calculateCurrentWeight(currentInventory);
    const itemWeight = Number(fullItemData.carga) || 1; 
    const { weight_limit: maxWeight } = calculateDerivedStats(playerChar);

    if (currentWeight + itemWeight > maxWeight) {
      showToast("Inventário Cheio! Você não tem Cargas suficientes.");
      return;
    }

    // 3. Process Purchase via RPC (Atomic money and stock update)
    const { data, error } = await supabase.rpc('process_item_purchase', {
      p_trader_id: traderId,
      p_player_id: playerChar.id,
      p_item_id: itemToBuy.item_id,
      p_price: itemToBuy.price
    });

    if (error || !data?.success) {
      showToast("Erro ao processar compra: " + (error?.message || data?.error || 'Erro desconhecido'));
      return;
    }

    showToast(`Comprado: ${data.itemName || fullItemData.name}`);
  };

  const handleSellToTrader = async (traderId, invItem, price) => {
    if (!user) return;
    const playerChar = allPlayers.find(p => p.id === user.id);

    if (!playerChar) {
        showToast("ERRO: Personagem do jogador não encontrado.");
        return;
    }

    if (!price || isNaN(price) || price <= 0) {
      return showToast("Defina um preço válido.");
    }

    // Check for existing pending offer for this item
    const { data: existingOffer, error: fetchError } = await supabase
      .from('trade_requests')
      .select('id')
      .eq('player_id', playerChar.id)
      .eq('trader_id', traderId)
      .eq('status', 'pending')
      .filter('item->>id', 'eq', invItem.id)
      .maybeSingle();

    if (fetchError) {
      console.error("Error checking existing offers:", fetchError);
    }

    if (existingOffer) {
      showToast("Já existe uma oferta pendente para este item.");
      if (!pendingOffers.includes(invItem.id)) {
        setPendingOffers(prev => [...prev, invItem.id]);
      }
      return;
    }

    setPendingOffers(prev => [...prev, invItem.id]);

    const { error } = await supabase.from('trade_requests').insert({
      player_id: playerChar.id,
      trader_id: traderId,
      item: invItem,
      value: Number(price),
      type: 'sell',
      status: 'pending'
    });

    if (error) {
      console.error("Error creating trade request:", error);
      showToast(`Erro ao criar oferta: ${error.message}`);
      setPendingOffers(prev => prev.filter(id => String(id) !== String(invItem.id))); // Re-enable button on error
    } else {
      showToast("Oferta enviada ao Mestre!");
      // We also update the tradeRequests prop via parent if possible, but usually Realtime handles the list
      // The master needs to see this in their tradeRequests list.
    }
  };

  const handleDeleteMessage = async (messageId) => {
    if (!isMaster) return;
    try {
      await supabase.from('messages').delete().eq('id', messageId);
    } catch (error) {
      console.error("Error deleting message:", error);
      showToast("Erro ao deletar mensagem.");
    }
  };

  const handlePinMessage = async (message) => {
    if (!isMaster) return;
    try {
      await supabase.from('messages').update({ is_pinned: !message.is_pinned }).eq('id', message.id);
    } catch (error) {
      console.error("Error pinning message:", error);
      showToast("Erro ao fixar mensagem.");
    }
  };

  const handleLootRoll = async (msgId) => {
    console.log('handleLootRoll called for msgId:', msgId);
    const msg = messages.find(m => m.id === msgId);
    if (!msg) {
      console.error('Message not found for id:', msgId);
      return;
    }

    const parts = msg.content.split('|');
    const userDice = lootRollInputs[msgId] || parts[5];
    console.log('Rolling dice:', userDice);
    
    // Perform the roll
    const result = rollDice(userDice);
    console.log('Roll result:', result);
    if (!result) {
      console.error('Roll failed for expression:', userDice);
      return;
    }

    // Calculate multiplier based on result
    let multiplier = 1;
    if (result.total >= 10) {
      multiplier = result.total / 10;
    } else {
      multiplier = (result.total / 18) + (8 / 18);
    }

    // Fetch the loot table
    const { data: lootTable, error: tableError } = await supabase.from('loot_tables').select('*').eq('name', parts[1]).single();
    if (tableError || !lootTable) {
      showToast("Erro ao buscar tabela de espólio.");
      return;
    }

    // Roll the loot with the multiplier
    const rolledItems = rollLoot(lootTable, multiplier);
    
    // Fetch actual item data
    const itemIds = [...new Set(rolledItems.map(ri => ri.item_id))];
    let itemsWithData = [];
    if (itemIds.length > 0) {
      const { data: allItems } = await supabase.from('items').select('*').in('item_id', itemIds);
      itemsWithData = rolledItems.map(ri => {
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
          isBackpack: !!itemData?.isBackpack,
          cargaIncrease: itemData?.cargaIncrease || 10,
          carga: itemData?.carga || 1
        };
      });
    }

    const rollerName = user?.user_metadata?.full_name || user?.user_metadata?.preferred_username;
    console.log('Roller name:', rollerName);
    
    // Update the message content
    // Parts: 0:LOOT_INTERACTION, 1:location, 2:tier, 3:masterName, 4:masterAvatar, 5:diceExpr, 6:itemsJson, 7:rollResult, 8:rollerName
    const newParts = [...parts];
    newParts[6] = JSON.stringify(itemsWithData);
    newParts[7] = result.total.toString();
    newParts[8] = rollerName || "Anonymous";
    
    const newContent = newParts.join('|');
    console.log('Updating message in Supabase with new content:', newContent);
    const { error } = await supabase.from('messages').update({ content: newContent }).eq('id', msg.id);
    if (error) {
      console.error('Supabase update error:', error);
    } else {
      console.log('Supabase update successful');
    }
  };

  const sendLoot = async (lootTable) => {
    const masterChar = allPlayers.find(p => p.rank === 'Mestre');
    const avatar = masterChar?.image_url || "";
    const username = masterChar?.discord_username || ".enderu";
    
    const content = `LOOT_INTERACTION|${lootTable.name}|${lootTable.max_rolls}|${username}|${avatar}|${lootDicePlaceholder}|[]|0|none`;
    
    await supabase.from('messages').insert({
      player_name: "SISTEMA",
      content,
      is_system: true
    });
    
    setShowLootSelector(false);
  };

  const parseDiceExpr = (expr, char) => {
    if (!expr) return "1d20";
    const bLvl = char?.breathing_lvl || 0;
    const bLvlBonus = Math.max(0, bLvl - 1);
    const acerto = calculateAcerto(char);

    if (typeof expr === 'string') {
        return expr
          .replace('{acerto}', acerto)
          .replace('{acertoBonus2}', acerto + (bLvlBonus * 2))
          .replace('{acertoBonus8Plus3}', acerto + 8 + (bLvlBonus * 3))
          .replace('{15+bLvlBonus3}', 15 + (bLvlBonus * 3));
    }
    return expr;
  };

  const handleBreathingRoll = async (msgId) => {
    const msg = messages.find(m => m.id === msgId);
    if (!msg) return;

    const parts = msg.content.split('|');
    // BREATHING_MOVE|skillId|skillName|cost|diceExpr|effectDesc|rollResult|rollerName|targetId
    const skillId = parts[1];
    const diceExpr = parts[4];
    const userDice = breathingRollInputs[msgId] || diceExpr;
    
    const rollerChar = allPlayers?.find(p => p.id === user?.id);
    if (!rollerChar) return;

    // Perform the roll
    const result = rollDice(userDice, rollerChar);
    if (!result) return;

    // Update message content with result
    const newParts = [...parts];
    newParts[6] = result.total.toString();
    newParts[7] = rollerChar.char_name;
    
    const newContent = newParts.join('|');
    await supabase.from('messages').update({ content: newContent }).eq('id', msg.id);

    // --- BREATHING SKILL POST-ROLL EFFECTS ---
    const { BREATHING_TREES, EFFECTS } = require('../../constants/gameData');
    const tree = BREATHING_TREES[rollerChar.breathing_style];
    const skill = tree?.skills.find(s => s.id === skillId);

    if (skill?.logic?.postRoll) {
        await skill.logic.postRoll({ result, rollerChar, supabase, calculateDerivedStats, showToast, EFFECTS });
    }
  };

  const handleFocusDiceRoll = async (rollerChar, diceExpr) => {
    const result = rollDice(diceExpr, rollerChar);
    if (!result) return;

    const { maxFocus } = calculateDerivedStats(rollerChar);
    const currentFocusNow = rollerChar.current_focus || 0;
    const finalFocus = Math.min(maxFocus, (currentFocusNow + result.total));
    
    const table = rollerChar.is_npc ? 'npcs' : 'characters';
    const dbId = rollerChar.is_npc ? rollerChar.dbId : rollerChar.id;
    await supabase.from(table).update({ current_focus: finalFocus }).eq('id', dbId);
    
    await finishDiceRoll(result, diceExpr, rollerChar.char_name, rollerChar.image_url);
    showToast(`Ganhou ${result.total} de Foco!`);
    setShowDiceQuickMenu(false);
  };

  const sendBreathingMove = async (skill) => {
    let rollerChar = allPlayers?.find(p => p.id === user?.id);
    
    if (isActingAsMaster && selectedCombatantId) {
        const selected = combatants.find(p => p.id === selectedCombatantId);
        if (selected) rollerChar = selected;
    }

    if (!rollerChar) return;

    const cost = parseInt(skill.effect.match(/(\d+)\s*de\s*Foco/i)?.[1] || 0);
    if ((rollerChar.current_focus || 0) < cost) {
      showToast("Foco insuficiente!");
      return;
    }

    // Dice Expression and Target handling via new Logic system
    let diceExpr = "1d20";
    let needsTarget = false;

    if (skill.logic) {
      if (skill.logic.diceExpr) {
        diceExpr = parseDiceExpr(skill.logic.diceExpr, rollerChar);
      }
      needsTarget = !!skill.logic.needsTarget;
    }
    
    if (needsTarget) {
      const diceResult = rollDice(diceExpr, rollerChar);
      setTargetingRoll({ 
        input: diceExpr, 
        diceResult, 
        playerName: rollerChar.char_name || rollerChar.name, 
        playerImage: rollerChar.image_url,
        isBreathingMove: true,
        skillId: skill.id,
        skillName: skill.name,
        focusCost: cost,
        effectDesc: skill.effect
      });
    } else {
        // NON-TARGETED ACTIVATABLES (e.g. 2b)
        // Deduct Focus immediately
        const newFocus = rollerChar.current_focus - cost;
        const table = rollerChar.is_npc ? 'npcs' : 'characters';
        const dbId = rollerChar.is_npc ? rollerChar.dbId : rollerChar.id;
        await supabase.from(table).update({ current_focus: newFocus }).eq('id', dbId);

        // Send layout card
        await supabase.from('messages').insert({
          player_name: "SISTEMA",
          content: `BREATHING_MOVE|${skill.id}|${skill.name}|${cost}|${diceExpr}|${skill.effect}|0|${rollerChar.char_name || rollerChar.name}|none`,
          is_system: true
        });
    }
  };

  const handleUpdateDamageState = async (msg, newState) => {
    const parts = msg.content.split('|');
    // DICE_ROLL|pName|expr|total|detail|status|category|pImage|diceType|targetName|targetId|effectNote|weaponCategory|weaponSubtype|weaponDamageType|damageState
    // damageState is at index 15 (or 12 for backward compat with old messages).
    const damageStateIndex = parts.length > 15 ? 15 : 12;
    while (parts.length <= damageStateIndex) parts.push("{}");
    
    const currentState = JSON.parse(parts[damageStateIndex] || "{}");
    const updatedState = { ...currentState, ...newState };
    parts[damageStateIndex] = JSON.stringify(updatedState);
    
    const newContent = parts.join('|');
    await supabase.from('messages').update({ content: newContent }).eq('id', msg.id);

    // If finalizing, apply damage to target
    if (newState.finalized && updatedState.finalized) {
      const targetId = parts[10];
      if (!targetId) return;

      const target = combatants.find(c => c.id === targetId);
      if (!target) {
        console.error("Target not found in active combatants:", targetId);
        return;
      }

      const finalDmg = updatedState.editedFinal ?? updatedState.selectedFinal ?? 0;
      const postureDmg = updatedState.editedPosture ?? updatedState.selectedPosture ?? 0;

      const { life: maxLife, posture: maxPosture } = calculateDerivedStats(target);
      const currentLife = target.current_hp ?? maxLife;
      const currentPosture = target.current_posture ?? maxPosture;

      const newLife = Math.max(0, currentLife - finalDmg);
      const newPosture = Math.max(0, currentPosture - postureDmg);

      const table = target.is_npc ? 'npcs' : 'characters';
      const dbId = target.is_npc ? target.dbId : target.id;

      const { error } = await supabase.from(table).update({ 
        current_hp: newLife, 
        current_posture: newPosture 
      }).eq('id', dbId);
      
      if (error) {
        console.error("Error applying damage:", error);
        showToast("Erro ao aplicar dano no banco de dados.");
      } else {
        showToast(`Dano aplicado a ${target.char_name || target.name}! (HP: ${currentLife} -> ${newLife})`);
      }
    }
  };

  const handleDamageEditSubmit = async (msg, field) => {
    if (!damageInput.trim()) {
      setEditingDamage(null);
      return;
    }

    let finalValue;
    try {
      // Safe math evaluation
      let equation = damageInput.toLowerCase().replace(/random/g, () => Math.random().toString());
      if (/[^0-9+\-*/().\s|e]/.test(equation)) throw new Error("Invalid characters");
      finalValue = Math.round(new Function(`return ${equation}`)());
    } catch (e) {
      showToast("Equação inválida!");
      return;
    }

    if (isNaN(finalValue)) return;

    const newState = field === 'final' ? { editedFinal: finalValue } : { editedPosture: finalValue };
    await handleUpdateDamageState(msg, newState);
    setEditingDamage(null);
  };

  const groupMessages = (msgs) => {
    const groups = [];
    if (!msgs || msgs.length === 0) return groups;

    const sortedMsgs = [...msgs].sort((a, b) => {
      if (a.is_pinned && !b.is_pinned) return 1;
      if (!a.is_pinned && b.is_pinned) return -1;
      
      const dateA = a.updated_at ? new Date(a.updated_at) : new Date(a.created_at);
      const dateB = b.updated_at ? new Date(b.updated_at) : new Date(b.created_at);
  
      return dateA - dateB;
    });

    sortedMsgs.forEach((m) => {
      const lastGroup = groups[groups.length - 1];
      const mDate = new Date(m.created_at);
      
      if (lastGroup && lastGroup.player_name === m.player_name && !m.is_pinned && !lastGroup.messages.some(msg => msg.is_pinned)) {
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
        is_pinned: m.is_pinned,
        messages: [m]
      });
    });

    return groups;
  };

  const filteredMessages = messages.filter(m => !m.is_system || isMaster || m.content.startsWith('DICE_ROLL|') || m.content.startsWith('LOOT_INTERACTION|') || m.content.startsWith('BREATHING_MOVE|') || m.content.startsWith('SKILL_TREE_MOVE|') || m.content.startsWith('TRADER_INTERACTION|'));
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
    if (e) e.preventDefault();
    if (!input.trim() || isSending) return;

    setIsSending(true);
    try {
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
            setTargetingRoll({ input, diceResult, playerName, playerImage, charContext: playerChar });
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
    } catch (err) {
      console.error("Error sending message:", err);
      showToast("Erro ao enviar mensagem.");
    } finally {
      setIsSending(false);
    }
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
        setTargetingRoll({ input: fullInput, diceResult, playerName, playerImage, charContext: playerChar });
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

  const toggleGifPicker = () => {
    setShowGifPicker(!showGifPicker);
    setShowDiceQuickMenu(false);
    setShowSkillsMenu(false);
    setShowLootSelector(false);
    setShowTraderSelector(false);
    setShowTradeRequests(false);
  };

  const toggleDiceQuickMenu = () => {
    setShowDiceQuickMenu(!showDiceQuickMenu);
    setShowGifPicker(false);
    setShowSkillsMenu(false);
    setShowLootSelector(false);
    setShowTraderSelector(false);
    setShowTradeRequests(false);
  };

  const sendSkillTreeMove = async (skill) => {
    let rollerChar = allPlayers?.find(p => p.id === user?.id);
    
    if (isActingAsMaster && selectedCombatantId) {
        const selected = combatants.find(p => p.id === selectedCombatantId);
        if (selected) rollerChar = selected;
    }

    if (!rollerChar) return;

    // Determine if this skill needs a targeting roll (like breathing moves)
    let diceExpr = "1d20";
    let needsTarget = false;

    if (skill.logic) {
      if (skill.logic.diceExpr) {
        diceExpr = parseDiceExpr(skill.logic.diceExpr, rollerChar);
      }
      needsTarget = !!skill.logic.needsTarget;
    }

    if (needsTarget) {
      const diceResult = rollDice(diceExpr, rollerChar);
      setTargetingRoll({
        input: diceExpr,
        diceResult,
        playerName: rollerChar.char_name || rollerChar.name,
        playerImage: rollerChar.image_url,
        isSkillTreeMove: true,
        skillId: skill.id,
        skillName: skill.name,
        effectDesc: skill.effect
      });
    } else {
      // Non-targeted active skill — just send the roleplay message
      await supabase.from('messages').insert({
        player_name: "SISTEMA",
        content: `SKILL_TREE_MOVE|${skill.id}|${skill.name}|${skill.effect}|${rollerChar.char_name || rollerChar.name}`,
        is_system: true
      });
    }
  };

  const getActivatableSkillTreeSkills = () => {
    let rollerChar = allPlayers?.find(p => p.id === user?.id);
    if (isActingAsMaster && selectedCombatantId) {
      const selected = combatants.find(p => p.id === selectedCombatantId);
      if (selected) rollerChar = selected;
    }
    if (!rollerChar) return [];

    const { SKILL_TREES } = require('../../constants/gameData');
    const learnedSkills = Array.isArray(rollerChar.class_skills) ? rollerChar.class_skills : [];
    if (learnedSkills.length === 0) return [];

    const activatableSkills = [];
    Object.values(SKILL_TREES).forEach(tree => {
      tree.skills.forEach(skill => {
        if (learnedSkills.includes(skill.id) && skill.isActivatable) {
          activatableSkills.push(skill);
        }
      });
    });

    // Collect all skill IDs that should be hidden by other learned skills
    const blockedSkillIds = new Set();
    activatableSkills.forEach(skill => {
      if (Array.isArray(skill.blockedActivatable)) {
        skill.blockedActivatable.forEach(blockedId => {
          // Only block if the blocking skill is actually learned
          if (learnedSkills.includes(skill.id)) {
            blockedSkillIds.add(blockedId);
          }
        });
      }
    });

    // Filter out blocked skills
    return activatableSkills.filter(skill => !blockedSkillIds.has(skill.id));
  };


  const toggleSkillsMenu = () => {
    setShowSkillsMenu(!showSkillsMenu);
    setShowGifPicker(false);
    setShowDiceQuickMenu(false);
    setShowLootSelector(false);
    setShowTraderSelector(false);
    setShowTradeRequests(false);
    setSkillSearch("");
  };

  const toggleLootSelector = () => {
    setShowLootSelector(!showLootSelector);
    setShowGifPicker(false);
    setShowDiceQuickMenu(false);
    setShowSkillsMenu(false);
    setShowTraderSelector(false);
    setShowTradeRequests(false);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;

    setShowGifPicker(false);
    setShowDiceQuickMenu(false);
    setShowSkillsMenu(false);
    setShowLootSelector(false);

    setIsUploading(true);
    try {
      const { data: files, error: listError } = await supabase.storage.from('chat_images').list();
      if (listError) throw listError;
      
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
      const { data: uploadData, error: uploadError } = await supabase.storage.from('chat_images').upload(fileName, finalFile);
      if (uploadError) throw uploadError;
      
      const publicUrl = supabase.storage.from('chat_images').getPublicUrl(fileName).data.publicUrl;

      const playerChar = allPlayers?.find(p => p.id === user?.id);
      const playerName = playerChar?.char_name || user?.user_metadata?.full_name || user?.user_metadata?.preferred_username;
      const img = new Image();
      img.src = publicUrl;
      img.onload = async () => {
        console.log("Image loaded, inserting message...", publicUrl);
        const { error: msgError } = await supabase.from('messages').insert({
          player_name: playerName,
          content: `IMAGE|${publicUrl}|${img.width}|${img.height}`
        });
        if (msgError) {
          console.error("Message insert error:", msgError);
          showToast("Erro ao registrar imagem no chat: " + msgError.message);
        } else {
          console.log("Message inserted successfully");
        }
      };
      img.onerror = () => {
        showToast("Erro ao carregar a imagem após o upload.");
      };
    } catch (err) {
      showToast("Erro ao enviar imagem: " + err.message);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-zinc-950 relative h-full overflow-hidden">
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
      
      <div className={`shrink-0 bg-black/40 border-b border-white/5 relative ${targetingRoll ? 'z-[75]' : 'z-[60]'}`}>
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

        <div className={`px-8 overflow-hidden flex gap-4 overflow-x-auto no-scrollbar pt-2 ${hasMounted ? 'transition-[max-height,opacity] duration-300 ease-in-out' : ''} ${isCombatActive ? 'pb-8 opacity-100 max-h-[400px]' : 'pb-0 opacity-0 max-h-0 pointer-events-none'}`}>
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
                      const actorId = (isActingAsMaster ? selectedCombatantId : null) || user?.id;
                      if (enemy.id === actorId) return;

                      // Trigger selection via global event
                      const event = new CustomEvent('combatant-click', { detail: enemy });
                      window.dispatchEvent(event);
                    }
                  }}
                                      className={`flex-1 min-w-[280px] max-w-[320px] bg-zinc-900/50 border border-white/5 rounded-2xl p-4 flex gap-4 items-center group transition-all duration-500 hover:border-red-600 relative overflow-hidden ${targetingRoll ? 'cursor-crosshair ring-2 ring-red-600/50 animate-pulse' : 'hover:bg-zinc-900 hover:shadow-[0_0_20px_rgba(220,38,38,0.1)]'} ${!isActingAsMaster && !targetingRoll ? '' : ''}`}
                >
                  <div className={`absolute top-0 right-0 w-24 h-24 ${isActingAsMaster || targetingRoll ? 'bg-red-600/5 group-hover:bg-red-600/10' : 'bg-red-600/[0.02]'} blur-[40px] -z-10 transition-colors`} />
                  
                  {isActingAsMaster && !targetingRoll && (
                    <button
                      onClick={async (e) => { 
                        e.stopPropagation(); 
                        const newId = selectedCombatantId === enemy.id ? null : enemy.id;
                        setSelectedCombatantId(newId);
                        await supabase.from('global').update({ imitated_id: newId }).eq('id', 1);
                      }}
                      className={`absolute top-2 right-2 z-20 p-1 rounded-full border transition-all ${selectedCombatantId === enemy.id ? 'bg-green-500 border-green-400 text-white scale-110 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-black/40 border-white/10 text-white/20 hover:text-white/50'}`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                    </button>
                  )}

                  <div className="relative shrink-0">
                    {enemy.image_url ? (
                      <img src={enemy.image_url} className={`w-16 h-16 rounded-xl object-cover border border-white/10 shadow-xl ${isActingAsMaster || targetingRoll ? 'group-hover:scale-105' : ''} transition-transform`} alt="" />
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
                            {isActingAsMaster && (
                              <>
                                <span className="font-mono text-[10px] font-black text-red-500">{currentLife}</span>
                                <span className="font-mono text-[8px] font-black text-red-900/60">/{maxLife}</span>
                              </>
                            )}
                          </div>
                        )}

                        {isActingAsMaster && editingPosture === enemy.id ? (
                          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                            <input autoFocus value={postureInput} onChange={e => setPostureInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handlePostureSubmit(enemy, e.shiftKey); if (e.key === 'Escape') setEditingPosture(null); }} className="bg-zinc-800 border border-green-500/50 rounded px-1.5 py-0.5 text-white font-mono text-[10px] w-12 outline-none" />
                            <span className="font-mono text-[8px] font-black text-green-500/40">/{maxPosture}</span>
                          </div>
                        ) : (
                          <div onClick={e => { if (isActingAsMaster) { e.stopPropagation(); setEditingPosture(enemy.id); setPostureInput(currentPosture.toString()); } }} className={`flex items-baseline gap-1 ${isActingAsMaster ? 'cursor-pointer hover:bg-white/5 px-1 rounded' : ''}`}>
                            {isActingAsMaster && (
                              <>
                                <span className="font-mono text-[10px] font-black text-green-500">{currentPosture}</span>
                                <span className="font-mono text-[8px] font-black text-green-900/60">/{maxPosture}</span>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1 mb-1.5">
                      <div className="relative h-1.5 bg-black rounded-full overflow-hidden border border-white/5">
                        <div
                          className={`h-full transition-all duration-1000 ease-out ${hpPerc < 25 ? 'bg-gradient-to-r from-red-800 to-red-600 animate-pulse' : 'bg-gradient-to-r from-red-700 to-red-500'}`}
                          style={{ width: `${hpPerc}%` }}
                        />
                      </div>
                      <div className="relative h-1.5 bg-black rounded-full overflow-hidden border border-white/5">
                        <div
                          className={`h-full transition-all duration-1000 ease-out bg-gradient-to-r from-green-700 to-green-500`}
                          style={{ width: `${posturePerc}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex flex-wrap gap-1">
                        {Array.isArray(enemy.effects) && enemy.effects.slice(0, 4).map((eff, idx) => (
                          <TooltipWrapper key={idx} text={`**${eff.name}**\n${eff.description}`}>
                            <div className="flex items-center gap-1 bg-black/40 border border-red-900/30 pl-0.5 pr-1 py-0.5 rounded cursor-help hover:border-red-600/50 transition-colors relative group/eff">
                              <span className="text-[10px]">{eff.emoji}</span>
                              <span className="text-[8px] font-black uppercase tracking-tight text-red-500/80">{eff.name}</span>
                              <span className="text-[10px] font-black font-mono text-zinc-300 ml-0.5 border-l border-white/10 pl-1 leading-none">{eff.duration ?? '-'}</span>
                              {isActingAsMaster && (
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    const newEffects = enemy.effects.filter((_, i) => i !== idx);
                                    const { life: nML } = calculateDerivedStats({ ...enemy, effects: newEffects });
                                    const update = { effects: newEffects };
                                    if ((enemy.current_hp || nML) > nML) update.current_hp = nML;
                                    await supabase.from(enemy.is_npc ? 'npcs' : 'characters').update(update).eq('id', enemy.is_npc ? enemy.dbId : enemy.id);
                                  }}
                                  className="absolute -top-1 -right-1 bg-red-900/80 text-white/70 rounded p-0.5 opacity-0 group-hover/eff:opacity-100 transition-opacity"
                                >
                                  <svg width="6" height="6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><path d="M18 6L6 18M6 6l12 12"/></svg>
                                </button>
                              )}
                            </div>
                          </TooltipWrapper>
                        ))}
                        {isActingAsMaster && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setShowAddEffect(enemy.id); }}
                            className="flex items-center justify-center w-5 h-5 bg-zinc-950 border border-white/10 rounded hover:border-red-500/50 transition-colors text-zinc-500 hover:text-red-500"
                            title="Adicionar Efeito"
                          >
                            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><path d="M12 5v14M5 12h14"/></svg>
                          </button>
                        )}
                      </div>
                      <span className={`text-[7px] font-black text-zinc-600 uppercase tracking-widest italic ${isActingAsMaster || targetingRoll ? 'group-hover:text-red-500/50' : ''} transition-colors`}>Combatente</span>
                    </div>

                    <div className={`grid transition-all duration-500 ${isActingAsMaster ? 'grid-rows-[0fr] group-hover:grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                      <div className="overflow-hidden">
                        <div className="pt-2 mt-2 border-t border-white/5 flex flex-col gap-2">
                          {(() => {
                            if (enemy.type === 'Complex') {
                              const equippedWeapons = enemy.inventory?.filter(i => i.equipped && (i.category === "Arma de Fogo" || i.category === "Arma Branca")) || [];
                              const wStats1 = equippedWeapons.length > 0 ? calculateWeaponPAT(equippedWeapons[0], enemy) : null;
                              const wStats2 = equippedWeapons.length > 1 ? calculateWeaponPAT(equippedWeapons[1], enemy) : null;
                              const dStats = calculateDisarmedPAT(enemy);
                              
                              const formatBadge = (stats) => {
                                if (!stats) return "---";
                                const d = Math.floor(stats.dice);
                                const pVal = Math.floor(stats.plus);
                                const tpt = stats.tpt || 1;
                                return `${tpt}d${d}${pVal > 0 ? ` + ${pVal}` : ""}`;
                              };

                              const acertoValue = calculateAcerto(enemy);
                              const desvioValue = calculateDesvio(enemy);
                              const bloqueioValue = calculateBloqueio(enemy);

                              return (
                                <>
                                  <div className="flex gap-2">
                                    <div className="flex-1 bg-red-500/5 border border-red-500/10 rounded-lg py-1 flex flex-col items-center">
                                      <span className="text-[6px] font-black text-zinc-500 uppercase tracking-tighter truncate w-full text-center px-1" title={wStats1 ? equippedWeapons[0].name : "Ataque Armado"}>{wStats1 ? equippedWeapons[0].name : "Ataque Armado"}</span>
                                      <span className="text-[9px] font-black text-red-500 font-mono">{formatBadge(wStats1)}</span>
                                    </div>
                                    {wStats2 && (
                                      <div className="flex-1 bg-red-500/5 border border-red-500/10 rounded-lg py-1 flex flex-col items-center">
                                        <span className="text-[6px] font-black text-zinc-500 uppercase tracking-tighter truncate w-full text-center px-1" title={equippedWeapons[1].name}>{equippedWeapons[1].name}</span>
                                        <span className="text-[9px] font-black text-red-500 font-mono">{formatBadge(wStats2)}</span>
                                      </div>
                                    )}
                                    <div className="flex-1 bg-red-500/5 border border-red-500/10 rounded-lg py-1 flex flex-col items-center">
                                      <span className="text-[6px] font-black text-zinc-500 uppercase tracking-tighter">Desarmado</span>
                                      <span className="text-[9px] font-black text-red-500 font-mono">{formatBadge(dStats)}</span>
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
                              const w1Stats = enemy.weapon_type ? calculateWeaponPAT({
                                category: enemy.weapon_type,
                                subtype: enemy.weapon_subtype || (enemy.weapon_type === 'Arma de Fogo' ? 'Pistola' : 'Lâmina Curta'),
                                tier: 1,
                                upgrade: 0,
                                tpt: 1,
                                damage_multi: 1.0
                              }, enemy) : null;

                              const w2Stats = enemy.sec_weapon_type ? calculateWeaponPAT({
                                category: enemy.sec_weapon_type,
                                subtype: enemy.sec_weapon_subtype || (enemy.sec_weapon_type === 'Arma de Fogo' ? 'Pistola' : 'Lâmina Curta'),
                                tier: 1,
                                upgrade: 0,
                                tpt: 1,
                                damage_multi: 1.0
                              }, enemy) : null;

                              const dStats = calculateDisarmedPAT(enemy);

                              const formatBadge = (stats) => {
                                if (!stats) return "---";
                                const d = Math.floor(stats.dice);
                                const pVal = Math.floor(stats.plus);
                                const tpt = stats.tpt || 1;
                                return `${tpt}d${d}${pVal > 0 ? ` + ${pVal}` : ""}`;
                              };

                              let w1PAT = null;
                              if (enemy.armed_pat && enemy.armed_pat !== '0') {
                                w1PAT = enemy.armed_pat.toString().startsWith('1d') ? enemy.armed_pat : `1d${enemy.armed_pat}`;
                              } else if (w1Stats) {
                                w1PAT = formatBadge(w1Stats);
                              }

                              const acertoValue = calculateAcerto(enemy);
                              const desvioValue = calculateDesvio(enemy);
                              const bloqueioValue = calculateBloqueio(enemy);

                              return (
                                <>
                                  <div className="flex gap-2">
                                    <div className="flex-1 bg-red-500/5 border border-red-500/10 rounded-lg py-1 flex flex-col items-center">
                                      <span className="text-[6px] font-black text-zinc-500 uppercase tracking-tighter truncate w-full text-center px-1" title={enemy.weapon_subtype || enemy.weapon_type || "Ataque Armado"}>
                                        {enemy.weapon_subtype || enemy.weapon_type || "Ataque Armado"}
                                      </span>
                                      <span className="text-[9px] font-black text-red-500 font-mono">{w1PAT || "---"}</span>
                                    </div>
                                    {w2Stats && (
                                      <div className="flex-1 bg-red-500/5 border border-red-500/10 rounded-lg py-1 flex flex-col items-center">
                                        <span className="text-[6px] font-black text-zinc-500 uppercase tracking-tighter truncate w-full text-center px-1" title={enemy.sec_weapon_subtype || enemy.sec_weapon_type}>
                                          {enemy.sec_weapon_subtype || enemy.sec_weapon_type}
                                        </span>
                                        <span className="text-[9px] font-black text-red-500 font-mono">{formatBadge(w2Stats)}</span>
                                      </div>
                                    )}
                                    <div className="flex-1 bg-red-500/5 border border-red-500/10 rounded-lg py-1 flex flex-col items-center">
                                      <span className="text-[6px] font-black text-zinc-500 uppercase tracking-tighter">Desarmado</span>
                                      <span className="text-[9px] font-black text-red-500 font-mono">{formatBadge(dStats)}</span>
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

      <div ref={chatContainerRef} onScroll={handleScroll} className={`flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar relative ${targetingRoll ? 'blur-sm pointer-events-none select-none' : ''}`}>

        {groupedMessages.map((group, i) => {
          const sender = allPlayers.find(p => p.char_name === group.player_name || p.discord_username === group.player_name || p.discord_username === group.player_name?.replace(/^@/, '') || p.user_metadata?.full_name === group.player_name || p.user_metadata?.preferred_username === group.player_name) || allNPCs.find(n => n.name === group.player_name || n.npc_id === group.player_name);
          const avatar = sender?.image_url;

          return (
            <div key={group.id || i} data-message-group className="group animate-in fade-in slide-in-from-left-2 duration-300 flex flex-col gap-2">
              <div className="flex items-start gap-4">
                <div className="shrink-0 mt-1">
                  {avatar ? <img src={avatar} className="w-8 h-8 rounded-full object-cover border border-white/10" alt="" /> : <div className="w-11 h-11 rounded-full bg-zinc-800 border border-white/5 flex items-center justify-center text-[10px] opacity-40">{group.player_name === 'SISTEMA' ? '⚙️' : '👤'}</div>}
                </div>
                  <div className="flex-1 flex flex-col gap-1">
                    <div className="flex items-baseline gap-2">
                      <span className={`font-black italic uppercase text-[13px] tracking-tight shrink-0 ${group.player_name === 'SISTEMA' ? 'text-cyan-500' : 'text-red-600'}`}>{group.player_name}</span>
                      <span className="text-[10px] font-black text-zinc-500 uppercase font-mono">
                        {new Date(group.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        {group.is_pinned && <span className="text-yellow-500 ml-2">(Fixada)</span>}
                      </span>
                    </div>
                    <div className="flex flex-col gap-2 mt-1">
                      {group.messages.map((m, mi) => {
                        if (m.content.startsWith('SKILL_TREE_MOVE|')) {
                          const parts = m.content.split('|');
                          const skillId = parts[1];
                          const skillName = parts[2];
                          const effectDesc = parts[3];
                          // New format (targeted): SKILL_TREE_MOVE|id|name|effect|diceResult|rollerName|targetId
                          // Old format (non-targeted): SKILL_TREE_MOVE|id|name|effect|rollerName
                          const hasDiceResult = parts.length >= 6 && parts[5] && !['none', 'undefined'].includes(parts[4]);
                          const diceResult = hasDiceResult ? parts[4] : null;
                          const rollerName = hasDiceResult ? parts[5] : parts[4];
                          const targetId = hasDiceResult ? parts[6] : null;
                          return (
                            <div key={m.id || `${i}-${mi}`} className="bg-amber-950/20 border border-amber-500/30 rounded-2xl p-6 my-2 shadow-[0_0_30px_rgba(245,158,11,0.1)] relative overflow-hidden group/skilltree group/message">
                              {isMaster && (
                                <div className="absolute top-2 right-2 z-10 flex gap-1 opacity-0 group-hover/message:opacity-100 transition-opacity">
                                  <button onClick={() => handlePinMessage(m)} className="p-1.5 bg-zinc-900/50 text-white rounded-full hover:bg-yellow-500"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg></button>
                                  <button onClick={() => handleDeleteMessage(m.id)} className="p-1.5 bg-zinc-900/50 text-white rounded-full hover:bg-red-600"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
                                </div>
                              )}
                              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 blur-[50px] -z-10" />
                              
                              <div className="flex items-center gap-4 mb-4">
                                <div className="w-12 h-12 shrink-0 bg-amber-500/20 border border-amber-500/40 rounded-xl flex items-center justify-center shadow-xl">
                                  <span className="text-2xl">⚔️</span>
                                </div>
                                <div>
                                  <div className="bg-amber-500 text-black px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.2em] mb-1 skew-x-[-12deg] w-fit">HABILIDADE_ATIVA</div>
                                  <h4 className="text-amber-400 font-black italic uppercase text-lg tracking-tighter leading-none">{skillName}</h4>
                                </div>
                                {diceResult !== null && (
                                  <div className="ml-auto flex flex-col items-end">
                                    <span className="text-[10px] font-black text-amber-500/60 uppercase tracking-widest">Resultado</span>
                                    <span className="text-xl font-black text-amber-400 font-mono leading-none">{diceResult}</span>
                                  </div>
                                )}
                              </div>

                              <div className="bg-black/40 border border-white/5 rounded-xl p-4 mb-4">
                                <p className="text-zinc-300 text-xs leading-relaxed italic" dangerouslySetInnerHTML={{ __html: effectDesc.replace(/\*\*(.*?)\*\*/g, '<strong class="text-amber-400">$1</strong>') }} />
                              </div>

                              <div className="flex items-center gap-3">
                                <div className="h-[1px] flex-1 bg-gradient-to-r from-amber-500/50 to-transparent" />
                                <span className="text-[9px] font-black text-amber-500/60 uppercase tracking-[0.2em]">
                                  {diceResult !== null ? `Resultado: ${diceResult} • ` : ""}Usado por @{rollerName || group.player_name}
                                </span>
                              </div>
                            </div>
                          );
                        }
                        if (m.content.startsWith('BREATHING_MOVE|')) {
                          const [, skillId, skillName, cost, diceExpr, effectDesc, rollResult, rollerName, targetId] = m.content.split('|');
                          const { BREATHING_TREES } = require('../../constants/gameData');
                          const tree = BREATHING_TREES[sender?.breathing_style || 'Tempestade'];
                          const skill = tree?.skills.find(s => s.id === skillId);

                          return (
                            <div key={m.id || `${i}-${mi}`} className="bg-cyan-950/20 border border-cyan-500/30 rounded-2xl p-6 my-2 shadow-[0_0_30px_rgba(6,182,212,0.1)] relative overflow-hidden group/breathing group/message">
                              {isMaster && (
                                <div className="absolute top-2 right-2 z-10 flex gap-1 opacity-0 group-hover/message:opacity-100 transition-opacity">
                                  <button onClick={() => handlePinMessage(m)} className="p-1.5 bg-zinc-900/50 text-white rounded-full hover:bg-yellow-500"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg></button>
                                  <button onClick={() => handleDeleteMessage(m.id)} className="p-1.5 bg-zinc-900/50 text-white rounded-full hover:bg-red-600"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
                                </div>
                              )}
                              <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 blur-[50px] -z-10" />
                              
                              <div className="flex items-center gap-4 mb-4">
                                <div className="w-12 h-12 shrink-0 bg-cyan-500/20 border border-cyan-500/40 rounded-xl flex items-center justify-center shadow-xl overflow-hidden">
                                  <img src={`/breathing_styles/icon_breathing_${sender?.breathing_style?.toLowerCase() || 'tempestade'}.png`} alt="" className="w-full h-full object-cover" />
                                </div>
                                <div>
                                  <div className="bg-cyan-500 text-black px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.2em] mb-1 skew-x-[-12deg] w-fit">HABILIDADE_DE_RESPIRAÇÃO</div>
                                  <h4 className="text-cyan-400 font-black italic uppercase text-lg tracking-tighter leading-none">{skillName}</h4>
                                </div>
                                <div className="ml-auto flex flex-col items-end">
                                  <span className="text-[10px] font-black text-cyan-900 uppercase tracking-widest">Custo</span>
                                  <span className="text-xl font-black text-cyan-400 font-mono leading-none">{cost} <span className="text-[10px]">FOCO</span></span>
                                </div>
                              </div>

                              <div className="bg-black/40 border border-white/5 rounded-xl p-4 mb-4">
                                <p className="text-zinc-300 text-xs leading-relaxed italic" dangerouslySetInnerHTML={{ __html: effectDesc.replace(/\*\*(.*?)\*\*/g, '<strong class="text-cyan-400">$1</strong>') }} />
                              </div>

                              {skill?.logic?.diceExpr && rollResult === '0' && (
                                  <div className="flex flex-col items-center gap-4 py-4 bg-cyan-500/5 border border-cyan-500/10 rounded-2xl mb-4">
                                      <div className="w-full flex items-center justify-center gap-3 px-6">
                                          <input
                                              value={breathingRollInputs[m.id] || ""}
                                              onChange={(e) => setBreathingRollInputs(prev => ({ ...prev, [m.id]: e.target.value }))}
                                              onKeyDown={(e) => e.key === 'Enter' && handleBreathingRoll(m.id)}
                                              placeholder={diceExpr}
                                              className="bg-black/60 border border-cyan-500/20 rounded-xl px-4 py-2 text-center text-lg font-black text-cyan-400 outline-none focus:border-cyan-500/50 transition-all font-mono w-32"
                                          />
                                          <button
                                              onClick={() => handleBreathingRoll(m.id)}
                                              className="px-6 py-2 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-cyan-500 hover:text-black transition-all whitespace-nowrap"
                                          >
                                              Rolar para Ativar
                                          </button>
                                      </div>
                                  </div>
                              )}

                              <div className="flex items-center gap-3">
                                <div className="h-[1px] flex-1 bg-gradient-to-r from-cyan-500/50 to-transparent" />
                                <span className="text-[9px] font-black text-cyan-500/60 uppercase tracking-[0.2em]">
                                    {rollResult !== '0' ? `Resultado: ${rollResult} • ` : ""}Executado por @{rollerName || group.player_name}
                                </span>
                              </div>
                            </div>
                          );
                        }
                        if (m.content.startsWith('DICE_ROLL|')) {
                        const parts = m.content.split('|');
                        const [, pName, expr, total, detail, status, category = "normal", pImage = "", diceType = "", targetName = "", targetId = "", effectNote = "", weaponCategory = "", weaponSubtype = "", weaponDamageType = "", damageState = ""] = parts;
                        
                        const styles = {
                          combat: { bg: "bg-red-500/5", border: "border-red-500/20", accent: "text-red-500" },
                          secondary: { bg: "bg-blue-500/5", border: "border-blue-500/20", accent: "text-blue-400" },
                          luck: { bg: "bg-yellow-500/5", border: "border-yellow-500/20", accent: "text-yellow-500" },
                          breathing: { bg: "bg-cyan-500/5", border: "border-cyan-500/20", accent: "text-cyan-400" },
                          normal: { bg: "bg-zinc-900/80", border: "border-white/5", accent: "text-zinc-500" }
                        };
                        const style = styles[category] || styles.normal;
                        return (
                          <div key={m.id || `${i}-${mi}`} className={`${style.bg} border ${style.border} rounded-2xl p-6 my-2 shadow-2xl relative overflow-hidden group/dice relative group/message`}>
                            {isMaster && (
                              <div className="absolute top-2 right-2 z-10 flex gap-1 opacity-0 group-hover/message:opacity-100 transition-opacity">
                                <button
                                  onClick={() => handlePinMessage(m)}
                                  className="p-1.5 bg-zinc-900/50 text-white rounded-full hover:bg-yellow-500"
                                  title={m.is_pinned ? "Desafixar mensagem" : "Fixar mensagem"}
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                                </button>
                                <button
                                  onClick={() => handleDeleteMessage(m.id)}
                                  className="p-1.5 bg-zinc-900/50 text-white rounded-full hover:bg-red-600"
                                  title="Deletar mensagem"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                </button>
                              </div>
                            )}
                            <div className="flex justify-between items-start gap-6">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-4">
                                  <span className={`${style.accent} text-[10px] font-black uppercase tracking-widest`}>Tentativa de</span>
                                  <span className="text-white text-[11px] font-bold italic">{expr}</span>
                                  <div dangerouslySetInnerHTML={{ __html: status }} />
                                  {diceType && (
                                    <div className="ml-auto flex flex-col items-end gap-1">
                                      {parts[13] && (
                                        <span className="bg-red-900/40 text-red-200 text-[7px] font-black uppercase px-2 py-0.5 rounded border border-red-500/20 tracking-widest italic leading-none">
                                          {parts[13]}
                                        </span>
                                      )}
                                      <span className="bg-white/10 text-white text-[8px] font-black uppercase px-2 py-0.5 rounded border border-white/10 tracking-widest italic leading-none">
                                        {diceType}
                                      </span>
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-end gap-4">
                                  <div className="text-5xl font-black italic text-white/40 tracking-tighter drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]">{Number(total).toFixed(0)}</div>
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
                                
                                {(() => {
                                  const parts = m.content.split('|');
                                  const dStateIndex = parts.length > 15 ? 15 : 12;
                                  const dStateRaw = parts[dStateIndex] || "{}";
                                  let dState = {};
                                  try { dState = JSON.parse(dStateRaw); } catch(e) {}
                                  
                                  const targetId = parts[10];
                                  const target = combatants.find(c => c.id === targetId);
                                  let dmgValue = Number(total);

                                  // Passive Breathing Buffs (Generic)
                                  if (target && target.breathing_style) {
                                      const { BREATHING_TREES } = require('../../constants/gameData');
                                      const tree = BREATHING_TREES[target.breathing_style];
                                      const learnedSkills = Array.isArray(target.breathing_skills) ? target.breathing_skills : [];
                                      const bLvlBonus = Math.max(0, (target.breathing_lvl || 1) - 1);
                                      
                                      learnedSkills.forEach(skillId => {
                                          const skill = tree?.skills.find(s => s.id === skillId);
                                          if (skill?.logic?.passiveBuffs) {
                                              const buffs = skill.logic.passiveBuffs(target, bLvlBonus);
                                              if (buffs?.damageReduction) {
                                                  dmgValue *= (1 - buffs.damageReduction);
                                              }
                                          }
                                      });
                                  }

                                  // Global damageTaken modifier from effects
                                  if (target) {
                                      const targetEffects = Array.isArray(target.effects) ? target.effects : [];
                                      targetEffects.forEach(eff => {
                                          if (eff.modifiers?.damageTaken) {
                                              dmgValue *= eff.modifiers.damageTaken;
                                          }
                                      });
                                  }

                                  // Build weapon info from the DICE_ROLL message fields
                                  const msgWeaponInfo = { category: weaponCategory, subtype: weaponSubtype, damageType: weaponDamageType };

                                  // Attacker-side damage boosts (e.g. assaltante Obcecado Pela Pólvora)
                                  const attackerChar = combatants.find(c => c.name === pName || c.username === pName) || allPlayers.find(p => p.char_name === pName);
                                  if (attackerChar && attackerChar.class_skills) {
                                      const { SKILL_TREES } = require('../../constants/gameData');
                                      const aLearnedSkills = Array.isArray(attackerChar.class_skills) ? attackerChar.class_skills : [];
                                      Object.values(SKILL_TREES).forEach(tree => {
                                          tree.skills.forEach(skill => {
                                              if (aLearnedSkills.includes(skill.id) && skill.logic?.damage_boosts) {
                                                  skill.logic.damage_boosts.forEach(boost => {
                                                      if (evaluateCondition(boost.condition, { msgWeaponInfo, attackerChar })) {
                                                          dmgValue *= (1 + boost.amount);
                                                      }
                                                  });
                                              }
                                          });
                                      });
                                  }

                                  // Target-side final damage reduction/boost from class skills
                                  if (target && target.class_skills) {
                                      const { SKILL_TREES } = require('../../constants/gameData');
                                      const learnedSkills = Array.isArray(target.class_skills) ? target.class_skills : [];
                                      const attackerWeapon = msgWeaponInfo;
                                      Object.values(SKILL_TREES).forEach(tree => {
                                          tree.skills.forEach(skill => {
                                              if (learnedSkills.includes(skill.id) && skill.logic?.damage_received_boosts) {
                                                  skill.logic.damage_received_boosts.forEach(boost => {
                                                      if (evaluateCondition(boost.condition, { attackerWeapon, target })) {
                                                          dmgValue *= (1 + boost.amount);
                                                      }
                                                  });
                                              }
                                          });
                                      });
                                  }

                                  const dNormal = Math.round(dmgValue);
                                  const dLightlyBlocked = Math.round(dmgValue * 0.7);
                                  const dBlocked = Math.round(dmgValue * 0.5);

                                  let postureMultiplier = 1.0;

                                  // Attacker-side posture damage boosts (increases posture damage caused)
                                  if (attackerChar && attackerChar.class_skills) {
                                      const { SKILL_TREES } = require('../../constants/gameData');
                                      const learnedSkills = Array.isArray(attackerChar.class_skills) ? attackerChar.class_skills : [];
                                      const weapon = msgWeaponInfo;
                                      Object.values(SKILL_TREES).forEach(tree => {
                                          tree.skills.forEach(skill => {
                                              if (learnedSkills.includes(skill.id) && skill.logic?.posture_damage_boosts) {
                                                  skill.logic.posture_damage_boosts.forEach(boost => {
                                                      if (evaluateCondition(boost.condition, { weapon, attackerChar })) {
                                                          postureMultiplier += boost.amount;
                                                      }
                                                  });
                                              }
                                          });
                                      });
                                  }

                                  // Target-side posture damage received boosts (reduces/increases posture damage received)
                                  if (target && target.class_skills) {
                                      const { SKILL_TREES } = require('../../constants/gameData');
                                      const learnedSkills = Array.isArray(target.class_skills) ? target.class_skills : [];
                                      const attackerWeapon = msgWeaponInfo;
                                      Object.values(SKILL_TREES).forEach(tree => {
                                          tree.skills.forEach(skill => {
                                              if (learnedSkills.includes(skill.id) && skill.logic?.posture_damage_received_boosts) {
                                                  skill.logic.posture_damage_received_boosts.forEach(boost => {
                                                      if (evaluateCondition(boost.condition, { attackerWeapon, target })) {
                                                          postureMultiplier += boost.amount;
                                                      }
                                                  });
                                              }
                                          });
                                      });
                                  }

                                  const basePostureDamage = (dmgValue / 3) * Math.max(0, postureMultiplier);
                                  function roundPostureDamage(pDmg, roundingFunction) {
                                    return roundingFunction(Math.max(dmgValue / 5, pDmg));
                                  }
                                  const pLeve = roundPostureDamage(basePostureDamage, Math.floor);
                                  const pMedio = roundPostureDamage(basePostureDamage * 1.6, Math.round);
                                  const pPesado = roundPostureDamage(basePostureDamage * 2.5, Math.ceil);

                                  const isFinalized = dState.finalized;
                                  const showToPlayer = isFinalized || isActingAsMaster;

                                  return (
                                    <>
                                      {/* Dano Final Section */}
                                      <div className="flex flex-col items-center">
                                        <span className="text-[9px] font-black text-red-600/60 uppercase tracking-[0.4em] mb-3">Dano Final</span>
                                        <div className="relative flex flex-col items-center">
                                          {!showToPlayer ? (
                                            <span className="text-5xl font-black italic text-white/20 tracking-tighter drop-shadow-[0_0_25px_rgba(220,38,38,0.2)]">?</span>
                                          ) : isActingAsMaster && !isFinalized ? (
                                            dState.selectedFinal ? (
                                              editingDamage?.msgId === m.id && editingDamage?.field === 'final' ? (
                                                <div className="flex flex-col items-center gap-2">
                                                  <input
                                                    autoFocus
                                                    value={damageInput}
                                                    onChange={e => setDamageInput(e.target.value)}
                                                    onKeyDown={e => {
                                                      if (e.key === 'Enter') handleDamageEditSubmit(m, 'final');
                                                      if (e.key === 'Escape') setEditingDamage(null);
                                                    }}
                                                    className="bg-zinc-800 border border-red-500 rounded px-2 py-1 text-white font-black italic text-xl w-24 text-center outline-none"
                                                  />
                                                  <span className="text-[7px] text-zinc-500 uppercase font-black">Enter para salvar</span>
                                                </div>
                                              ) : (
                                                <div 
                                                  onClick={() => {
                                                    setEditingDamage({ msgId: m.id, field: 'final' });
                                                    setDamageInput((dState.editedFinal ?? dState.selectedFinal).toString());
                                                  }}
                                                  className="cursor-pointer group/dmg relative"
                                                >
                                                  <span className="text-5xl font-black italic text-white tracking-tighter drop-shadow-[0_0_25px_rgba(220,38,38,0.5)]">
                                                    {dState.editedFinal ?? dState.selectedFinal}
                                                  </span>
                                                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 opacity-0 group-hover/dmg:opacity-100 transition-opacity bg-red-600 text-white text-[7px] font-black px-1 rounded whitespace-nowrap">CLIQUE PARA EDITAR</div>
                                                </div>
                                              )
                                            ) : (
                                              <div className="flex gap-4">
                                                <button 
                                                  onClick={() => handleUpdateDamageState(m, { selectedFinal: dNormal })}
                                                  className="flex flex-col items-center group/btn"
                                                >
                                                  <span className="text-[7px] font-black text-zinc-600 uppercase tracking-widest mb-1 group-hover/btn:text-white transition-colors">Normal</span>
                                                  <span className="text-2xl font-black text-white/40 group-hover/btn:text-white transition-all font-mono">{dNormal}</span>
                                                </button>
                                                <button 
                                                  onClick={() => handleUpdateDamageState(m, { selectedFinal: dLightlyBlocked })}
                                                  className="flex flex-col items-center group/btn"
                                                >
                                                  <span className="text-[7px] font-black text-zinc-600 uppercase tracking-widest mb-1 group-hover/btn:text-white transition-colors">Levemente Bloqueado</span>
                                                  <span className="text-2xl font-black text-white/40 group-hover/btn:text-white transition-all font-mono">{dLightlyBlocked}</span>
                                                </button>
                                                <button 
                                                  onClick={() => handleUpdateDamageState(m, { selectedFinal: dBlocked })}
                                                  className="flex flex-col items-center group/btn"
                                                >
                                                  <span className="text-[7px] font-black text-zinc-600 uppercase tracking-widest mb-1 group-hover/btn:text-white transition-colors">Bloqueado</span>
                                                  <span className="text-2xl font-black text-white/40 group-hover/btn:text-white transition-all font-mono">{dBlocked}</span>
                                                </button>
                                              </div>
                                            )
                                          ) : (
                                            <span className="text-5xl font-black italic text-white tracking-tighter drop-shadow-[0_0_25px_rgba(220,38,38,0.5)]">
                                              {dState.editedFinal ?? dState.selectedFinal ?? "?"}
                                            </span>
                                          )}
                                          <div className="absolute -bottom-1 left-0 right-0 h-1 bg-red-600/20 blur-md rounded-full" />
                                        </div>
                                      </div>

                                      <div className="hidden md:block w-px h-16 bg-white/5" />

                                      {/* Dano de Postura Section */}
                                      <div className="flex flex-col items-center">
                                        <span className="text-[9px] font-black text-green-500/40 uppercase tracking-[0.4em] mb-4">Dano de Postura</span>
                                        {!showToPlayer ? (
                                          <span className="text-3xl font-black italic text-green-500/20 tracking-tighter drop-shadow-[0_0_15px_rgba(34,197,94,0.1)]">?</span>
                                        ) : isActingAsMaster && !isFinalized ? (
                                          dState.selectedPosture ? (
                                            editingDamage?.msgId === m.id && editingDamage?.field === 'posture' ? (
                                              <div className="flex flex-col items-center gap-2">
                                                <input
                                                  autoFocus
                                                  value={damageInput}
                                                  onChange={e => setDamageInput(e.target.value)}
                                                  onKeyDown={e => {
                                                    if (e.key === 'Enter') handleDamageEditSubmit(m, 'posture');
                                                    if (e.key === 'Escape') setEditingDamage(null);
                                                  }}
                                                  className="bg-zinc-800 border border-green-500 rounded px-2 py-1 text-white font-black italic text-xl w-24 text-center outline-none"
                                                />
                                                <span className="text-[7px] text-zinc-500 uppercase font-black">Enter para salvar</span>
                                              </div>
                                            ) : (
                                              <div 
                                                onClick={() => {
                                                  setEditingDamage({ msgId: m.id, field: 'posture' });
                                                  setDamageInput((dState.editedPosture ?? dState.selectedPosture).toString());
                                                }}
                                                className="cursor-pointer group/dmg relative"
                                              >
                                                <span className="text-4xl font-black italic text-green-500 tracking-tighter drop-shadow-[0_0_15px_rgba(34,197,94,0.3)]">
                                                  {dState.editedPosture ?? dState.selectedPosture}
                                                </span>
                                                <div className="absolute -top-4 left-1/2 -translate-x-1/2 opacity-0 group-hover/dmg:opacity-100 transition-opacity bg-green-600 text-white text-[7px] font-black px-1 rounded whitespace-nowrap">CLIQUE PARA EDITAR</div>
                                              </div>
                                            )
                                          ) : (
                                            <div className="grid grid-cols-3 gap-10">
                                              <button onClick={() => handleUpdateDamageState(m, { selectedPosture: pLeve })} className="flex flex-col items-center group/btn">
                                                <span className="text-[7px] font-black text-zinc-600 uppercase tracking-widest mb-1 group-hover/btn:text-white transition-colors">Leve</span>
                                                <span className="text-2xl font-black text-green-600/40 group-hover/btn:text-green-600/80 font-mono transition-all">{pLeve}</span>
                                              </button>
                                              <button onClick={() => handleUpdateDamageState(m, { selectedPosture: pMedio })} className="flex flex-col items-center group/btn">
                                                <span className="text-[7px] font-black text-zinc-600 uppercase tracking-widest mb-1 group-hover/btn:text-white transition-colors">Médio</span>
                                                <span className="text-2xl font-black text-green-500/40 group-hover/btn:text-green-500 font-mono transition-all">{pMedio}</span>
                                              </button>
                                              <button onClick={() => handleUpdateDamageState(m, { selectedPosture: pPesado })} className="flex flex-col items-center group/btn">
                                                <span className="text-[7px] font-black text-zinc-600 uppercase tracking-widest mb-1 group-hover/btn:text-white transition-colors">Pesado</span>
                                                <span className="text-2xl font-black text-green-400/40 group-hover/btn:text-green-400 font-mono transition-all">{pPesado}</span>
                                              </button>
                                            </div>
                                          )
                                        ) : (
                                          <div className="flex items-center">
                                            <span className="text-4xl font-black italic text-green-500 tracking-tighter drop-shadow-[0_0_15px_rgba(34,197,94,0.3)]">
                                              {dState.editedPosture ?? dState.selectedPosture ?? "?"}
                                            </span>
                                          </div>
                                        )}
                                      </div>

                                      {isActingAsMaster && dState.selectedFinal && dState.selectedPosture && !isFinalized && (
                                        <div className="absolute bottom-[-20px] left-1/2 -translate-x-1/2 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                          <button 
                                            onClick={() => handleUpdateDamageState(m, { finalized: true })}
                                            className="bg-red-600 hover:bg-red-500 text-white text-[10px] font-black uppercase tracking-[0.2em] px-8 py-2 rounded-full shadow-2xl border border-red-400/20 transition-all hover:scale-110 active:scale-95"
                                          >
                                            Finalizar
                                          </button>
                                        </div>
                                      )}
                                    </>
                                  );
                                })()}
                              </div>
                            )}
                          </div>
                        );
                      }
                      if (m.content.startsWith('LOOT_INTERACTION|')) {
                        const parts = m.content.split('|');
                        const location = parts[1] || "";
                        const tier = parts[2] || "";
                        const masterName = parts[3] || "";
                        const masterAvatar = parts[4] || "";
                        const diceExpr = parts[5] || "";
                        const itemsJson = parts[6] || "[]";
                        const rollResult = parts[7] || "0";
                        const rollerName = parts[8] || "none";

                        const lootItems = JSON.parse(itemsJson);
                        const isRolled = rollResult && rollResult !== "0";
                        const allCollected = lootItems.length > 0 && lootItems.every(item => item.qty === 0);

                        if (isRolled && lootItems.length === 0) {
                          return (
                            <div key={m.id || `${i}-${mi}`} className="bg-zinc-900/50 border border-white/5 rounded-2xl p-6 my-2 opacity-50 italic text-[10px] text-zinc-500 text-center uppercase tracking-widest">
                              O baú está vazio.
                            </div>
                          );
                        }

                        return (
                          <div key={m.id || `${i}-${mi}`} className={`bg-zinc-900 border ${allCollected ? 'border-white/5' : 'border-yellow-500/20'} rounded-2xl p-6 my-4 shadow-2xl relative overflow-hidden group/loot relative group/message`}>
                            {isMaster && (
                              <div className="absolute top-2 right-2 z-10 flex gap-1 opacity-0 group-hover/message:opacity-100 transition-opacity">
                                <button
                                  onClick={() => handlePinMessage(m)}
                                  className="p-1.5 bg-zinc-900/50 text-white rounded-full hover:bg-yellow-500"
                                  title={m.is_pinned ? "Desafixar mensagem" : "Fixar mensagem"}
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                                </button>
                                <button
                                  onClick={() => handleDeleteMessage(m.id)}
                                  className="p-1.5 bg-zinc-900/50 text-white rounded-full hover:bg-red-600"
                                  title="Deletar mensagem"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                </button>
                              </div>
                            )}
                            <div className={`absolute top-0 right-0 w-32 h-32 ${allCollected ? 'bg-white/5' : 'bg-yellow-500/5'} blur-[50px] -z-10`} />
                            
                            <div className="flex items-center gap-4 mb-6">
                              <div className={`w-12 h-12 shrink-0 ${allCollected ? 'bg-zinc-800/50 border-white/5' : 'bg-yellow-500/10 border-yellow-500/30'} border rounded-xl flex items-center justify-center shadow-xl`}>
                                <img src="/chest.png" alt="" className={`w-8 h-8 object-contain ${allCollected ? 'grayscale opacity-50' : 'animate-bounce'}`} />
                              </div>
                              <div>
                                <h4 className="text-white font-black italic uppercase text-sm tracking-tighter">
                                  {isActingAsMaster ? `Espólio Encontrado (${location})` : 'Espólio Encontrado'}
                                </h4>
                                  <div className="flex items-center gap-2">
                                    <span className={`text-[9px] font-black uppercase tracking-widest ${allCollected ? 'text-zinc-500' : 'text-yellow-500'}`}>{allCollected ? 'Já saqueado' : 'Saqueável'}</span>
                                    {isRolled && <span className="text-[10px] font-black text-yellow-500 ml-2 animate-in zoom-in duration-500">Resultado: {rollResult}</span>}
                                  </div>
                              </div>
                            </div>

                            {!isRolled ? (
                              <div className="flex flex-col items-center gap-4 py-8 bg-black/40 border border-white/5 rounded-2xl px-6">
                                <div className="w-16 h-16 relative">
                                  <img src="/dice.gif" alt="" className="w-full h-full object-contain opacity-50" />
                                </div>
                                <div className="w-full flex items-center gap-3">
                                  <input
                                    value={lootRollInputs[m.id] || ""}
                                    onChange={(e) => setLootRollInputs(prev => ({ ...prev, [m.id]: e.target.value }))}
                                    onKeyDown={(e) => e.key === 'Enter' && handleLootRoll(m.id)}
                                    placeholder={diceExpr}
                                    className="flex-1 bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-center text-lg font-black text-yellow-500 outline-none focus:border-yellow-500/50 transition-all font-mono"
                                  />
                                  <button
                                    onClick={() => handleLootRoll(m.id)}
                                    className="px-8 py-4 bg-yellow-500/10 border border-yellow-500/30 text-yellow-500 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-yellow-500 hover:text-black transition-all whitespace-nowrap"
                                  >
                                    Saquear
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-700">
                                {lootItems.map((item, idx) => (
                                  <div key={idx} className={`flex items-center justify-between p-3 bg-black/40 border border-white/5 rounded-xl transition-all group/item ${item.qty === 0 ? 'opacity-50 grayscale' : 'hover:border-yellow-500/30'}`}>
                                    <TooltipWrapper text={item.qty > 0 ? item.description : ""}>
                                      <div className={`flex flex-col flex-1 ${item.qty > 0 ? 'cursor-help' : ''}`}>
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs font-bold text-zinc-200">{item.name} <span className={`text-[10px] ml-1 ${item.qty === 0 ? 'text-zinc-500' : 'text-yellow-500'}`}>x{item.qty}</span></span>
                                          {item.qty > 0 && (
                                            <span className="text-[8px] bg-zinc-800/50 text-zinc-400 border border-white/5 px-1 rounded font-black uppercase tracking-tighter">
                                              {item.type}
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex gap-2 items-center mt-0.5">
                                          <span className={`text-[9px] font-black uppercase tracking-tighter ${RARITY_CONFIG[item.rarity]?.color || 'text-zinc-500'}`}>{item.rarity}</span>
                                          {item.qty > 0 && (
                                            <>
                                              <span className="text-[9px] font-black text-zinc-400 uppercase tracking-tighter">Val: {item.value}$</span>
                                              <span className="text-[9px] font-black text-orange-500/80 uppercase tracking-tighter">Cargas: {item.carga}</span>
                                            </>
                                          )}
                                        </div>
                                      </div>
                                    </TooltipWrapper>
                                    <div className="flex items-center gap-2 shrink-0 ml-4" onClick={(e) => e.stopPropagation()}>
                                      <button
                                        disabled={item.qty === 0}
                                        onClick={(e) => { e.stopPropagation(); handleDiscard(m.id, idx); }}
                                        className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${item.qty === 0 ? 'bg-zinc-800 text-zinc-500 border border-zinc-700 cursor-not-allowed' : 'bg-red-500/10 border border-red-500/30 text-red-500 hover:bg-red-500 hover:text-white'}`}
                                      >
                                        Descartar
                                      </button>
                                      <button
                                        disabled={item.qty === 0}
                                        onClick={(e) => { e.stopPropagation(); handlePickUp(m.id, idx); }}
                                        className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${item.qty === 0 ? 'bg-zinc-800 text-zinc-500 border border-zinc-700 cursor-not-allowed' : 'bg-yellow-500/10 border border-yellow-500/30 text-yellow-500 hover:bg-yellow-500 hover:text-black'}`}
                                      >
                                        Coletar
                                      </button>
                                    </div>
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
                      if (m.content.startsWith('TRADER_INTERACTION|')) {
                        const parts = m.content.split('|');
                        const traderId = parts[1];
                        const traderName = parts[2] || "Comerciante";
                        const masterName = parts[3] || "";
                        const masterAvatar = parts[4] || "";
                        
                        const trader = traders.find(t => t.id === traderId);
                        // console.log('Trader Object in Chat:', trader);
                        const npc = trader ? allNPCs.find(n => n.id === trader.npc_id) : null;
                        const avatarToUse = npc?.image_url || masterAvatar;
                        const activeTab = traderActiveTab[m.id] || 'comprar';
                        const playerChar = allPlayers.find(p => p.id === user?.id);

                        return (
                          <div key={m.id || `${i}-${mi}`} className={`bg-zinc-900 border border-green-500/20 rounded-2xl p-6 my-4 shadow-2xl relative overflow-hidden group/trader group/message`}>
                            {isMaster && (
                              <div className="absolute top-2 right-2 z-10 flex gap-1 opacity-0 group-hover/message:opacity-100 transition-opacity">
                                <button onClick={() => handlePinMessage(m)} className="p-1.5 bg-zinc-900/50 text-white rounded-full hover:bg-yellow-500"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg></button>
                                <button onClick={() => handleDeleteMessage(m.id)} className="p-1.5 bg-zinc-900/50 text-white rounded-full hover:bg-red-600"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
                              </div>
                            )}
                            <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/5 blur-[50px] -z-10" />
                            
                            <div className="flex items-center gap-4 mb-6">
                              <div className="w-12 h-12 shrink-0 bg-green-500/10 border border-green-500/30 rounded-xl flex items-center justify-center shadow-xl overflow-hidden">
                                {avatarToUse ? <img src={avatarToUse} className="w-full h-full object-cover" alt="" /> : <span className="text-2xl">🏪</span>}
                              </div>
                              <div>
                                <h4 className="text-white font-black italic uppercase text-sm tracking-tighter">
                                  {traderName}
                                </h4>
                                <div className="flex items-center gap-2">
                                  <span className="text-[9px] font-black uppercase tracking-widest text-green-500">Negociação Aberta</span>
                                  {trader?.dollars !== undefined && (
                                    <span className="text-[9px] font-black uppercase text-zinc-500 border-l border-white/10 pl-2">Saldo: <span className="text-green-500">${trader.dollars}</span></span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex gap-2 border-b border-white/10 pb-2 mb-4">
                              {['comprar', 'trade', 'vender'].map(tab => (
                                <button
                                  key={tab}
                                  onClick={() => setTraderActiveTab(prev => ({...prev, [m.id]: tab}))}
                                  className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${activeTab === tab ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'text-zinc-500 hover:text-white'}`}
                                >
                                  {tab}
                                </button>
                              ))}
                            </div>

                            {activeTab === 'comprar' && (
                              <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                                {!trader || !trader.items || trader.items.length === 0 ? (
                                  <p className="text-center text-[10px] font-black uppercase tracking-widest text-zinc-500 py-4">Estoque Vazio</p>
                                ) : (
                                  trader.items.map((ti, idx) => {
                                    const fullItem = itemsDB.find(i => i.id === ti.item_id || i.item_id === ti.item_id);
                                    if (!fullItem) return null;
                                    const tooltipText = `${fullItem.description || ''}\n\n**--INFORMAÇÕES--**\nTipo: **${fullItem.type || 'Item'}**${fullItem.category ? ` | ${fullItem.category}` : ''}${fullItem.subtype ? ` | ${fullItem.subtype}` : ''}\nRaridade: **${fullItem.rarity || 'Comum'}**\nValor Base: **${fullItem.value || 0}$**\nCarga: **${fullItem.carga || 1}**`;
                                    return (
                                      <div key={idx} className={`flex flex-col gap-2 p-3 bg-black/40 border border-white/5 rounded-xl transition-all ${ti.qty === 0 ? 'opacity-50 grayscale' : 'hover:border-green-500/30'}`}>
                                        <div className="flex justify-between items-start">
                                          <TooltipWrapper text={ti.qty > 0 ? tooltipText : ""}>
                                            <div className={`flex flex-col flex-1 ${ti.qty > 0 ? 'cursor-help' : ''}`}>
                                              <span className="text-xs font-bold text-zinc-200">{fullItem.name} <span className={`text-[12px] ml-1 ${ti.qty === 0 ? 'text-zinc-500' : 'text-green-500'}`}>x{ti.qty}</span></span>
                                              <span className="text-[11px] font-black text-zinc-500 uppercase tracking-tighter">Base: {fullItem.value}$</span>
                                            </div>
                                          </TooltipWrapper>
                                          <div className="flex flex-col items-end">
                                            <span className={`text-[10px] font-black uppercase ${ti.qty === 0 ? 'text-zinc-500' : 'text-green-500'}`}>${ti.price}</span>
                                            {(
                                              <button 
                                                onClick={() => handleBuyFromTrader(trader.id, ti)}
                                                disabled={ti.qty === 0}
                                                className={`mt-1 px-3 py-1 rounded text-[9px] font-black uppercase transition-all ${ti.qty === 0 ? 'bg-zinc-800 text-zinc-500 border-zinc-700 cursor-not-allowed' : 'bg-green-500/10 border border-green-500/30 text-green-500 hover:bg-green-500 hover:text-white'}`}
                                              >
                                                {ti.qty === 0 ? 'Esgotado' : 'Comprar'}
                                              </button>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            )}

                            {activeTab === 'trade' && (
                              <div className="py-8 text-center border border-dashed border-white/10 rounded-xl bg-black/20">
                                <span className="text-xl opacity-50 mb-2 block">⚖️</span>
                                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Em Desenvolvimento</p>
                              </div>
                            )}

                            {activeTab === 'vender' && (
                              <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                                {(
                                  !playerChar?.inventory || playerChar.inventory.length === 0 ? (
                                    <p className="text-center text-[10px] font-black uppercase tracking-widest text-zinc-500 py-4">Seu inventário está vazio</p>
                                  ) : (
                                    playerChar.inventory.map((invItem, idx) => {
                                      const isPending = pendingOffers.includes(invItem.id);
                                      const invTooltipText = `${invItem.description || ''}\n\n**--INFORMAÇÕES--**\nTipo: **${invItem.type || 'Item'}**${invItem.category ? ` | ${invItem.category}` : ''}${invItem.subtype ? ` | ${invItem.subtype}` : ''}\nRaridade: **${invItem.rarity || 'Comum'}**\nValor Base: **${invItem.value || 0}$**\nCarga: **${invItem.carga || 1}**`;
                                      return (
                                        <div key={idx} className="flex flex-col gap-2 p-3 bg-black/40 border border-white/5 rounded-xl hover:border-yellow-500/30 transition-all">
                                          <div className="flex justify-between items-center">
                                            <TooltipWrapper text={!isPending ? invTooltipText : ""}>
                                              <div className={`flex flex-col flex-1 ${!isPending ? 'cursor-help' : ''}`}>
                                                <span className="text-xs font-bold text-zinc-200">{invItem.name}</span>
                                                <span className="text-[9px] font-black text-zinc-500 uppercase tracking-tighter">Base: {invItem.value}$</span>
                                              </div>
                                            </TooltipWrapper>
                                            <div className="flex gap-2 items-center">
                                              <input
                                                type="number"
                                                placeholder="Preço..."
                                                value={sellPrices[`${m.id}-${invItem.id}`] || ''}
                                                onChange={(e) => setSellPrices(prev => ({ ...prev, [`${m.id}-${invItem.id}`]: e.target.value }))}
                                                disabled={isPending}
                                                className={`w-16 bg-black/60 border border-white/10 rounded px-2 py-1 text-[10px] text-white outline-none focus:border-yellow-500 disabled:opacity-50`}
                                              />
                                              <button
                                                onClick={() => handleSellToTrader(traderId, invItem, sellPrices[`${m.id}-${invItem.id}`])}
                                                disabled={isPending}
                                                className={`px-3 py-1 rounded text-[9px] font-black uppercase transition-all ${
                                                  isPending
                                                    ? 'bg-zinc-800 text-zinc-500 border-zinc-700 cursor-not-allowed'
                                                    : 'bg-yellow-500/10 border border-yellow-500/30 text-yellow-500 hover:bg-yellow-500 hover:text-black'
                                                }`}
                                              >
                                                {isPending ? 'Pendente' : 'Ofertar'}
                                              </button>
                                            </div>
                                          </div>
                                          {isPending && (
                                            <div className="flex justify-end">
                                              <span className="text-[7px] text-yellow-500/50 uppercase font-black tracking-widest animate-pulse">Aguardando Mestre...</span>
                                            </div>
                                          )}
                                        </div>
                                      )
                                    })
                                  )
                                )}
                              </div>
                            )}
                          </div>
                        );
                      }
                      if (m.content.startsWith('IMAGE|') || m.content.startsWith('GIF|')) {
                        const isImage = m.content.startsWith('IMAGE|');
                        const [, url, w, h] = m.content.split('|');
                        return (
                          <div key={m.id || `${i}-${mi}`} className={`my-2 overflow-hidden rounded-xl border border-white/5 shadow-2xl bg-zinc-900/50 ${isImage ? 'max-w-md' : 'max-w-[200px]'} relative group/message`} style={{ aspectRatio: w && h ? `${w}/${h}` : 'auto', width: isImage ? `min(${w || 400}px, 100%)` : '200px' }}>
                            {isMaster && (
                              <div className="absolute top-2 right-2 z-10 flex flex-col gap-1 opacity-0 group-hover/message:opacity-100 transition-opacity">
                                <button
                                  onClick={() => handlePinMessage(m)}
                                  className="p-1.5 bg-zinc-900/50 text-white rounded-full hover:bg-yellow-500"
                                  title={m.is_pinned ? "Desafixar mensagem" : "Fixar mensagem"}
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                                </button>
                                <button
                                  onClick={() => handleDeleteMessage(m.id)}
                                  className="p-1.5 bg-zinc-900/50 text-white rounded-full hover:bg-red-600"
                                  title="Deletar mensagem"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                </button>
                              </div>
                            )}
                            <img src={url} alt="" className="w-full h-full block object-cover" />
                          </div>
                        );
                      }
                      return (
                        <div key={m.id || `${i}-${mi}`} className="relative group/message">
                          {isMaster && (
                            <div className="absolute top-0 right-0 z-10 flex gap-1 opacity-0 group-hover/message:opacity-100 transition-opacity">
                              <button
                                onClick={() => handlePinMessage(m)}
                                className="p-1.5 bg-zinc-900/50 text-white rounded-full hover:bg-yellow-500"
                                title={m.is_pinned ? "Desafixar mensagem" : "Fixar mensagem"}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                              </button>
                              <button
                                onClick={() => handleDeleteMessage(m.id)}
                                className="p-1.5 bg-zinc-900/50 text-white rounded-full hover:bg-red-600"
                                title="Deletar mensagem"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                              </button>
                            </div>
                          )}
                          <p className={`text-sm leading-relaxed font-medium break-words whitespace-pre-wrap ${group.player_name === 'SISTEMA' ? 'text-cyan-400 italic font-bold' : 'text-zinc-300'}`} dangerouslySetInnerHTML={{ __html: m.content.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white bg-white/10 px-1.5 py-0.5 rounded">$1</strong>').replace(/\n/g, '<br/>') }} />
                        </div>
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

      <form onSubmit={sendMsg} className={`shrink-0 p-8 bg-black/60 border-t border-white/5 relative ${targetingRoll ? 'blur-sm pointer-events-none select-none' : ''}`}>
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
            {showTraderSelector && (
              <div className="absolute bottom-full right-0 mb-4 w-80 bg-zinc-900 border border-green-500/30 rounded-[20px] shadow-2xl z-50 backdrop-blur-md overflow-hidden flex flex-col p-4 animate-in slide-in-from-bottom-2 duration-200">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-[10px] font-black text-green-500 uppercase tracking-widest">Enviar Comerciante</h3>
                  <button onClick={() => setShowTraderSelector(false)} className="text-zinc-500 hover:text-white text-xl">×</button>
                </div>
                <div className="max-h-60 overflow-y-auto space-y-2 custom-scrollbar">
                  {traders.length === 0 ? (
                    <p className="text-[10px] text-zinc-500 text-center py-4 uppercase font-black tracking-widest">Nenhum comerciante</p>
                  ) : (
                    traders.map(t => (
                      <button
                        key={t.id}
                        onClick={() => sendTrader(t)}
                        className="w-full text-left p-3 rounded-xl bg-white/[0.02] hover:bg-green-500/10 border border-white/5 hover:border-green-500/30 transition-all group flex items-center gap-3"
                      >
                        <span className="text-xl">🏪</span>
                        <div>
                          <p className="text-[10px] font-black text-zinc-300 group-hover:text-green-500">{t.name}</p>
                          <p className="text-[8px] text-zinc-600 uppercase font-bold">{t.items?.length || 0} itens à venda</p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
            {showTradeRequests && isMaster && (
              <div className="absolute bottom-full right-0 mb-4 w-96 bg-zinc-900 border border-yellow-500/30 rounded-[20px] shadow-2xl z-50 backdrop-blur-md overflow-hidden flex flex-col p-4 animate-in slide-in-from-bottom-2 duration-200">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-[10px] font-black text-yellow-500 uppercase tracking-widest">Ofertas de Venda ({tradeRequests.length})</h3>
                  <button onClick={() => setShowTradeRequests(false)} className="text-zinc-500 hover:text-white text-xl">×</button>
                </div>
                <div className="max-h-80 overflow-y-auto space-y-2 custom-scrollbar">
                  {tradeRequests.length === 0 ? (
                    <p className="text-[10px] text-zinc-500 text-center py-4 uppercase font-black tracking-widest">Nenhuma oferta pendente</p>
                  ) : (
                    tradeRequests.map(req => {
                      const traderName = traders.find(t => t.id === req.trader_id)?.name || "Comerciante";
                      return (
                        <div key={req.id} className="p-3 bg-black/40 border border-white/5 rounded-xl flex flex-col gap-2">
                          <div className="flex justify-between items-start">
                            <div className="flex flex-col">
                              <span className="text-[10px] font-black text-zinc-300 uppercase">{req.characters?.char_name}</span>
                              <span className="text-[8px] font-black text-zinc-500 uppercase tracking-tighter">Para: {traderName}</span>
                            </div>
                            <span className="text-[12px] font-black text-yellow-500">${req.value}</span>
                          </div>
                          <div className="p-2 bg-zinc-800/50 rounded flex justify-between items-center">
                            <span className="text-[10px] font-bold text-zinc-300">{req.item.name}</span>
                            <span className="text-[8px] text-zinc-500">Base: ${req.item.value}</span>
                          </div>
                          <div className="flex gap-2 mt-1">
                            <button 
                              onClick={() => handleAcceptTradeRequest(req)}
                              className="flex-1 py-1.5 bg-green-500/10 border border-green-500/30 text-green-500 rounded text-[9px] font-black uppercase hover:bg-green-500 hover:text-white transition-all"
                            >
                              Aceitar
                            </button>
                            <button 
                              onClick={() => handleRejectTradeRequest(req)}
                              className="flex-1 py-1.5 bg-red-500/10 border border-red-500/30 text-red-500 rounded text-[9px] font-black uppercase hover:bg-red-500 hover:text-white transition-all"
                            >
                              Recusar
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
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
              <div className="absolute bottom-full right-0 mb-4 w-72 bg-zinc-900 border border-white/10 rounded-[20px] shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-50 backdrop-blur-md overflow-hidden flex flex-col p-4 animate-in slide-in-from-bottom-2 duration-200">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-[10px] font-black text-red-500 uppercase tracking-widest">Rolagem Rápida</h3>
                  <button onClick={() => setShowDiceQuickMenu(false)} className="text-zinc-500 hover:text-white text-xl">×</button>
                </div>
                <div className="space-y-4">
                  {(() => {
                      let rollerChar = allPlayers.find(p => p.id === user?.id);
                      if (isActingAsMaster && selectedCombatantId) {
                        const selected = combatants.find(p => p.id === selectedCombatantId);
                        if (selected) rollerChar = selected;
                      }

                      if (!rollerChar?.breathing_style) return null;
                      const { BREATHING_TREES } = require('../../constants/gameData');
                      const tree = BREATHING_TREES[rollerChar.breathing_style];
                      const learnedSkills = Array.isArray(rollerChar.breathing_skills) ? rollerChar.breathing_skills : [];
                      
                      const focusDiceSkill = tree?.skills.find(s => learnedSkills.includes(s.id) && s.logic?.isFocusDice);
                      
                      if (focusDiceSkill) {
                          const diceExpr = parseDiceExpr(focusDiceSkill.logic.diceExpr, rollerChar);
                          return (
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[8px] font-black text-cyan-500 uppercase tracking-tighter ml-1">Dado de Foco</label>
                                <div className="flex gap-2">
                                    <div className="flex-1 bg-black/40 border border-cyan-500/20 rounded-lg px-4 py-1.5 text-[10px] text-cyan-400 font-mono flex items-center justify-start">
                                        {diceExpr}
                                    </div>
                                    <button
                                        onClick={() => handleFocusDiceRoll(rollerChar, diceExpr)}
                                        className="px-6 py-2 bg-cyan-600/10 border border-cyan-500/30 text-cyan-400 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-cyan-600 hover:text-white transition-all shadow-[0_0_10px_rgba(6,182,212,0.2)]"
                                    >
                                        Rolar
                                    </button>
                                </div>
                            </div>
                          );
                      }
                      return null;
                  })()}
                  {[
                    { id: 'acerto', label: 'Dado de Acerto' },
                    { id: 'desvio', label: 'Dado de Desvio' },
                    { id: 'bloqueio', label: 'Dado de Bloqueio' }
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
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[8px] font-black text-red-500 uppercase tracking-tighter ml-1">Dado de Dano</label>
                    <div className="flex gap-2">
                      <div className="flex-1 bg-black/40 border border-red-600/20 rounded-lg px-4 py-1.5 text-[10px] text-red-500 font-mono flex items-center justify-start">
                        Variável
                      </div>
                      <button
                        onClick={() => handleQuickRoll('dano', '1d1')}
                        className="px-3 py-1.5 bg-red-600/10 border border-red-600/20 text-red-500 rounded-lg text-[10px] font-black uppercase tracking-tighter hover:bg-red-600 hover:text-white transition-all shadow-[0_0_10px_rgba(220,38,38,0.2)]"
                      >
                        Rolar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <input value={input} onChange={handleInputChange} onKeyDown={onKeyDown} placeholder="Interaja com o mundo..." disabled={!!targetingRoll} className="w-full bg-zinc-900 border border-white/10 rounded-2xl pl-8 pr-24 py-5 text-white text-sm outline-none focus:border-red-600 transition-all shadow-2xl disabled:opacity-50" />
            <div className="absolute right-3 top-1/2 -translate-y-[60%] flex items-center gap-1">
              {(() => {
                let rollerChar = allPlayers.find(p => p.id === user?.id);
                if (isActingAsMaster && selectedCombatantId) {
                  const selected = combatants.find(p => p.id === selectedCombatantId);
                  if (selected) rollerChar = selected;
                }

                const activeBreathing = rollerChar?.breathing_style;
                const learnedSkills = Array.isArray(rollerChar?.breathing_skills) ? rollerChar.breathing_skills : [];
                
                const hasSkillTreeSkills = getActivatableSkillTreeSkills().length > 0;
                if ((!activeBreathing || learnedSkills.length === 0) && !hasSkillTreeSkills) return null;

                const { BREATHING_TREES } = require('../../constants/gameData');
                const tree = BREATHING_TREES[activeBreathing];
                // Only skills that are activatable: have logic.needsTarget OR logic.diceExpr (but NOT isFocusDice which is the passive focus-gain roll)
                const activatableSkills = tree?.skills.filter(s => {
                  if (!learnedSkills.includes(s.id)) return false;
                  // Skip passive/non-activatable skills
                  if (s.logic?.isFocusDice) return false;
                  // Skip the root skill (skill_0) which is just the passive unlock
                  if (!s.logic || (!s.logic.needsTarget && !s.logic.diceExpr)) return false;
                  return true;
                }) || [];

                const hasBreathingSkills = activatableSkills.length > 0;
                if (!hasBreathingSkills && !hasSkillTreeSkills) return null;

                const iconPath = `/breathing_styles/icon_breathing_${activeBreathing.toLowerCase()}.png`;

                return (
                  <div className="relative flex items-center gap-1 mr-2 border-r border-white/10 pr-2">
                    {showSkillsMenu && (
                      <div className="absolute bottom-full right-0 mb-4 w-[500px] max-h-[70vh] bg-zinc-950 border-2 border-cyan-500/30 rounded-[20px] shadow-[0_20px_50px_rgba(0,0,0,0.8)] z-[100] backdrop-blur-xl flex flex-col animate-in slide-in-from-bottom-2 duration-300 overflow-hidden">
                        {/* Header */}
                        <div className="flex justify-between items-center p-6 pb-4 border-b border-white/5">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center overflow-hidden">
                              <img src={iconPath} className="w-full h-full object-cover" alt="" />
                            </div>
                            <div>
                              <h3 className="text-[11px] font-black text-cyan-400 uppercase tracking-[0.2em] leading-none mb-1">Habilidades de Combate</h3>
                              <p className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest">{activeBreathing}</p>
                            </div>
                          </div>
                          <button onClick={() => { setShowSkillsMenu(false); }} className="text-zinc-600 hover:text-white transition-colors text-2xl leading-none">×</button>
                        </div>

                        {/* Search Bar */}
                        <div className="px-6 py-3 border-b border-white/5">
                          <input
                            value={skillSearch}
                            onChange={(e) => setSkillSearch(e.target.value)}
                            placeholder="Buscar habilidade..."
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-xs text-white outline-none focus:border-cyan-500/50 transition-all placeholder:text-zinc-600"
                          />
                        </div>

                        {/* Scrollable Content */}
                        <div className="flex-1 overflow-y-auto p-6 pt-4 space-y-4 custom-scrollbar">

                          {/* Section: Breathing Style */}
                          {activatableSkills.length > 0 && (
                            <>
                              <div className="flex items-center gap-2 mb-2">
                                <div className="h-[1px] flex-1 bg-gradient-to-r from-cyan-500/30 to-transparent" />
                                <span className="text-[8px] font-black text-cyan-500/60 uppercase tracking-[0.3em]">Formas de Respiração</span>
                                <div className="h-[1px] flex-1 bg-gradient-to-l from-cyan-500/30 to-transparent" />
                              </div>
                              <div className="grid grid-cols-2 gap-3 pr-1">
                                {activatableSkills
                                  .filter(s => s.name.toLowerCase().includes(skillSearch.toLowerCase()))
                                  .map(skill => (
                                  <div key={skill.id} className="relative">
                                    <button
                                      onClick={() => { setHoveredSkill(null); sendBreathingMove(skill); setShowSkillsMenu(false); setSkillSearch(""); }}
                                      onMouseEnter={(e) => {
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        setHoveredSkill({ ...skill, type: 'breathing' });
                                        setTooltipPos({ top: rect.top, left: rect.left });
                                      }}
                                      onMouseLeave={() => setHoveredSkill(null)}
                                      className="w-full group/btn flex items-center gap-3 p-3 bg-white/[0.02] hover:bg-cyan-500/10 border border-white/5 hover:border-cyan-500/30 rounded-xl transition-all text-left relative overflow-hidden"
                                    >
                                      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent opacity-0 group-hover/btn:opacity-100 transition-opacity" />
                                      <div className="w-8 h-8 rounded-lg bg-black/40 border border-white/10 shrink-0 overflow-hidden relative z-10">
                                          <img src={iconPath} className="w-full h-full object-cover group-hover/btn:scale-110 transition-transform" alt="" />
                                      </div>
                                      <div className="flex-1 min-w-0 relative z-10">
                                        <p className="text-[10px] font-black text-zinc-200 group-hover/btn:text-cyan-400 uppercase tracking-tighter truncate leading-tight">{skill.name}</p>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                          <span className="text-[7px] font-black text-cyan-600 uppercase tracking-widest">Ativar</span>
                                          <div className="h-[1px] flex-1 bg-white/5" />
                                          {skill.effect.match(/(\d+)\s*de\s*Foco/i) && (
                                              <span className="text-[8px] font-black text-cyan-400/60 font-mono">{skill.effect.match(/(\d+)/)[0]} FOCO</span>
                                          )}
                                        </div>
                                      </div>
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </>
                          )}

                          {/* Section: Active Skills from Skill Tree */}
                          {(() => {
                            const skillTreeSkills = getActivatableSkillTreeSkills();
                            const filteredSkills = skillTreeSkills.filter(s => s.name.toLowerCase().includes(skillSearch.toLowerCase()));
                            if (skillTreeSkills.length === 0) return (
                              <div className="text-center py-4">
                                <p className="text-[10px] text-zinc-600 uppercase font-black tracking-widest">Nenhuma habilidade ativa encontrada</p>
                              </div>
                            );
                            return (
                              <>
                                <div className="flex items-center gap-2 mb-2">
                                  <div className="h-[1px] flex-1 bg-gradient-to-r from-amber-500/30 to-transparent" />
                                  <span className="text-[8px] font-black text-amber-500/60 uppercase tracking-[0.3em]">Habilidades Ativas</span>
                                  <div className="h-[1px] flex-1 bg-gradient-to-l from-amber-500/30 to-transparent" />
                                </div>
                                <div className="grid grid-cols-2 gap-3 pr-1">
                                  {filteredSkills.map(skill => (
                                    <div key={skill.id} className="relative">
                                      <button
                                        onClick={() => { setHoveredSkill(null); sendSkillTreeMove(skill); setShowSkillsMenu(false); setSkillSearch(""); }}
                                        onMouseEnter={(e) => {
                                          const rect = e.currentTarget.getBoundingClientRect();
                                          setHoveredSkill({ ...skill, type: 'active' });
                                          setTooltipPos({ top: rect.top, left: rect.left });
                                        }}
                                        onMouseLeave={() => setHoveredSkill(null)}
                                        className="w-full group/btn flex items-center gap-3 p-3 bg-white/[0.02] hover:bg-amber-500/10 border border-white/5 hover:border-amber-500/30 rounded-xl transition-all text-left relative overflow-hidden"
                                      >
                                        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent opacity-0 group-hover/btn:opacity-100 transition-opacity" />
                                        <div className="w-8 h-8 rounded-lg bg-black/40 border border-white/10 shrink-0 overflow-hidden relative z-10 flex items-center justify-center">
                                          <span className="text-sm">⚔️</span>
                                        </div>
                                        <div className="flex-1 min-w-0 relative z-10">
                                          <p className="text-[10px] font-black text-zinc-200 group-hover/btn:text-amber-400 uppercase tracking-tighter truncate leading-tight">{skill.name}</p>
                                          <div className="flex items-center gap-1.5 mt-0.5">
                                            <span className="text-[7px] font-black text-amber-600 uppercase tracking-widest">Usar</span>
                                            <div className="h-[1px] flex-1 bg-white/5" />
                                          </div>
                                        </div>
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </>
                            );
                          })()}

                        </div>
                      </div>
                    )}
                    
                    <button 
                      type="button" 
                      onClick={toggleSkillsMenu} 
                      className={`p-2 transition-all ${showSkillsMenu ? 'text-cyan-400 scale-110' : 'text-zinc-500 hover:text-cyan-400'}`} 
                      title="Habilidades de Combate"
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
                    </button>
                  </div>
                );
              })()}
              {isActingAsMaster && (
                <>
                  <button type="button" onClick={toggleTraderSelector} className={`p-2 transition-all ${showTraderSelector ? 'text-green-500 scale-110' : 'text-zinc-500 hover:text-white'}`} title="Enviar Comerciante">
                    <span className="text-xl">🏪</span>
                  </button>
                  <button type="button" onClick={toggleTradeRequests} className={`p-2 transition-all relative ${showTradeRequests ? 'text-yellow-500 scale-110' : 'text-zinc-500 hover:text-white'}`} title="Ofertas de Venda">
                    <span className="text-xl">💰</span>
                    {tradeRequests.length > 0 && (
                      <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-zinc-900 animate-pulse" />
                    )}
                  </button>
                  <button type="button" onClick={toggleLootSelector} className={`p-2 transition-all ${showLootSelector ? 'text-yellow-500 scale-110' : 'text-zinc-500 hover:text-white'}`} title="Enviar Espólio">
                    <span className="text-xl">📦</span>
                  </button>
                </>
              )}
              <button type="button" onClick={toggleDiceQuickMenu} className={`p-2 transition-all ${showDiceQuickMenu ? 'text-red-500 scale-110' : 'text-zinc-500 hover:text-white'}`} title="Rolagem Rápida">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="12" height="12" x="2" y="10" rx="2" ry="2"/><path d="m17.92 14 3.5-3.5a2.24 2.24 0 0 0 0-3l-5-5a2.24 2.24 0 0 0-3 0L10 6"/><path d="M6 14h.01"/><path d="M18 14h.01"/><path d="M15 6h.01"/><path d="M18 9h.01"/></svg>
              </button>
              <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
              <button type="button" disabled={isUploading} onClick={() => fileInputRef.current?.click()} className={`p-2 transition-all ${isUploading ? 'animate-pulse text-yellow-500' : 'text-zinc-500 hover:text-white'}`} title="Anexar Imagem"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg></button>
              <button type="button" onClick={toggleGifPicker} className={`p-2 transition-all ${showGifPicker ? 'text-red-500 scale-110' : 'text-zinc-500 hover:text-white'}`} title="Inserir GIF"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></button>
              <button type="submit" disabled={!input.trim() || isSending} className="p-2 text-zinc-500 hover:text-white disabled:opacity-30 transition-colors" title="Enviar mensagem"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg></button>
            </div>
          </div>
        </div>
      </form>

      {/* ADD EFFECT MODAL */}
      {isActingAsMaster && showAddEffect && typeof showAddEffect === 'string' && (
        <div className="absolute inset-0 z-[100] bg-zinc-950 flex flex-col border-l border-white/10 animate-in slide-in-from-right duration-300">
          <div className="p-4 border-b border-white/5 flex items-center justify-between">
            <h3 className="text-[10px] font-black text-white uppercase tracking-[0.4em] italic">Adicionar Efeito</h3>
            <button onClick={() => setShowAddEffect(null)} className="text-zinc-500 hover:text-white transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
          <div className="p-4 border-b border-white/5 space-y-2">
            <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Duração (Turnos)</label>
            <input
              type="number"
              value={effectDuration}
              onChange={(e) => setEffectDuration(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-red-500/50"
            />
          </div>
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-2">
            {(() => {
              const { EFFECTS } = require('../../constants/gameData');
              return Object.entries(EFFECTS).map(([key, eff]) => (
                <button
                  key={key}
                  onClick={() => {
                    const combatant = combatants.find(c => c.id === showAddEffect);
                    if (combatant) addEffect(combatant, key);
                  }}
                  className="w-full flex items-center gap-3 p-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl transition-all group"
                >
                  <div className="w-10 h-10 shrink-0 flex items-center justify-center bg-black/40 rounded-lg text-xl border border-white/10 group-hover:border-red-500/50 transition-colors leading-none">{eff.emoji}</div>
                  <div className="flex flex-col items-start min-w-0">
                    <span className="text-[10px] font-black text-white uppercase tracking-wider truncate w-full">{eff.name}</span>
                    <span className="text-[8px] text-zinc-500 font-medium line-clamp-2 leading-tight">{eff.description}</span>
                  </div>
                </button>
              ));
            })()}
          </div>
        </div>
      )}

      {/* TASK FLOW MANAGER - Master only */}
      <TaskFlowManager
        isActingAsMaster={isActingAsMaster}
        allPlayers={allPlayers}
        allNPCs={allNPCs}
        combatants={combatants}
        isCombatActive={isCombatActive}
        showToast={showToast}
      />

      {/* PORTAL TOOLTIP - Renders outside any overflow container */}
      {hoveredSkill && typeof document !== 'undefined' && createPortal(
        <div
          style={{
            position: 'fixed',
            top: tooltipPos.top,
            left: tooltipPos.left - 415,
            zIndex: 9999,
            pointerEvents: 'none'
          }}
          className={`w-[400px] p-5 bg-[#0a0a0a] border rounded-lg shadow-[0_0_50px_rgba(0,0,0,1)] animate-in fade-in zoom-in-95 duration-200 ${
            hoveredSkill.type === 'breathing' ? 'border-cyan-500/30' : 'border-amber-500/30'
          }`}
        >
          <div className={`absolute inset-0 rounded-lg opacity-10 ${
            hoveredSkill.type === 'breathing' ? 'bg-gradient-to-br from-cyan-500 via-purple-500' : 'bg-gradient-to-br from-amber-500 via-orange-500'
          }`}></div>
          
          <div className="relative z-[1000] flex flex-col gap-2">
            <div>
              <p className={`font-black uppercase text-[12px] leading-tight ${
                hoveredSkill.type === 'breathing' ? 'text-cyan-400' : 'text-amber-400'
              }`}>{hoveredSkill.name}</p>
              <p className="text-zinc-600 font-mono text-[9px] uppercase mt-0.5 tracking-tighter">ID: {hoveredSkill.id}</p>
            </div>
            <div className="flex flex-col gap-3">
              {hoveredSkill.flavor && <p className="text-zinc-500 text-[10px] italic leading-snug border-l border-zinc-800 pl-2">"{hoveredSkill.flavor}"</p>}
              <div className="text-zinc-300 text-[11px] leading-relaxed break-words whitespace-pre-wrap">
                {(() => {
                  let text = hoveredSkill.description || hoveredSkill.effect || "";
                  let colorClass = hoveredSkill.type === 'breathing' ? 'text-cyan-400' : 'text-amber-400';
                  let formatted = text.replace(/_/g, '\u00A0')
                                    .replace(/\n/g, '<br />')
                                    .replace(/\*\*(.*?)\*\*/g, `<strong class="${colorClass} font-black">$1</strong>`);
                  return <span dangerouslySetInnerHTML={{ __html: formatted }} />;
                })()}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}


