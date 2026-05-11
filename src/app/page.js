"use client";
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { MASTER_DISCORD_ID, ANOMALIAS_LIST, ANOMALIAS_DESCRIPTIONS, SKILLS_LIST, SKILLS_DESCRIPTIONS, RARITY_CONFIG } from '../constants/gameData';

import { calculateDerivedStats, getStatBuffs } from '../lib/rpg-math';

// Components
import Inventory from '../components/InventoryTemp';
import LootTableEditorModal from '../components/LootTableEditorModal';
import MasterPanel from '../components/MasterPanel';
import BioGrid from '../components/BioGrid';
import DicePanel from '../components/DicePanel';
import NPCEditor from '../components/NPCEditor';
import { Toast, Modal, TooltipWrapper, CustomSelect } from '../components/UIElements';
import Celebration from '../components/Celebration';
import CombatTab from '../components/CombatTab';
import { useSound } from '../hooks/useSound';
import MusicPlayer from '../components/MusicPlayer';
import NotificationSystem from '../components/NotificationSystem';
import ItemsListGeneratorModal from '../components/ItemsListGeneratorModal';
import ReportsTab from '../components/ReportsTab';
import InvestigationTab from '../components/InvestigationTab';
import BreathingTab from '../components/BreathingTab';
import TradersTab from '../components/TradersTab';

export default function Home() {
  // --- UI STATE ---
  const { playSound, volume, changeVolume, setUserInteracted } = useSound();
  const [activeTab, setActiveTab] = useState('home');
  const [lootTables, setLootTables] = useState([]);
  const [isLootModalOpen, setIsLootModalOpen] = useState(false);
  const [isListGeneratorOpen, setIsListGeneratorOpen] = useState(false);
  const [editingLootTable, setEditingLootTable] = useState(null);
  const [isViewingOnly, setIsViewingOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState([]);
  const [modal, setModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null, type: 'confirm', input: false, inputValue: '', fields: false });
  const [searchTerm, setSearchTerm] = useState('');
  const [showCelebration, setShowCelebration] = useState(false);
  const [secretCodeInput, setSecretCodeInput] = useState("");
  const [fakeDiscordUsernameInput, setFakeDiscordUsernameInput] = useState("");
  const [showCodeLogin, setShowCodeLogin] = useState(false);
  const [animationsEnabled, setAnimationsEnabled] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('animations_enabled');
    if (saved !== null) {
      setAnimationsEnabled(saved === 'true');
    }
  }, []);

  const toggleAnimations = () => {
    const newState = !animationsEnabled;
    setAnimationsEnabled(newState);
    localStorage.setItem('animations_enabled', newState.toString());
  };

  const SECRET_CODE = "SecretAccount";

  // --- DATA STATE ---
  const [user, setUser] = useState(null);
  const [character, setCharacter] = useState(null);
  const [tempChar, setTempChar] = useState(null);
  const [allPlayers, setAllPlayers] = useState([]);
  const [allNPCs, setAllNPCs] = useState([]);
  const [requests, setRequests] = useState([]);
  const [pendingRequest, setPendingRequest] = useState(null);
  const pendingRequestRef = useRef(null);

  useEffect(() => {
    pendingRequestRef.current = pendingRequest;
  }, [pendingRequest]);

  const [viewingTarget, setViewingTarget] = useState(null);

  // --- PERMISSIONS ---
  const [isEditing, setIsEditing] = useState(false);
  const [previewAsPlayer, setPreviewAsPlayer] = useState(false);
  const [itemLibrary, setItemLibrary] = useState([]);
  const [allTraders, setAllTraders] = useState([]);
  const [tradeRequests, setTradeRequests] = useState([]);

  const [isCombatActive, setIsCombatActive] = useState(false);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [messages, setMessages] = useState([]);
  const [turn, setTurn] = useState(1);
  const [sharedImage, setSharedImage] = useState({ url: null, title: null, contrast: false });
  const [chatInput, setChatInput] = useState("");
  const [quickDiceInputs, setQuickDiceInputs] = useState({
    acerto: "",
    desvio: "",
    bloqueio: "",
    dano: ""
  });

  const [now, setNow] = useState(Date.now());
  const [globalLockUntil, setGlobalLockUntil] = useState(0);
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);
  const [allowedDiscordUsernames, setAllowedDiscordUsernames] = useState([]);
  const [blockedTabs, setBlockedTabs] = useState([]);

  const isMaster = user?.user_metadata?.sub === MASTER_DISCORD_ID;
  const isActingAsMaster = isMaster && !previewAsPlayer;
  
  // Maintenance check
  const currentDiscordUsername = user?.user_metadata?.full_name || user?.user_metadata?.preferred_username;
  const isUserAllowed = isMaster || (allowedDiscordUsernames || []).includes(currentDiscordUsername);
  const showMaintenance = isMaintenanceMode && !isUserAllowed;
  const isViewingOthers = viewingTarget && viewingTarget !== user?.id;
  const activeChar = (isEditing && !isViewingOnly) ? tempChar : character;
  const isNPC = activeChar && allNPCs.some(n => n.id === activeChar.id);
  const activeRequest = (requests || []).find(r => r.player_id === (viewingTarget || user?.id) && r.status === 'pending') || (viewingTarget === null && pendingRequest ? pendingRequest : null);

  // --- MATH HELPERS ---
  const derivedStats = calculateDerivedStats(activeChar) || {};
  const {
    presence = 0,
    life = 0,
    posture = 0,
    maxFocus = 0,
    currentFocus = 0,
    luckPerc = 0,
    charismaPerc = 0,
    intelligencePerc = 0,
    strengthPerc = 0,
    resistancePerc = 0,
    aptitudePerc = 0,
    agilityPerc = 0,
    precisionPerc = 0
  } = derivedStats;

  const getPerc = (val) => presence > 0 ? ((Number(val) / presence) * 100).toFixed(1) : "0.0";

  const playSoundEffect = useCallback((soundName) => {
    playSound(soundName);
  }, [playSound]);

  useEffect(() => {
    if (character?.needs_celebration) {
      console.log("CELEBRATION TRIGGERED for character:", character.id);
      playSoundEffect('celebration');
      setShowCelebration(true);
      showToast("Ficha Aprovada!");
      
      // Update character immediately in state to clear the flag
      // This prevents the sound from re-playing on re-renders (like tab changes)
      setCharacter(prev => ({ ...prev, needs_celebration: false }));

      // Also update in DB so it doesn't trigger again on next reload
      // CRITICAL: We wait for the DB to confirm the update before considering it "handled"
      // to avoid race conditions where a refresh might see the old 'true' value.
      const clearCelebration = async () => {
        console.log("CLEARING needs_celebration in DB...");
        const { error } = await supabase.from('characters')
          .update({ needs_celebration: false })
          .eq('id', character.id);
        
        if (error) {
          console.error("Failed to clear celebration flag in DB:", error);
        } else {
          console.log("Celebration flag cleared in DB successfully.");
        }
      };
      
      clearCelebration();

      setTimeout(() => {
        setShowCelebration(false);
      }, 5000);
    }
  }, [character?.needs_celebration, character?.id, playSoundEffect]);

  // Fog persistent animation logic
  const FOG_DURATION = 34000; // Updated to 34s
  const fogRef = useRef(null);
  const activeTabRef = useRef(activeTab);
  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'home' && fogRef.current) {
      const startTime = localStorage.getItem('fog_start_time');
      const now = Date.now();

      if (startTime) {
        const elapsed = (now - parseInt(startTime)) % FOG_DURATION;
        const delay = -elapsed;
        fogRef.current.style.animationDelay = `${delay}ms`;
      } else {
        localStorage.setItem('fog_start_time', now.toString());
      }
    }
  }, [activeTab]);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // --- DATA FETCH & REALTIME ---
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

      const { data: lootData } = await supabase.from('loot_tables').select('*').order('name', { ascending: true });
      setLootTables(lootData || []);

      let activeUser;
      const savedFakeUser = localStorage.getItem('fake_discord_user');
      if (savedFakeUser) {
        activeUser = JSON.parse(savedFakeUser);
      } else {
        const { data: { user: supabaseUser } } = await supabase.auth.getUser();
        activeUser = supabaseUser;
      }

      setUser(activeUser);

      if (activeUser && !isActingAsMaster) {
        const { data: pendingReq } = await supabase
          .from('change_requests')
          .select('*')
          .eq('player_id', activeUser.id)
          .eq('status', 'pending')
          .maybeSingle();
        setPendingRequest(pendingReq);
      }

      // Fetch all players FIRST so we can use it for character/tempChar
      const { data: players } = await supabase.from('characters').select('*').order('char_name', { ascending: true });
      setAllPlayers(players || []);

      const { data: npcsData } = await supabase.from('npcs').select('*').order('name', { ascending: true });
      setAllNPCs(npcsData || []);

      if (activeUser) {
        const tId = viewingTarget || activeUser.id;
        // Check if the user is in the 'players' we just fetched OR check DB directly
        const char = (players || []).find(p => p.id === tId);

        if (char) {
          setCharacter(char);
          if (!isEditing) setTempChar(char);
          
          // KICK OUT LOGIC: If viewing 'breathing' tab but style is removed
          if (activeTab === 'breathing' && !char.breathing_style) {
            setActiveTab('sheet');
          }
        } else {
          // Double check DB to avoid race conditions with auth event vs fetch
          const { data: dbChar } = await supabase.from('characters').select('*').eq('id', tId).maybeSingle();
          if (dbChar) {
            setCharacter(dbChar);
            if (!isEditing) setTempChar(dbChar);
          } else if (tId === activeUser.id) {
            // AUTO-CREATE CHARACTER IF MISSING
            const newChar = {
              id: activeUser.id,
              discord_username: activeUser.user_metadata?.full_name || activeUser.user_metadata?.preferred_username || "Explorador",
              char_name: "Novo Recruta",
              age: 18,
              strength: 3,
              resistance: 3,
              aptitude: 3,
              agility: 3,
              precision: 3,
              concentration: 3,
              intelligence: 3,
              luck: 3,
              charisma: 3,
              stat_points_available: 0,
              dollars: 0,
              inventory: [],
              rank: 'E - Recruta',
              current_hp: 24 // (3 strength + 3 resistance * 7) = 24
            };

            // Use UPSERT instead of INSERT to handle potential 409 Conflict
            const { data: createdChar, error: createError } = await supabase
              .from('characters')
              .upsert(newChar, { onConflict: 'id' })
              .select()
              .single();

            if (!createError && createdChar) {
              setCharacter(createdChar);
              if (!isEditing) setTempChar(createdChar);
              setAllPlayers(prev => {
                const filtered = prev.filter(p => p.id !== createdChar.id);
                return [...filtered, createdChar].sort((a, b) => (a.char_name || "").localeCompare(b.char_name || ""));
              });
              showToast("Nova ficha criada automaticamente!");
            }
          }
        }
      }

      // Initial Global Game State
      const { data: globalData, error: globalError } = await supabase.from('global').select('*').eq('id', 1).maybeSingle();
      console.log("INITIAL GLOBAL FETCH (FULL):", { globalData, globalError });
      setIsSessionActive(!!globalData?.is_session_active);
      setIsCombatActive(!!globalData?.is_combat_active);
      setIsMaintenanceMode(!!globalData?.is_maintenance_active);
      setAllowedDiscordUsernames(globalData?.allowed_discord_usernames || []);
      setBlockedTabs(globalData?.blocked_tabs || []);
      if (globalData?.current_turn !== undefined) setTurn(globalData.current_turn);
      setSharedImage({
        url: globalData?.image_url || globalData?.imag_url || null,
        title: globalData?.image_title || null,
        contrast: !!globalData?.image_contrast
      });

      // Fetch last 50 messages
      const { data: msgData } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (msgData) {
        // Ensure chronological order
        const sorted = [...msgData].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        setMessages(sorted);
      }

      if (isMaster) {
        const { data: reqData } = await supabase
          .from('change_requests')
          .select('*')
          .eq('status', 'pending');
        setRequests(reqData || []);
      }

      setLoading(false);
    };
    fetchData();

    // AUTH LISTENER for persistent session handling
    const { data: { subscription: authListener } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("AUTH EVENT:", event);
      if (event === 'SIGNED_IN') {
        setUser(session?.user ?? null);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setCharacter(null);
        setTempChar(null);
      }
    });

    // UNIFIED REALTIME CHANNEL
    const mainChannel = supabase.channel('game_state')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'characters' }, (p) => {
        // 1. Sync My Character Data
        const characterData = p.new || p.old;
        if (characterData && characterData.id === (viewingTarget || user?.id)) {
          if (p.eventType === 'DELETE') {
            // Handle character deletion if necessary
          } else {
            // Always update the 'character' state to reflect the latest from DB
            setCharacter(prev => JSON.stringify(prev) === JSON.stringify(p.new) ? prev : p.new);

            // KICK OUT LOGIC: Real-time update
            if (activeTab === 'breathing' && !p.new.breathing_style) {
              setActiveTab('sheet');
              showToast("Você não possui mais um estilo de respiração.");
              playSoundEffect('error');
            }

            // Update 'tempChar' only if we are NOT in editing mode AND there is NO pending request
            // This ensures tempChar holds the latest approved character data when not actively editing or proposing changes.
            if (!isEditing && !pendingRequest) {
              setTempChar(p.new);
            }
          }
        }

        // 2. Sync "Lista de Caçadores" and "Combatants"
        if (p.eventType === 'INSERT') {
          setAllPlayers(prev => [...prev, p.new].sort((a, b) => (a.char_name || "").localeCompare(b.char_name || "")));
        } else if (p.eventType === 'UPDATE') {
          setAllPlayers(prev => prev.map(pl => pl.id === p.new.id ? p.new : pl));
        } else if (p.eventType === 'DELETE') {
          setAllPlayers(prev => prev.filter(pl => pl.id !== p.old.id));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'npcs' }, (p) => {
        if (p.eventType === 'INSERT') {
          setAllNPCs(prev => [...prev, p.new].sort((a, b) => (a.name || "").localeCompare(b.name || "")));
        } else if (p.eventType === 'UPDATE') {
          setAllNPCs(prev => prev.map(n => n.id === p.new.id ? p.new : n));
        } else if (p.eventType === 'DELETE') {
          setAllNPCs(prev => prev.filter(n => n.id !== p.old.id));
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'global' }, (p) => {
        console.log("REALTIME GLOBAL UPDATE RECEIVED:", p.new);

        // Handle Session Activation
        if (p.new.is_session_active !== undefined) {
          const nowActive = !!p.new.is_session_active;
          setIsSessionActive(prev => {
            if (!prev && nowActive) {
              setMessages([]); // Clear messages only when switching from inactive to active
            }
            return nowActive;
          });
        }

        // Handle Combat State
        if (p.new.is_combat_active !== undefined) {
          setIsCombatActive(p.new.is_combat_active);
        }

        // Handle Maintenance Mode
        if (p.new.is_maintenance_active !== undefined) {
          setIsMaintenanceMode(p.new.is_maintenance_active);
        }

        // Handle Allowed Usernames
        if (p.new.allowed_discord_usernames !== undefined) {
          setAllowedDiscordUsernames(p.new.allowed_discord_usernames || []);
        }

        // Handle Blocked Tabs
        if (p.new.blocked_tabs !== undefined) {
          const newBlocked = p.new.blocked_tabs || [];
          setBlockedTabs(newBlocked);
          
          // KICK OUT LOGIC: If current tab just got blocked
          if (!isMaster && newBlocked.includes(activeTabRef.current)) {
            setActiveTab('home');
            showToast("Esta página foi bloqueada pelo Mestre.");
            playSoundEffect('error');
          }
        }

        // Handle Turn
        if (p.new.current_turn !== undefined) {
          setTurn(p.new.current_turn);
        }

        // Handle Shared Image (Partial updates)
        const newUrl = p.new.image_url !== undefined ? p.new.image_url : p.new.imag_url;
        // Check for null explicitly since that's what happens when hiding
        if (newUrl !== undefined || p.new.image_title !== undefined || p.new.image_contrast !== undefined) {
          console.log("REALTIME IMAGE UPDATE:", { url: newUrl, title: p.new.image_title, contrast: p.new.image_contrast });
          setSharedImage(prev => ({
            url: newUrl !== undefined ? newUrl : prev.url,
            title: p.new.image_title !== undefined ? p.new.image_title : prev.title,
            contrast: p.new.image_contrast !== undefined ? !!p.new.image_contrast : prev.contrast
          }));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (p) => {
        if (p.eventType === 'INSERT') {
          setMessages(prev => {
            if (prev.some(m => m.id === p.new.id)) return prev;
            const newList = [...prev, p.new].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
            if (newList.length > 50) return newList.slice(-50);
            return newList;
          });
        } else if (p.eventType === 'UPDATE') {
          setMessages(prev => prev.map(m => m.id === p.new.id ? p.new : m));
        } else if (p.eventType === 'DELETE') {
          setMessages(prev => {
            if (!p.old || Object.keys(p.old).length === 0) return [];
            return prev.filter(m => m.id !== p.old.id);
          });
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'change_requests' }, (p) => {
        console.log("REALTIME CHANGE REQUEST EVENT (RAW):", p.eventType, p);
        
        // Handle current player's pendingRequest
        const relevantPlayerId = p.new?.player_id || p.old?.player_id;
        if (relevantPlayerId === (user?.id || '')) {
            if (p.eventType === 'DELETE') {
                console.log("MATCHED USER DELETE - current pendingRequestRef:", pendingRequestRef.current);
                setPendingRequest(null);
            } else if (p.new && p.new.status === 'pending') {
                setPendingRequest(p.new);
            } else if (p.new && p.new.status !== 'pending') {
                setPendingRequest(null);
            }
        }

        // Functional update for setRequests to handle Master view
        if (isMaster) {
          console.log("UPDATING MASTER requests LIST");
          if (p.eventType === 'INSERT') setRequests(prev => [...prev, p.new]);
          else if (p.eventType === 'UPDATE') {
            setRequests(prev => {
              const existingIndex = prev.findIndex(r => r.id === p.new.id);
              if (p.new.status === 'pending') {
                return existingIndex > -1 
                  ? prev.map((r, i) => i === existingIndex ? p.new : r)
                  : [...prev, p.new].filter(r => r.status === 'pending');
              }
              return prev.filter(r => r.id !== p.new.id);
            });
          }
          else if (p.eventType === 'DELETE') {
            setRequests(prev => prev.filter(r => r.id !== p.old.id));
          }
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') console.log("--- REALTIME CONNECTED ---");
      });

    return () => {
      authListener.unsubscribe();
      supabase.removeChannel(mainChannel);
    };
  }, [viewingTarget, user?.id, isMaster, pendingRequest]);

  useEffect(() => {
    // This useEffect manages tempChar synchronization
    if (!isEditing) {
      setTempChar(character);
    } else if (pendingRequest) {
      // If we are editing and have a pending request, merge the request onto the current baseline
      // This ensures that all fields (stats, class, etc.) are correctly loaded
      
      const requestedData = pendingRequest.new_data;
      const keys = ['strength', 'resistance', 'aptitude', 'agility', 'precision', 'concentration', 'intelligence', 'luck', 'charisma'];
      const minStat = (character?.is_complex || isNPC) ? 1 : 3;

      const totalSpentOnRequested = keys.reduce((acc, k) => {
        const requestedVal = (requestedData[k] === "" || isNaN(requestedData[k])) ? minStat : Number(requestedData[k]);
        const originalValInRequest = Number(pendingRequest.old_data[k]) || minStat;
        return acc + (requestedVal - originalValInRequest);
      }, 0);

      const newStatPoints = character.stat_points_available - totalSpentOnRequested;

      setTempChar({ 
        ...character, 
        ...requestedData,
        stat_points_available: newStatPoints 
      });
    }
  }, [isEditing, pendingRequest, character]); // Safe now that the fetch loop is gone

  // --- HANDLERS ---
  const handleStatChange = (stat, val) => {
    playSoundEffect('stat_point');
    const nVal = val === "" ? "" : parseInt(val);
    const keys = ['strength', 'resistance', 'aptitude', 'agility', 'precision', 'intelligence', 'luck', 'charisma'];

      setTempChar(prev => {
        // 1. Create the new state object for attributes
        const nextState = {
          ...prev,
          [stat]: nVal
        };

        // 2. Calculate points spent based on the DIFFERENCE between 
        // our new state (nextState) and the original baseline (character)
        const totalSpent = keys.reduce((acc, k) => {
          // Treat empty strings or NaN as baseline for the sake of PS calculation
          const minStat = (activeChar?.is_complex || isNPC) ? 1 : 3;
          const currentVal = (nextState[k] === "" || isNaN(nextState[k])) ? minStat : Number(nextState[k]);
          const originalVal = Number(character[k]) || minStat;
          return acc + (currentVal - originalVal);
        }, 0);

        // 3. Return the updated object with the freshly calculated PS
        // We use the character's stat_points_available as the baseline.
        return {
          ...nextState,
          stat_points_available: character.stat_points_available - totalSpent
        };
      });
  };

  const toggleEditMode = async () => {
    setIsViewingOnly(false);
    if (isEditing) {
      const sanitized = { ...tempChar };
      const keys = ['strength', 'resistance', 'aptitude', 'agility', 'precision', 'concentration', 'intelligence', 'luck', 'charisma'];

      // VALIDATION 1: Check for stats lower than 3 (or 1 for complex NPCs) or empty
      const minStat = (sanitized?.is_complex || isNPC) ? 1 : 3;
      const hasInvalidStat = keys.some(k => sanitized[k] === "" || Number(sanitized[k]) < minStat);
      if (hasInvalidStat) {
        showToast(`Erro: Todos os atributos devem ser pelo menos ${minStat}.`);
        return;
      }

      // VALIDATION 2: Check for negative PS (Only for players)
      if (!isActingAsMaster && sanitized.stat_points_available < 0) {
        playSoundEffect('error');
        showToast(`Erro: Você gastou ${Math.abs(sanitized.stat_points_available)} PS a mais do que possui.`);
        return;
      }

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
            // Determine if we are editing a player or an NPC
            const isTargetNPC = allNPCs.some(n => n.id === (viewingTarget || user.id));
            const table = isTargetNPC ? 'npcs' : 'characters';

            // If it's an NPC, we need to filter/format fields to match the 'npcs' table schema
            let dataToSave = { ...sanitized };
            if (isTargetNPC) {
              dataToSave = {
                name: sanitized.char_name || sanitized.name,
                type: sanitized.type,
                category: sanitized.category,
                strength: Number(sanitized.strength) || 1,
                resistance: Number(sanitized.resistance) || 1,
                aptitude: Number(sanitized.aptitude) || 1,
                agility: Number(sanitized.agility) || 1,
                precision: Number(sanitized.precision) || 1,
                concentration: Number(sanitized.concentration) || 0,
                armed_pat: sanitized.armed_pat || '0',
                image_url: sanitized.image_url || null,
                rank: sanitized.rank || null,
                is_visible: !!sanitized.is_visible,
                // Complex fields
                age: sanitized.type === 'Complex' ? Number(sanitized.age) : null,
                bloodline: sanitized.type === 'Complex' ? sanitized.bloodline : null,
                breathing_style: sanitized.type === 'Complex' ? sanitized.breathing_style : null,
                breathing_lvl: sanitized.type === 'Complex' ? Number(sanitized.breathing_lvl) : 0,
                height: sanitized.type === 'Complex' ? sanitized.height : null,
                intelligence: sanitized.type === 'Complex' ? Number(sanitized.intelligence) : 0,
                charisma: sanitized.type === 'Complex' ? Number(sanitized.charisma) : 0,
                luck: sanitized.type === 'Complex' ? Number(sanitized.luck) : 0,
                dollars: sanitized.type === 'Complex' ? Number(sanitized.dollars) : 0,
                nichirin_color: sanitized.type === 'Complex' ? sanitized.nichirin_color : null,
                class: sanitized.type === 'Complex' ? sanitized.class : null,
                anomalies: sanitized.type === 'Complex' ? (Array.isArray(sanitized.anomalies) ? sanitized.anomalies : []) : [],
                skills: sanitized.type === 'Complex' ? (Array.isArray(sanitized.skills) ? sanitized.skills : []) : [],
                ammunition: sanitized.ammunition || {},
                stat_points_available: sanitized.type === 'Complex' ? Number(sanitized.stat_points_available) : 0,
                inventory: sanitized.type === 'Complex' ? (Array.isArray(sanitized.inventory) ? sanitized.inventory : []) : []
              };
            } else {
              dataToSave.master_editing_id = null;
            }

            // OPTIMISTIC SYNC: Update the local state in allNPCs or allPlayers immediately
            // to prevent the need for a manual refresh (F5).
            if (isTargetNPC) {
              setAllNPCs(prev => prev.map(n => n.id === (viewingTarget || user.id) ? { ...n, ...dataToSave } : n));
            } else {
              setAllPlayers(prev => prev.map(p => p.id === (viewingTarget || user.id) ? { ...p, ...dataToSave } : p));
            }

            const { error } = await supabase.from(table)
              .update(dataToSave)
              .eq('id', viewingTarget || user.id);

            // We also update the local 'character' state to match the DB
            // so that if we are viewing ourselves, our state stays in sync.
            if (!error) {
              // Update local character state to match the sanitized data
              // This is crucial for NPCs since they might use mapped fields (like char_name -> name)
              setCharacter(prev => ({ ...prev, ...dataToSave, char_name: dataToSave.name || dataToSave.char_name }));
            }

            // Master is viewing their own sheet, which has a pending request
            if (isActingAsMaster && !viewingTarget && pendingRequest) {
              await supabase.from('change_requests').delete().match({ id: pendingRequest.id });
              setPendingRequest(null); // Clear local state immediately
            } else if (viewingTarget && !isTargetNPC) {
              await supabase.from('change_requests').delete().match({ player_id: viewingTarget, status: 'pending' });
            }
            if (!error) showToast("Ficha Sincronizada!");
          } else {
            // We ensure only one pending request exists per player to avoid 409 Conflict
            try {
              console.log("Checking for existing pending requests for user:", user.id);
              const { data: existingReqs, error: fetchError } = await supabase.from('change_requests').select('id').eq('player_id', user.id).eq('status', 'pending');
              if (fetchError) console.error("Error fetching existing requests:", fetchError);
              
              if (existingReqs && existingReqs.length > 0) {
                console.log(`Found ${existingReqs.length} existing pending requests. Deleting them...`);
                const { error: deleteError } = await supabase.from('change_requests').delete().in('id', existingReqs.map(r => r.id));
                if (deleteError) console.error("Error deleting existing requests:", deleteError);
                else console.log("Existing requests deleted successfully.");
              }
            } catch (e) {
              console.error("Exception in clearing pending requests:", e);
            }

            console.log("Inserting new change request...");
            const { error } = await supabase.from('change_requests').insert({
              player_id: user.id,
              player_name: user?.user_metadata?.full_name || user?.user_metadata?.preferred_username,
              old_data: character,
              new_data: sanitized,
              status: 'pending'
            });
            
            if (error) {
              console.error("Error inserting change request:", error);
              showToast("Erro ao enviar pedido.");
            } else {
              console.log("Change request inserted successfully.");
              showToast("Pedido Enviado!");
            }
          }

          setIsEditing(false);
          setLoading(false);
        }
      });
    } else {
      if (pendingRequest) {
        setModal({
          isOpen: true,
          title: "Pedido de Edição Pendente",
          message: "Você já tem um pedido de edição pendente. O que deseja fazer?",
          type: "custom", // A new type to indicate custom buttons
              buttons: [
                {
                  label: "Editar Pedido Atual",
                  className: "bg-blue-600 hover:bg-blue-700",
                  onClick: () => {
                    playSoundEffect('random_button');
                    
                    const requestedData = pendingRequest.new_data;
                    const keys = ['strength', 'resistance', 'aptitude', 'agility', 'precision', 'concentration', 'intelligence', 'luck', 'charisma'];
                    const minStat = (character?.is_complex || isNPC) ? 1 : 3;

                    // 1. Calculate points spent in the request relative to its original baseline
                    const totalSpentOnRequested = keys.reduce((acc, k) => {
                      const requestedVal = (requestedData[k] === "" || isNaN(requestedData[k])) ? minStat : Number(requestedData[k]);
                      const originalValInRequest = Number(pendingRequest.old_data[k]) || minStat;
                      return acc + (requestedVal - originalValInRequest);
                    }, 0);

                    // DEBUG LOGS
                    console.log("--- DEBUG PS SYNC ---");
                    console.log("Current character (baseline) PS:", character.stat_points_available);
                    console.log("Request old_data (original baseline) PS:", pendingRequest.old_data.stat_points_available);
                    console.log("Points spent in request:", totalSpentOnRequested);

                    // 3. Subtract the spent points from the CURRENT character's available PS
                    const newStatPoints = character.stat_points_available - totalSpentOnRequested;
                    console.log("New calculated PS:", newStatPoints);

                    const newTempChar = { 
                      ...character, 
                      ...requestedData,
                      stat_points_available: newStatPoints
                    };

                      setTempChar(newTempChar);
                      // Remove the manual setIsEditing(true) from here because 
                      // it will be triggered by the button click anyway, 
                      // and we want the useEffect to handle the initialization.
                      setIsEditing(true);

                    closeModal();
                  }
                },
                {
                  label: "Excluir Pedido",
                  className: "bg-red-600 hover:bg-red-700",
                  onClick: async () => {
                    playSoundEffect("error");
                    await supabase.from("change_requests").delete().match({ id: pendingRequest.id });
                    setPendingRequest(null);
                    showToast("Pedido de edição excluído.");
                    closeModal();
                  }
                },
                {
                  label: "Cancelar",
                  className: "bg-zinc-700 hover:bg-zinc-800",
                  onClick: () => {
                    playSoundEffect('random_button');
                    closeModal();
                  }
                }
              ]
        });
      } else {
        setIsEditing(true);
      }
    }
  };

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-red-600 font-black italic">CARREGANDO...</div>;

  if (showMaintenance && user) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-30 bg-[url('/red-moon.jpg')] bg-cover bg-right grayscale"></div>
        <div className="relative z-10 text-center space-y-6 p-8">
          <h1 className="text-6xl font-black text-red-600 italic tracking-tighter uppercase leading-none">MANUTENÇÃO</h1>
          <div className="space-y-2">
            <p className="text-white font-bold text-xl uppercase tracking-widest">O Corvo está descansando.</p>
            <p className="text-zinc-500 text-sm font-medium italic">O site voltará em breve. Por favor, aguarde o aviso do Mestre no Discord.</p>
          </div>
          <div className="pt-8">
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                localStorage.removeItem('fake_discord_user');
                window.location.reload();
              }}
              className="text-[10px] text-zinc-500 hover:text-white transition-all uppercase font-black cursor-pointer underline tracking-widest"
            >
              Sair da Conta
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!user) return (
    <div className="min-h-screen bg-black flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 opacity-70 bg-[url('/red-moon.jpg')] bg-cover bg-right" style={{ maskImage: 'linear-gradient(to left, #000 0%, transparent 70%)', WebkitMaskImage: 'linear-gradient(to right, #000 0%, transparent 95%)' }}></div>
      <div className="relative z-10 text-center space-y-6">
        <h1 className="text-6xl font-black text-red-600 italic tracking-tighter uppercase leading-none">KIMETSU NO YAIBA<br /><span className="text-white text-4xl">BLOODBATH</span></h1>
        <button
          onClick={() => supabase.auth.signInWithOAuth({
            provider: 'discord',
            options: {
              // This is the magic line. It forces Supabase to send you back 
              // to exactly where you are right now (Local or Vercel).
              redirectTo: typeof window !== 'undefined' ? window.location.origin : ''
            }
          })}
          className="bg-red-600 text-white px-10 py-4 rounded-full font-black uppercase hover:scale-110 transition-all border-b-4 border-red-900"
        >
          Entrar com Discord
        </button>

        {!showCodeLogin ? (
          <button
            onClick={() => setShowCodeLogin(true)}
            className="text-zinc-500 hover:text-red-500 text-xs font-bold uppercase tracking-widest transition-colors block mx-auto"
          >
            Entrar com código
          </button>
        ) : (
          <div className="bg-zinc-900/50 p-4 rounded border border-zinc-800 space-y-4 max-w-xs mx-auto">
            <input
              type="text"
              placeholder="CÓDIGO SECRETO"
              className="w-full bg-black border border-zinc-700 p-2 text-white text-center font-bold"
              value={secretCodeInput}
              onChange={(e) => setSecretCodeInput(e.target.value)}
            />
            {secretCodeInput === SECRET_CODE && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                <p className="text-[10px] text-green-500 font-bold uppercase">Código Válido</p>
                <input
                  type="text"
                  placeholder="NOME DISCORD (FAKE)"
                  className="w-full bg-black border border-green-900/50 p-2 text-white text-center font-bold"
                  value={fakeDiscordUsernameInput}
                  onChange={(e) => setFakeDiscordUsernameInput(e.target.value)}
                />
                <button
                  onClick={async () => {
                    if (!fakeDiscordUsernameInput) return;

                    // Generate a consistent UUID-like ID based on the username 
                    // This ensures the same fake username always gets the same character
                    const hash = Array.from(fakeDiscordUsernameInput).reduce((acc, char) => acc + char.charCodeAt(0), 0);
                    const consistentUuid = '00000000-0000-4000-8000-' + hash.toString(16).padStart(12, '0');

                    const fakeUser = {
                      id: consistentUuid,
                      user_metadata: {
                        full_name: fakeDiscordUsernameInput,
                        preferred_username: fakeDiscordUsernameInput
                      },
                      is_fake: true
                    };
                    setUser(fakeUser);
                    localStorage.setItem('fake_discord_user', JSON.stringify(fakeUser));
                    window.location.reload(); // Simple and effective for triggering character creation
                  }}
                  className="w-full bg-green-600 hover:bg-green-500 text-white font-black py-2 rounded text-sm transition-colors"
                >
                  ACESSAR
                </button>
              </div>
            )}
            <button
              onClick={() => {
                setShowCodeLogin(false);
                setSecretCodeInput("");
              }}
              className="text-zinc-600 hover:text-white text-[10px] font-bold uppercase"
            >
              Cancelar
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <main className="min-h-screen bg-black text-white flex items-stretch" onClick={setUserInteracted}>

      {/* SIDEBAR */}
      <nav className="w-64 h-screen sticky top-0 bg-zinc-950 border-r border-zinc-900 flex flex-col justify-between shrink-0 z-[100]">
        <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-8">
          <div onClick={() => setActiveTab('home')} className="cursor-pointer">
            <h1 className="text-xl font-black text-red-600 italic leading-none uppercase">Bloodbath</h1>
            <p className="text-[8px] text-zinc-500 font-bold tracking-widest uppercase mt-1">What-If RPG</p>
          </div>

          <div className="space-y-10">
            {/* CATEGORIA PRINCIPAL */}
            <div>
              <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-3 ml-4">Principal</p>
              <div className="flex flex-col gap-1">
                <NavButton 
                  active={activeTab === 'home'} 
                  label="Início" 
                  onClick={() => { playSoundEffect('tab_change'); setActiveTab('home'); }} 
                />
                <NavButton 
                  active={activeTab === 'combat'} 
                  label="Sessão" 
                  disabled={!isActingAsMaster && blockedTabs.includes('combat')}
                  isBlocked={!isActingAsMaster && blockedTabs.includes('combat')}
                  onClick={() => { 
                    if (!isActingAsMaster && blockedTabs.includes('combat')) {
                      playSoundEffect('error');
                      showToast("Esta página está bloqueada pelo Mestre.");
                      return;
                    }
                    playSoundEffect('tab_change'); 
                    setActiveTab('combat'); 
                  }} 
                />
                <NavButton 
                  active={activeTab === 'reports'} 
                  label="Relatórios" 
                  disabled={!isActingAsMaster && blockedTabs.includes('reports')}
                  isBlocked={!isActingAsMaster && blockedTabs.includes('reports')}
                  onClick={() => { 
                    if (!isActingAsMaster && blockedTabs.includes('reports')) {
                      playSoundEffect('error');
                      showToast("Esta página está bloqueada pelo Mestre.");
                      return;
                    }
                    playSoundEffect('tab_change'); 
                    setActiveTab('reports'); 
                  }} 
                />
                <NavButton 
                  active={activeTab === 'investigation'} 
                  label="Investigação" 
                  disabled={!isActingAsMaster && blockedTabs.includes('investigation')}
                  isBlocked={!isActingAsMaster && blockedTabs.includes('investigation')}
                  onClick={() => { 
                    if (!isActingAsMaster && blockedTabs.includes('investigation')) {
                      playSoundEffect('error');
                      showToast("Esta página está bloqueada pelo Mestre.");
                      return;
                    }
                    playSoundEffect('tab_change'); 
                    setActiveTab('investigation'); 
                  }} 
                />
              </div>
            </div>

            <div className="h-px bg-gradient-to-r from-transparent via-zinc-800 to-transparent mx-4" />
            {/* CATEGORIA INDIVIDUAL */}
            <div>
              <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-3 ml-4">Individual</p>
              <div className="flex flex-col gap-1">
                <NavButton active={activeTab === 'sheet' && !viewingTarget} label="Minha Ficha" onClick={() => {
                  if (isEditing && !isViewingOnly) {
                    playSoundEffect('error');
                    showToast("Você precisa concluir sua edição antes de visualizar outras abas.");
                    return;
                  }
                  playSoundEffect('tab_change');
                  const myChar = allPlayers.find(p => p.id === user?.id);
                  if (myChar) {
                    setCharacter(myChar);
                    if (!isEditing) setTempChar(myChar);
                  }
                  setViewingTarget(null);
                  setActiveTab('sheet');
                }} />
                
                {/* Respiração Tab - Always visible if player has a breathing style */}
                {allPlayers.find(p => p.id === user?.id)?.breathing_style && (
                  <NavButton 
                    active={activeTab === 'breathing' && (viewingTarget === null || viewingTarget === user?.id)} 
                    label="Respiração" 
                    disabled={!isActingAsMaster && blockedTabs.includes('breathing')}
                    isBlocked={!isActingAsMaster && blockedTabs.includes('breathing')}
                    onClick={() => {
                      if (!isActingAsMaster && blockedTabs.includes('breathing')) {
                        playSoundEffect('error');
                        showToast("Esta página está bloqueada pelo Mestre.");
                        return;
                      }
                      playSoundEffect('tab_change');
                      
                      // CRITICAL: Force refresh of character data for current user
                      const myChar = allPlayers.find(p => p.id === user?.id);
                      if (myChar) {
                        setCharacter(myChar);
                        if (!isEditing) setTempChar(myChar);
                      }
                      
                      setViewingTarget(null);
                      setActiveTab('breathing');
                    }} 
                  />
                )}
                {/* Highlight Breathing Tab when Master is viewing someone else's tree */}
                {isActingAsMaster && viewingTarget && viewingTarget !== user?.id && activeTab === 'breathing' && (
                  null
                )}
              </div>
            </div>

            <div className="h-px bg-gradient-to-r from-transparent via-zinc-800 to-transparent mx-4" />
            {/* CATEGORIA FICHAS */}
            <div>
              <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-3 ml-4">Fichas</p>
              <div className="flex flex-col gap-1">
                    {allPlayers
                      .filter(p => {
                        const isMe = p.id === user?.id;
                        if (isMe) return false;
                        if (p.discord_username === ".enderu") return false;

                        const isApproved = !!p.approved_once;
                        const charNameLower = (p.char_name || "").toLowerCase().trim();
                        const isNovoRecruta = charNameLower === "novo recruta";

                        // Master sees everything
                        if (isActingAsMaster) return true;

                        // Rules for other players:
                        // 1. If it's "Novo Recruta" and NOT approved, hide it entirely
                        if (isNovoRecruta && !isApproved) return false;

                        // 2. Otherwise, return true so it can be shown (NavButton handles disabled state)
                        return true;
                      })
                      .map(p => {
                        const isApproved = !!p.approved_once;
                        const canView = isActingAsMaster || isApproved;

                        return (
                          <div key={p.id} className="flex flex-col gap-1">
                            <NavButton
                              active={activeTab === 'sheet' && viewingTarget === p.id}
                              label={p.char_name || p.discord_username}
                              disabled={!canView}
                              isUnapproved={!isApproved && !isActingAsMaster}
                              onClick={() => {
                                if (!canView) {
                                  playSoundEffect('error');
                                  showToast("Ficha ainda não aprovada pelo mestre.");
                                  return;
                                }
                                if (isEditing && !isViewingOnly) {
                                  playSoundEffect('error');
                                  showToast("Você precisa concluir sua edição antes de visualizar outras fichas.");
                                  return;
                                }
                                playSoundEffect('tab_change');
                                setCharacter(p);
                                if (!isEditing) setTempChar(p);
                                setViewingTarget(p.id);
                                setActiveTab('sheet');
                              }}
                            />
                            {/* Dynamic Breathing Tab for this player */}
                            {isActingAsMaster && viewingTarget === p.id && activeTab === 'breathing' && (
                              <div className="ml-4 border-l-2 border-cyan-600/30 pl-2">
                                <NavButton
                                  active={true}
                                  label={`(Resp.) ${p.char_name || p.discord_username}`}
                                  onClick={() => {}}
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}

                {/* Complex NPCs in Sidebar */}
                {allNPCs
                  .filter(npc => npc.type === 'Complex')
                  .filter(npc => isActingAsMaster || npc.is_visible)
                  .map(npc => (
                    <NavButton
                      key={npc.id}
                      active={activeTab === 'sheet' && viewingTarget === npc.id}
                      label={npc.name}
                      isNPC
                      onClick={() => {
                        if (isEditing && !isViewingOnly) {
                          playSoundEffect('error');
                          showToast("Você precisa concluir sua edição antes de visualizar outras fichas.");
                          return;
                        }
                        playSoundEffect('tab_change');
                        setCharacter(npc);
                        setTempChar(npc);
                        setViewingTarget(npc.id);
                        setActiveTab('sheet');
                      }}
                    />
                  ))}

                <NavButton 
                  active={activeTab === 'npcs'} 
                  label="NPCs" 
                  disabled={!isActingAsMaster && blockedTabs.includes('npcs')}
                  isBlocked={!isActingAsMaster && blockedTabs.includes('npcs')}
                  onClick={() => { 
                    if (!isActingAsMaster && blockedTabs.includes('npcs')) {
                      playSoundEffect('error');
                      showToast("Esta página está bloqueada pelo Mestre.");
                      return;
                    }
                    playSound('tab_change'); 
                    setActiveTab('npcs'); 
                  }} 
                />
              </div>
            </div>

            {isActingAsMaster && (
              <>
                <div className="h-px bg-gradient-to-r from-transparent via-red-950 to-transparent mx-4" />

                {/* CATEGORIA MESTRE */}
                <div>
                  <p className="text-[9px] font-black text-red-900 uppercase tracking-widest mb-3 ml-4">Mestre</p>
                  <div className="flex flex-col gap-1">
                  <NavButton active={activeTab === 'master'} label="Mestre" onClick={() => { playSoundEffect('tab_change'); setActiveTab('master'); }} />
                  <NavButton 
                    active={activeTab === 'items'} 
                    label="Itens" 
                    disabled={!isActingAsMaster && blockedTabs.includes('items')}
                    isBlocked={!isActingAsMaster && blockedTabs.includes('items')}
                    onClick={() => { 
                      if (!isActingAsMaster && blockedTabs.includes('items')) {
                        playSoundEffect('error');
                        showToast("Esta página está bloqueada pelo Mestre.");
                        return;
                      }
                      playSoundEffect('tab_change'); 
                      setActiveTab('items'); 
                    }} 
                  />
                  <NavButton 
                    active={activeTab === 'loot'} 
                    label="Loot" 
                    disabled={!isActingAsMaster && blockedTabs.includes('loot')}
                    isBlocked={!isActingAsMaster && blockedTabs.includes('loot')}
                    onClick={() => { 
                      if (!isActingAsMaster && blockedTabs.includes('loot')) {
                        playSoundEffect('error');
                        showToast("Esta página está bloqueada pelo Mestre.");
                        return;
                      }
                      playSoundEffect('tab_change'); 
                      setActiveTab('loot'); 
                    }} 
                  />
                  <NavButton 
                    active={activeTab === 'traders'} 
                    label="Comerciantes" 
                    disabled={!isActingAsMaster && blockedTabs.includes('traders')}
                    isBlocked={!isActingAsMaster && blockedTabs.includes('traders')}
                    onClick={() => { 
                      if (!isActingAsMaster && blockedTabs.includes('traders')) {
                        playSoundEffect('error');
                        showToast("Esta página está bloqueada pelo Mestre.");
                        return;
                      }
                      playSoundEffect('tab_change'); 
                      setActiveTab('traders'); 
                    }} 
                  />
                  </div>
                </div>
              </>
            )}

          </div>
        </div>
        <div className="p-8 pt-4 space-y-4 border-t border-white/5 bg-zinc-950">
          {/* VOLUME SLIDER */}
          <div className="px-4 py-2 bg-zinc-900/30 rounded-2xl border border-white/5 flex items-center gap-3 group">
            <span className="text-xs grayscale group-hover:grayscale-0 transition-all opacity-50 group-hover:opacity-100">🔊</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={(e) => changeVolume(parseFloat(e.target.value))}
              className="flex-1 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-red-600 hover:accent-red-500"
            />
            <span className="text-[9px] font-mono font-black text-zinc-600 w-6 text-right">{(volume * 100).toFixed(0)}%</span>
          </div>

          <div className="p-4 bg-zinc-900/50 rounded-2xl border border-white/5">
            <p className="text-[8px] text-zinc-500 font-black uppercase mb-1 leading-none">Logado como</p>
            <p className="text-[10px] font-bold text-white truncate leading-none">@{user?.user_metadata?.full_name || user?.user_metadata?.preferred_username}</p>
          </div>
          {isMaster && (
            <button onClick={() => { playSound('random_button'); setPreviewAsPlayer(!previewAsPlayer); setActiveTab('home'); }} className="w-full text-[9px] font-black uppercase py-2 rounded-lg border border-zinc-700 text-zinc-500 hover:text-white transition-all">
              {previewAsPlayer ? "MODO MESTRE" : "MODO JOGADOR"}
            </button>
          )}
          {/* FIXED LOGOUT BUTTON */}
          <button
            onClick={async () => {
              playSound('random_button');
              await supabase.auth.signOut();
              localStorage.removeItem('fake_discord_user');
              window.location.reload();
            }}
            className="w-full text-[10px] text-red-600/70 hover:text-red-500 transition-all uppercase font-black cursor-pointer text-center py-2 border-t border-white/5"
          >
            Sair da Conta
          </button>
        </div>
      </nav>

      {/* CONTENT AREA */}
      <section className="flex-1 min-h-screen bg-zinc-950 relative flex flex-col">
        {activeTab === 'home' && (
          <div className="h-full flex items-center relative overflow-hidden">
            <div className="absolute top-8 left-8 z-50">
              <button 
                onClick={toggleAnimations}
                className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all border ${
                  animationsEnabled 
                    ? 'bg-zinc-800/30 text-zinc-500 border-zinc-700/50 hover:text-zinc-300 hover:bg-zinc-800/50' 
                    : 'bg-zinc-800/50 text-zinc-500 border-zinc-700 hover:bg-zinc-800 hover:text-zinc-300'
                }`}
              >
                Animações: {animationsEnabled ? 'ON' : 'OFF'}
              </button>
            </div>
            <div 
              className={`absolute inset-0 opacity-70 bg-[url('/red-moon.jpg')] bg-cover bg-right ${animationsEnabled ? 'moon-animated' : ''}`} 
              style={{ 
                maskImage: 'linear-gradient(to left, #000 0%, transparent 80%)', 
                WebkitMaskImage: 'linear-gradient(to left, #000 0%, transparent 100%)',
                '--moon-duration': '30s'
              }}
            ></div>
            {/* Overlay de Vinheta - Coloque logo abaixo do background da lua */}
            <div className="absolute inset-0 z-[6] pointer-events-none bg-[radial-gradient(circle,_transparent_40%,_rgba(0,0,0,0.8)_100%)]"></div>

            {/* Overlay de Textura/Ruído (Opcional, precisa de um asset de noise) */}
            <div className="absolute inset-0 z-[7] opacity-[0.03] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]"></div>
            {/* Fog Overlay */}
            {animationsEnabled && (
              <div className="fog-container">
                <div className="fog-layer" ref={fogRef}>
                  <div className="fog-img"></div>
                  <div className="fog-img mirrored"></div>
                  <div className="fog-img"></div>
                  <div className="fog-img mirrored"></div>
                </div>
              </div>
            )}

            {/* Fade Overlay to protect sidebar area */}
            <div className="absolute inset-0 z-[5] bg-gradient-to-r from-black via-black/20 to-transparent w-1/2 pointer-events-none"></div>

            <div className="relative z-10 p-20 space-y-4 max-w-4xl">
              <h2 className="text-7xl font-black italic uppercase tracking-tighter leading-[0.85] text-white">What if?<br /><span className="text-red-600">Bloodbath</span></h2>

              <div className="border-l-2 border-zinc-400 pl-6 py-2 space-y-4">
                <p className="text-zinc-400 font-medium italic text-xl leading-relaxed max-w-xl">
                  "O Sol irá se pôr e a Lua aparecerá. <br />
                  Uma rachadura irá cicatrizá-la. <br />
                  Então, <span className="text-[rgb(205,205,205)]">Deus abandonará os humanos</span>."
                </p>
                <p className="text-white font-bold italic text-lg tracking-widest uppercase">
                  Capítulo 1: O Sol se pôs.
                </p>
              </div>


              <button onClick={() => {
                if (isEditing && !isViewingOnly) {
                  playSoundEffect('error');
                  showToast("Você precisa concluir sua edição antes de visualizar outras fichas.");
                  return;
                }
                playSoundEffect('tab_change');
                const myChar = allPlayers.find(p => p.id === user?.id);
                if (myChar) {
                  setCharacter(myChar);
                  if (!isEditing) setTempChar(myChar);
                }
                setViewingTarget(null);
                setActiveTab('sheet');
              }} className="mt-8 px-8 py-3 bg-white text-black font-black uppercase text-xs rounded-full hover:bg-red-600 hover:text-white transition-all">Ver minha Ficha</button>
            </div>
          </div>
        )}

        {activeTab === 'sheet' && (
          <div className="p-12">
            <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-8">
                {/* THE MAIN CHARACTER CARD */}
                <div className="bg-zinc-900/50 p-10 rounded-[40px] border border-zinc-800 relative shadow-2xl">

                  {/* TOP RIGHT BUTTON GROUP */}
                  <div className="absolute top-8 right-8 z-20 flex flex-col gap-2 items-end">
                    {(!isViewingOthers || isActingAsMaster) && (
                      <button
                        onClick={() => { playSoundEffect('random_button'); toggleEditMode(); }}
                        className={`w-44 text-[10px] font-black px-6 py-2 rounded-full uppercase transition-all hover:scale-105 shadow-xl ${isEditing ? 'bg-green-600' : (activeRequest ? 'bg-lime-400 text-black border-2 border-lime-500' : 'bg-yellow-600 text-black')}`}
                      >
                        {isEditing ? "CONCLUIR" : (activeRequest ? "EDITAR !" : "EDITAR")}
                      </button>
                    )}

                    {isEditing && (
                      <>
          <button onClick={() => { playSoundEffect('random_button'); setIsViewingOnly(!isViewingOnly); }} className="w-44 bg-blue-900/40 text-blue-400 text-[9px] font-bold px-4 py-2 rounded-full uppercase transition-all hover:bg-blue-900/60 border border-blue-900/30">
            {isViewingOnly ? "VOLTAR PARA EDIÇÃO" : "VER ORIGINAL"}
          </button>
          <button onClick={() => { playSoundEffect('random_button'); setTempChar(character); setIsEditing(false); setIsViewingOnly(false); }} className="w-44 bg-red-900/40 text-red-500 text-[9px] font-bold px-4 py-2 rounded-full uppercase transition-all hover:bg-red-900/60 cursor-pointer border border-red-900/30">
            Cancelar
          </button>
                      </>
                    )}

                    {isActingAsMaster && !isEditing && !activeRequest && viewingTarget && !isNPC && (
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={async () => {
                            playSoundEffect('random_button');
                            const newStatus = !character.approved_once;
                            const { error } = await supabase.from('characters')
                              .update({ approved_once: newStatus })
                              .eq('id', viewingTarget);
                            
                            if (!error) {
                              showToast(newStatus ? "Ficha Aprovada!" : "Ficha Desaprovada!");
                              setCharacter(prev => ({ ...prev, approved_once: newStatus }));
                            } else {
                              showToast("Erro ao atualizar aprovação.");
                            }
                          }}
                          className={`w-44 text-[10px] font-black px-6 py-2 rounded-full uppercase transition-all hover:scale-105 shadow-xl ${character?.approved_once ? 'bg-red-600 text-white' : 'bg-green-600 text-white'}`}
                        >
                          {character?.approved_once ? "Desaprovar" : "Aprovar"}
                        </button>

                        {character?.breathing_style && (
                          <button
                            onClick={() => {
                              playSoundEffect('tab_change');
                              setActiveTab('breathing');
                            }}
                            className="w-44 bg-cyan-600 text-white text-[10px] font-black px-6 py-2 rounded-full uppercase transition-all hover:scale-105 shadow-xl border-b-4 border-cyan-800"
                          >
                            Editar Resp.
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* CHARACTER NAME (NOW EDITABLE) */}
                  <div className="max-w-[calc(100%-180px)] mb-10">
                    {isEditing && !isViewingOnly ? (
                      <input
                        type="text"
                        value={tempChar?.char_name || tempChar?.name || ""}
                        onChange={(e) => setTempChar({ ...tempChar, char_name: e.target.value, name: e.target.value })}
                        className="text-5xl font-black text-red-600 italic uppercase tracking-tighter leading-tight bg-black/20 border-b-2 border-red-600/50 outline-none w-full placeholder:opacity-20"
                        placeholder="NOME DO PERSONAGEM"
                      />
                    ) : (
                      <h2 className="text-5xl font-black text-red-600 italic uppercase tracking-tighter leading-tight">
                        {(typeof (activeChar?.char_name || activeChar?.name) === 'string') ? (activeChar?.char_name || activeChar?.name).replace(/^'|'::text$/g, '') : (activeChar?.char_name || activeChar?.name)}
                      </h2>
                    )}
                    <p className="text-zinc-500 text-[10px] font-bold uppercase mt-1 italic leading-none">
                      {isActingAsMaster ? (
                        <>ID: {isViewingOthers ? (character?.npc_id || character?.discord_username) : user?.user_metadata?.full_name || user?.user_metadata?.preferred_username}</>
                      ) : (
                        !isNPC && (
                          <>Discord: {isViewingOthers ? (character?.npc_id || character?.discord_username) : user?.user_metadata?.full_name || user?.user_metadata?.preferred_username}</>
                        )
                      )}
                    </p>
                  </div>

                  {/* BIOGRID (Respects Peek mode) */}
                  <BioGrid activeChar={activeChar} isEditing={isEditing && !isViewingOnly} setTempChar={setTempChar} />

                  {/* ANOMALIAS & HABILIDADES */}
                  <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <TagBox label="Anomalias" list={ANOMALIAS_LIST} descriptions={ANOMALIAS_DESCRIPTIONS} activeList={activeChar?.anomalies} field="anomalies" isEditing={isEditing && !isViewingOnly} setTempChar={setTempChar} />
                    <TagBox label="Habilidades" list={SKILLS_LIST} descriptions={SKILLS_DESCRIPTIONS} activeList={activeChar?.skills} field="skills" isEditing={isEditing && !isViewingOnly} setTempChar={setTempChar} color="text-cyan-200 bg-cyan-950/30 border-cyan-500/20" />
                  </div>

                  {/* BOTTOM STATS BOXES */}
                  <div className="mt-12 grid grid-cols-3 gap-6 text-center">
                    <StatBox label="VIDA" value={life} color="border-red-600" textColor="text-red-500" />
                    <StatBox label="PRESENÇA" value={presence} color="border-blue-500" textColor="text-blue-500" />
                    <StatBox label="POSTURA" value={posture.toFixed(0)} color="border-green-500" textColor="text-green-500" />
                  </div>

                </div>
                <Inventory
                  inventory={activeChar?.inventory || []}
                  activeChar={activeChar}
                  isActingAsMaster={isActingAsMaster}
                  isViewingOthers={isViewingOthers}
                  rarityConfig={RARITY_CONFIG}
                  setTempChar={setTempChar}
                  isEditing={isEditing}
                  onMove={(idx, dir) => {
                    const targetIdx = idx + dir;
                    if (targetIdx < 0 || targetIdx >= (activeChar.inventory?.length || 0)) return;

                    const newList = [...(activeChar.inventory || [])];
                    const [movedItem] = newList.splice(idx, 1);
                    newList.splice(targetIdx, 0, movedItem);

                    setTempChar(prev => ({ ...prev, inventory: newList }));

                    // If not in a "Change Request" session (Master direct edit or simple move), sync DB
                    if (!isEditing) {
                      const isNPC = allNPCs.some(n => n.id === activeChar.id);
                      const table = isNPC ? 'npcs' : 'characters';
                      supabase.from(table).update({ inventory: newList }).eq('id', activeChar.id).then();
                    }
                  }}
                  onSort={(type) => {
                    const newList = [...(activeChar.inventory || [])];
                    newList.sort((a, b) => type === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name));

                    setTempChar(prev => ({ ...prev, inventory: newList }));
                    if (!isEditing) {
                      const isNPC = allNPCs.some(n => n.id === activeChar.id);
                      const table = isNPC ? 'npcs' : 'characters';
                      supabase.from(table).update({ inventory: newList }).eq('id', activeChar.id).then();
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
                        const isNPC = allNPCs.some(n => n.id === activeChar.id);
                        const table = isNPC ? 'npcs' : 'characters';
                        supabase.from(table).update({ inventory: newList }).eq('id', activeChar.id).then();
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

                      // Explicitly mapping variables from modal
                      const itemWithId = {
                        ...newItem,
                        id: Date.now(),
                        type: newItem.type || 'Item',
                        isBackpack: !!newItem.isBackpack, // Ensure boolean
                        cargaIncrease: newItem.cargaIncrease || 10,
                        equipped: false
                      };

                      const newList = [...(activeChar.inventory || []), itemWithId];
                      setTempChar(prev => ({ ...prev, inventory: newList }));

                      if (!isEditing) {
                        const isNPC = allNPCs.some(n => n.id === activeChar.id);
                        const table = isNPC ? 'npcs' : 'characters';
                        await supabase.from(table).update({ inventory: newList }).eq('id', activeChar.id);
                      }
                      closeModal();
                    }
                  })}
                  onEquip={async (idx) => {
                    const item = activeChar.inventory[idx];
                    const isWeapon = item.subtype && (item.category === "Arma de Fogo" || item.category === "Arma Branca");
                    const newList = [...(activeChar.inventory || [])];

                    // HAND LIMIT LOGIC
                    if (!item.equipped && isWeapon) {
                      const equippedWeapons = newList.filter(i => i.equipped && i.subtype && (i.category === "Arma de Fogo" || i.category === "Arma Branca"));
                      const totalHandsUsed = equippedWeapons.reduce((acc, w) => acc + (w.hands === "Duas Mãos" ? 2 : 1), 0);
                      const requestedHands = item.hands === "Duas Mãos" ? 2 : 1;

                      if (totalHandsUsed + requestedHands > 2) {
                        showToast(`Erro: Você já está usando ${totalHandsUsed} mãos. Desequipe algo primeiro.`);
                        return;
                      }
                    }

                    // BACKPACK CARGA LOGIC
                    if (item.isBackpack) {
                      let simulatedList = newList.map(i => ({...i}));

                      if (!item.equipped) {
                        // Equipping a new backpack
                        // First, unequip any existing backpack
                        const currentlyEquippedIdx = simulatedList.findIndex(i => i.isBackpack && i.equipped);
                        if (currentlyEquippedIdx !== -1) {
                          simulatedList[currentlyEquippedIdx].equipped = false;
                        }
                        // Equip the new one
                        simulatedList[idx].equipped = true;
                        
                        // Check if valid
                        const newEquippedBackpack = simulatedList.find(i => i.isBackpack && i.equipped);
                        const newMaxSlots = 6 + (newEquippedBackpack ? (Number(newEquippedBackpack.cargaIncrease) || 10) : 0);
                        const newItemWeight = simulatedList.reduce((acc, i) => {
                          if (i.isBackpack && i.equipped) return acc;
                          return acc + (Number(i.amount) || 1) * (Number(i.carga) || 1);
                        }, 0);

                        if (newItemWeight > newMaxSlots) {
                          showToast(`Erro: Trocar de mochila excederia sua carga máxima (${newItemWeight}/${newMaxSlots}).`);
                          return;
                        }
                        
                        // Apply simulated changes
                        if (currentlyEquippedIdx !== -1) {
                          newList[currentlyEquippedIdx].equipped = false;
                        }
                        newList[idx].equipped = true;
                      } else {
                        // Unequipping the backpack
                        simulatedList[idx].equipped = false;
                        
                        const newMaxSlots = 6;
                        const newItemWeight = simulatedList.reduce((acc, i) => {
                          if (i.isBackpack && i.equipped) return acc;
                          return acc + (Number(i.amount) || 1) * (Number(i.carga) || 1);
                        }, 0);

                        if (newItemWeight > newMaxSlots) {
                          showToast(`Erro: Remover a mochila excederia sua carga máxima (${newItemWeight}/${newMaxSlots}).`);
                          return;
                        }
                        
                        newList[idx].equipped = false;
                      }
                    } else {
                      newList[idx].equipped = !newList[idx].equipped;
                    }

                    // Normal Direct Update
                    setTempChar(prev => ({ ...prev, inventory: newList }));
                    if (!isEditing) {
                      const isNPC = allNPCs.some(n => n.id === activeChar.id);
                      const table = isNPC ? 'npcs' : 'characters';
                      await supabase.from(table).update({ inventory: newList }).eq('id', activeChar.id);
                    }
                  }}
                  onEdit={(idx) => setModal({
                    isOpen: true,
                    title: "Editar Item",
                    fields: true,
                    forcedCustom: true, // Reuse the forcedCustom logic but we won't disable Tier/Upgrade here
                    isInventoryEdit: true, // We'll use this new flag to allow Tier/Upgrade
                    initialData: activeChar.inventory[idx],
                    rarityConfig: RARITY_CONFIG,
                    onConfirm: async (updatedItem) => {
                      const newList = [...(activeChar.inventory || [])];
                      newList[idx] = { ...newList[idx], ...updatedItem };
                      setTempChar(prev => ({ ...prev, inventory: newList }));
                      if (!isEditing) {
                        const isNPC = allNPCs.some(n => n.id === activeChar.id);
                        const table = isNPC ? 'npcs' : 'characters';
                        await supabase.from(table).update({ inventory: newList }).eq('id', activeChar.id);
                      }
                      closeModal();
                      showToast("Item atualizado!");
                    }
                  })}
                />
              </div>

              <div className="space-y-6">
                <DicePanel
                  activeChar={activeChar}
                  luckPerc={luckPerc}
                  charismaPerc={charismaPerc}
                  intelligencePerc={intelligencePerc}
                  strengthPerc={strengthPerc}
                  resistancePerc={resistancePerc}
                  aptitudePerc={aptitudePerc}
                  agilityPerc={agilityPerc}
                  precisionPerc={precisionPerc}
                />
                <div className="bg-zinc-900/50 p-8 rounded-[40px] border border-zinc-800 shadow-2xl">
                  <div className="flex justify-between items-center mb-8 border-b border-zinc-800 pb-3">
                    <h3 className="font-black text-zinc-500 text-[12px] italic">ATRIBUTOS</h3>
                    {!(activeChar?.is_complex || isNPC) && (
                      <div className={`px-3 py-1 rounded border text-[15px] font-black font-mono leading-none transition-colors ${(activeChar?.stat_points_available < 0)
                        ? 'bg-red-600/20 text-red-500 border-red-500/50'
                        : 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30'
                        }`}>
                        {activeChar?.stat_points_available || 0} PS
                      </div>
                    )}
                  </div>
                  <ul className="space-y-2">
                    <StatLine label="Força" statKey="strength" val={activeChar?.strength} isEditing={isEditing} handleStatChange={handleStatChange} getPerc={getPerc} activeChar={activeChar} />
                    <StatLine label="Resistência" statKey="resistance" val={activeChar?.resistance} isEditing={isEditing} handleStatChange={handleStatChange} getPerc={getPerc} activeChar={activeChar} />
                    <StatLine label="Aptidão" statKey="aptitude" val={activeChar?.aptitude} isEditing={isEditing} handleStatChange={handleStatChange} getPerc={getPerc} activeChar={activeChar} />
                    <StatLine label="Agilidade" statKey="agility" val={activeChar?.agility} isEditing={isEditing} handleStatChange={handleStatChange} getPerc={getPerc} activeChar={activeChar} />
                    <StatLine label="Precisão" statKey="precision" val={activeChar?.precision} isEditing={isEditing} handleStatChange={handleStatChange} getPerc={getPerc} activeChar={activeChar} />
                    <StatLine label="Concentração" statKey="concentration" val={activeChar?.concentration} isEditing={isEditing} handleStatChange={handleStatChange} getPerc={getPerc} activeChar={activeChar} />
                  </ul>
                  <div className="mt-8 border-t border-zinc-800 pt-6 uppercase italic text-[9px] text-cyan-500 font-black mb-4 tracking-widest">Especialidades</div>
                  <ul className="space-y-2">
                    <StatLine label="Inteligência" statKey="intelligence" val={activeChar?.intelligence} isEditing={isEditing} handleStatChange={handleStatChange} getPerc={getPerc} isSpecial activeChar={activeChar} />
                    <StatLine label="Sorte" statKey="luck" val={activeChar?.luck} isEditing={isEditing} handleStatChange={handleStatChange} getPerc={getPerc} isSpecial activeChar={activeChar} />
                    <StatLine label="Carisma" statKey="charisma" val={activeChar?.charisma} isEditing={isEditing} handleStatChange={handleStatChange} getPerc={getPerc} isSpecial activeChar={activeChar} />
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ADDED THIS BLOCK HERE */}
        {activeTab === 'combat' && (
          <div className="flex-1 relative h-0">
            <CombatTab
              user={user}
              allPlayers={allPlayers}
              allNPCs={allNPCs}
              messages={messages}
              isCombatActive={isCombatActive}
              isSessionActive={isSessionActive}
              isMaster={isMaster}
              isActingAsMaster={isActingAsMaster}
              setActiveTab={setActiveTab}
              turn={turn}
              sharedImage={sharedImage}
              lootTables={lootTables}
              showToast={showToast}
              chatInput={chatInput}
              setChatInput={setChatInput}
              quickDiceInputs={quickDiceInputs}
              setQuickDiceInputs={setQuickDiceInputs}
            />
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="flex-1 relative overflow-y-auto custom-scrollbar">
            <ReportsTab 
              user={user} 
              isMaster={isActingAsMaster} 
              showToast={showToast} 
              playSound={playSoundEffect}
            />
          </div>
        )}

        {activeTab === 'investigation' && (
          <div className="flex-1 relative">
            <InvestigationTab 
              user={user}
              isMaster={isActingAsMaster}
              showToast={showToast}
              playSound={playSoundEffect}
            />
          </div>
        )}

        {activeTab === 'breathing' && (
          <div className="flex-1 relative">
            <BreathingTab 
              user={user}
              character={character}
              isMaster={isActingAsMaster}
              showToast={showToast}
              playSound={playSoundEffect}
              onReturn={() => {
                setActiveTab('sheet');
              }}
            />
          </div>
        )}

        {activeTab === 'traders' && isActingAsMaster && (
          <div className="p-12">
            <TradersTab
              isActingAsMaster={isActingAsMaster}
              showToast={showToast}
              setModal={setModal}
              closeModal={closeModal}
              playerCharacter={character}
            />
          </div>
        )}

        {activeTab === 'master' && isMaster && (
          <div className="p-12">
            <MasterPanel
              requests={requests}
              setRequests={setRequests}
              allPlayers={allPlayers}
              showToast={showToast}
              setModal={setModal}
              closeModal={closeModal}
              onVisualize={(p) => {
                setViewingTarget(p.id);
                setCharacter(p);
                setTempChar(p);
                setActiveTab('sheet');
              }}
              now={now}                   // Pass current time
              globalLock={globalLockUntil} // Pass the 0.5s trigger
              isCombatActive={isCombatActive}
              isSessionActive={isSessionActive}
              setActiveTab={setActiveTab} // <--- Pass the function here
            />
          </div>
        )}

        {activeTab === 'items' && isMaster && (
          <div className="p-12">
            <div className="max-w-4xl mx-auto space-y-8">
              <div className="flex justify-between items-center bg-zinc-900/50 p-8 rounded-[40px] border border-zinc-800">
                <div className="flex-1 pr-8">
                  <h2 className="text-4xl font-black italic text-white uppercase tracking-tighter">Biblioteca de Itens</h2>
                  <div className="flex items-center gap-4 mt-2">
                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest shrink-0">Gerenciamento Centralizado</p>
                    <input
                      type="text"
                      placeholder="Pesquisar itens..."
                      className="w-full bg-black/40 border border-white/5 rounded-full px-6 py-1.5 text-xs text-white outline-none focus:border-yellow-500/50 w-64"
                      onChange={(e) => {
                        const val = e.target.value.toLowerCase().replace(/s/g, '');
                        // We use a local state for this later if needed, but for now we can filter library directly
                        setSearchTerm(e.target.value);
                      }}
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => setModal({
                      isOpen: true,
                      title: "Novo Item Global",
                      fields: true,
                      forcedCustom: true,
                      rarityConfig: RARITY_CONFIG,
                      onConfirm: async (d) => {
                        playSound('random_button');
                        const { error } = await supabase.from('items').insert({
                          item_id: d.item_id,
                          name: d.name,
                          type: d.type,
                          rarity: d.rarity,
                          value: d.value,
                          carga: d.carga || 1,
                          isBackpack: !!d.isBackpack,
                          cargaIncrease: d.cargaIncrease || 10,
                          category: d.category,
                          subtype: d.subtype,
                          hands: d.hands,
                          tpt: d.tpt || 1,
                          damage_multi: d.damage_multi,
                          damageType: d.damageType,
                          description: d.description
                        });
                        if (!error) {
                          showToast("Item Adicionado à Biblioteca!");
                          // Re-fetch library
                          const { data } = await supabase.from('items').select('*').order('name', { ascending: true });
                          setItemLibrary(data || []);
                          closeModal();
                        }
                      }
                    })}
                    className="w-full bg-yellow-500 text-black px-8 py-3 rounded-full font-black uppercase text-xs hover:scale-105 transition-all"
                  >
                    + Criar Novo Item
                  </button>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setIsListGeneratorOpen(true)}
                      className="flex-1 bg-zinc-800 text-zinc-400 border border-zinc-700 px-6 py-3 rounded-full font-black uppercase text-[10px] hover:text-white hover:border-zinc-500 transition-all"
                    >
                      Gerar Lista
                    </button>
                    <button
                      onClick={() => setModal({
                        isOpen: true,
                        title: "Importar Itens via Código",
                      input: true,
                      inputValue: '',
                      setInputValue: (v) => setModal(prev => ({ ...prev, inputValue: v })),
                      message: "Cole o código JSON do pacote de itens abaixo:",
                      onConfirm: async (json) => {
                        try {
                          if (!json || typeof json !== 'string') throw new Error("Entrada inválida.");
                          const items = JSON.parse(json.trim());
                          const itemsArray = Array.isArray(items) ? items : [items];

                          const preparedItems = itemsArray.map(itemData => ({
                            item_id: itemData.item_id,
                            name: itemData.name,
                            type: itemData.type || 'Item',
                            rarity: itemData.rarity || 'Comum',
                            value: itemData.value || 0,
                            carga: itemData.weight !== undefined ? itemData.weight : (itemData.carga !== undefined ? itemData.carga : 1),
                            category: itemData.category || 'Utilitário',
                            subtype: itemData.subtype || null,
                            hands: itemData.hands || 'Uma Mão',
                            tpt: itemData.tpt || 1,
                            damage_multi: itemData.damage_multi !== undefined ? itemData.damage_multi : 1.0,
                            damageType: itemData.damageType || null,
                            description: itemData.description || null,
                            tier: itemData.tier !== undefined ? (typeof itemData.tier === 'string' ? parseInt(itemData.tier.replace(/D/g, '')) : itemData.tier) : 1,
                            upgrade: itemData.upgrade || 0,
                            isBackpack: !!itemData.isBackpack,
                            cargaIncrease: itemData.cargaIncrease || 10
                          }));

                          const { error } = await supabase.from('items').insert(preparedItems);
                          if (error) throw error;

                          showToast(`${preparedItems.length} Itens Importados!`);
                          const { data } = await supabase.from('items').select('*').order('name', { ascending: true });
                          setItemLibrary(data || []);
                          closeModal();
                        } catch (err) {
                          showToast(`Erro na importação: ${err.message}`);
                        }
                      }
                    })}
                    className="flex-1 bg-zinc-800 text-zinc-400 border border-zinc-700 px-6 py-3 rounded-full font-black uppercase text-[10px] hover:text-white hover:border-zinc-500 transition-all"
                  >
                    { } Importar Código
                  </button>
                </div>
              </div>
              </div>

              <div className="bg-zinc-900/50 p-10 rounded-[40px] border border-zinc-800">
                <div className="grid grid-cols-3 gap-6">
                  {['Item', 'Equipamento', 'Consumível'].map(cat => (
                    <div key={cat} className="space-y-4">
                      <h3 className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.3em] italic border-b border-white/5 pb-2">{cat}s</h3>
                      <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                        {itemLibrary
                          .filter(i => (i.type || 'Item') === cat)
                          .filter(i => {
                            const search = searchTerm.toLowerCase().replace(/s/g, '');
                            const name = i.name.toLowerCase().replace(/s/g, '');
                            return name.includes(search);
                          })
                          .map(item => (
                            <div
                              key={item.id}
                              onClick={() => setModal({
                                isOpen: true,
                                title: "Editar Item Global",
                                fields: true,
                                forcedCustom: true,
                                initialData: item,
                                rarityConfig: RARITY_CONFIG,
                                onConfirm: async (d) => {
                                  const { error } = await supabase.from('items').update({
                                    name: d.name,
                                    type: d.type,
                                    rarity: d.rarity,
                                    value: d.value,
                                    carga: d.carga || 1,
                                    isBackpack: !!d.isBackpack,
                                    cargaIncrease: d.cargaIncrease || 10,
                                    category: d.category,
                                    subtype: d.subtype,
                                    hands: d.hands,
                                    tpt: d.tpt || 1,
                                    damage_multi: d.damage_multi,
                                    damageType: d.damageType,
                                    description: d.description
                                  }).eq('id', item.id);
                                  if (!error) {
                                    showToast("Item Atualizado!");
                                    const { data } = await supabase.from('items').select('*').order('name', { ascending: true });
                                    setItemLibrary(data || []);
                                    closeModal();
                                  }
                                },
                                onDelete: async () => {
                                  const { error } = await supabase.from('items').delete().eq('id', item.id);
                                  if (!error) {
                                    // REMOVE FROM LOOT TABLES
                                    const updatedLootTables = lootTables.map(lt => ({
                                      ...lt,
                                      items: lt.items.filter(i => i.item_id !== item.item_id)
                                    }));

                                    // Batch update loot tables in supabase
                                    for (const lt of updatedLootTables) {
                                      await supabase.from('loot_tables').update({ items: lt.items }).eq('id', lt.id);
                                    }

                                    setLootTables(updatedLootTables);
                                    showToast("Item Removido e Tabelas de Loot atualizadas!");
                                    const { data } = await supabase.from('items').select('*').order('name', { ascending: true });
                                    setItemLibrary(data || []);
                                    closeModal();
                                  }
                                }
                              })}
                              className="p-3 bg-black/40 rounded-xl border border-white/5 hover:border-yellow-500/50 cursor-pointer transition-all flex justify-between items-center group"
                            >
                              <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-white group-hover:text-yellow-500 transition-colors">{item.name}</span>
                                <span className={`text-[8px] font-black uppercase tracking-tighter ${RARITY_CONFIG[item.rarity]?.color}`}>{item.rarity}</span>
                              </div>
                              <span className="text-[9px] font-mono font-bold text-zinc-600 group-hover:text-zinc-400">{item.value}$</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'loot' && isActingAsMaster && (
          <div className="p-12">
            <div className="max-w-4xl mx-auto space-y-8">
              <div className="flex justify-between items-center bg-zinc-900/50 p-8 rounded-[40px] border border-zinc-800">
                <div className="flex-1 pr-8">
                  <h2 className="text-4xl font-black italic text-white uppercase tracking-tighter">Tabelas de Loot</h2>
                  <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mt-2">Configuração de Recompensas</p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setEditingLootTable(null);
                      setIsLootModalOpen(true);
                    }}
                    className="bg-yellow-500 text-black px-8 py-3 rounded-full font-black uppercase text-xs hover:scale-105 transition-all"
                  >
                    + Nova Tabela
                  </button>
                  <button
                    onClick={() => setModal({
                      isOpen: true,
                      title: "Importar Loot Tables via Código",
                      input: true,
                      inputValue: '',
                      setInputValue: (v) => setModal(prev => ({ ...prev, inputValue: v })),
                      message: "Cole o código JSON das loot tables abaixo:",
                      onConfirm: async (json) => {
                        try {
                          if (!json || typeof json !== 'string') throw new Error("Entrada inválida.");
                          const tables = JSON.parse(json.trim());
                          const tablesArray = Array.isArray(tables) ? tables : [tables];

                          const preparedTables = tablesArray.map(t => ({
                            name: t.name,
                            min_rolls: t.min_rolls || 1,
                            max_rolls: t.max_rolls || 1,
                            min_extra_rolls: t.min_extra_rolls || 0,
                            max_extra_rolls: t.max_extra_rolls || 0,
                            extra_roll_chance: t.extra_roll_chance || 0,
                            items: t.items || []
                          }));

                          const { error } = await supabase.from('loot_tables').insert(preparedTables);
                          if (error) throw error;

                          showToast(`${preparedTables.length} Loot Tables Importadas!`);
                          const { data } = await supabase.from('loot_tables').select('*').order('name', { ascending: true });
                          setLootTables(data || []);
                          closeModal();
                        } catch (err) {
                          showToast(`Erro na importação: ${err.message}`);
                        }
                      }
                    })}
                    className="bg-zinc-800 text-zinc-400 border border-zinc-700 px-6 py-3 rounded-full font-black uppercase text-[10px] hover:text-white hover:border-zinc-500 transition-all"
                  >
                    Importar Código
                  </button>
                </div>
              </div>

              <div className="bg-zinc-900/50 p-10 rounded-[40px] border border-zinc-800">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {lootTables.map(lt => (
                    <div key={lt.id}
                      onClick={() => {
                        setEditingLootTable(lt);
                        setIsLootModalOpen(true);
                      }}
                      className="p-4 bg-black/40 rounded-2xl border border-white/5 flex justify-between items-center group hover:border-yellow-500/50 transition-all cursor-pointer"
                    >
                      <div>
                        <p className="text-sm font-black text-white">{lt.name}</p>
                        <p className="text-[9px] text-zinc-500 font-bold uppercase">{lt.items?.length || 0} Itens • ${lt.min_rolls}-${lt.max_rolls} Rolls</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingLootTable(lt);
                            setIsLootModalOpen(true);
                          }}
                          className="text-[10px] font-black text-zinc-600 hover:text-white uppercase"
                        >
                          Editar
                        </button>
                        <button onClick={(e) => {
                          e.stopPropagation();
                          setModal({
                            isOpen: true,
                            title: "Excluir Tabela",
                            message: `Deseja excluir a tabela "${lt.name}"? Esta ação é irreversível.`,
                            type: 'danger',
                            onConfirm: async () => {
                              await supabase.from('loot_tables').delete().eq('id', lt.id);
                              setLootTables(prev => prev.filter(t => t.id !== lt.id));
                              showToast("Tabela excluída.");
                              closeModal();
                            }
                          });
                        }} className="text-[10px] font-black text-red-900 hover:text-red-500 uppercase">Excluir</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'npcs' && (
          <div className="p-12">
            <NPCEditor
              isActingAsMaster={isActingAsMaster}
              showToast={showToast}
              setModal={setModal}
              closeModal={closeModal}
              onVisualizeComplex={(npc) => {
                setViewingTarget(npc.id);
                setCharacter(npc);
                setTempChar(npc);
                setActiveTab('sheet');
              }}
            />
          </div>
        )}

        <Toast toasts={toasts} setToasts={setToasts} />
        <Modal modal={modal} closeModal={closeModal} />
        <ItemsListGeneratorModal
          isOpen={isListGeneratorOpen}
          closeModal={() => setIsListGeneratorOpen(false)}
          library={itemLibrary}
          showToast={showToast}
        />
        <LootTableEditorModal
          isOpen={isLootModalOpen}
          closeModal={() => {
            setIsLootModalOpen(false);
            // Re-fetch loot tables after closing to see new entries
            supabase.from('loot_tables').select('*').order('name', { ascending: true })
              .then(({ data }) => setLootTables(data || []));
          }}
          library={itemLibrary}
          showToast={showToast}
          initialData={editingLootTable}
        />
        <Celebration active={showCelebration} />
        {activeTab === 'home' && (
          <NotificationSystem 
            user={user} 
            isActingAsMaster={isActingAsMaster} 
            showToast={showToast} 
          />
        )}
        <MusicPlayer isMaster={isActingAsMaster} currentVolume={volume} />
      </section>
    </main>
  );
}

// HELPERS (OUTSIDE Home to prevent focus loss)
const NavButton = ({ label, active, onClick, disabled, isUnapproved, isNPC, isBlocked }) => (
  <button
    onClick={onClick}
    className={`text-left px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all relative overflow-hidden
      ${active ? (isNPC ? 'bg-zinc-100 text-black' : 'bg-red-600 text-white') : 'text-zinc-500 hover:text-zinc-200'}
      ${disabled ? 'opacity-30 grayscale cursor-not-allowed' : 'cursor-pointer'}
      ${isUnapproved ? 'border border-dashed border-zinc-800' : ''}`}
  >
    <div className="flex items-center gap-2">
      {isNPC && <span className="text-[8px] bg-black/20 px-1.5 py-0.5 rounded border border-white/5 text-zinc-400">NPC</span>}
      <span className="truncate">{label}</span>
      {isBlocked && <span className="ml-auto">🔒</span>}
    </div>
    {isUnapproved && <span className="text-[8px] opacity-50 block mt-0.5">(NÃO APROVADO)</span>}
    {isNPC && active && <div className="absolute inset-y-0 right-0 w-1 bg-red-600" />}
  </button>
);

const StatBox = ({ label, value, color, textColor }) => (
  <div className={`bg-black/40 p-5 rounded-2xl border-2 ${color} shadow-lg shrink-0`}><p className={`text-[10px] ${textColor} font-black italic mb-1`}>{label}</p><p className="text-4xl font-black">{value}</p></div>
);

const StatLine = ({ label, statKey, val, isEditing, handleStatChange, getPerc, isSpecial = false, activeChar }) => {
  const v = val ?? 3;
  const perc = getPerc(v);
  const getStatColor = (p) => {
    const pf = parseFloat(p);
    if (pf >= 20) return 'text-cyan-400';
    if (pf > 11.5) return 'text-green-400';
    if (pf >= 8.5) return 'text-yellow-400';
    return 'text-red-700';
  };

  const buffs = activeChar ? getStatBuffs(activeChar, statKey) : [];
  const hasBuffs = buffs.length > 0;
  const tooltipText = buffs.map(b => `(${b.source}) ${b.amount > 0 ? '+' : ''}${(b.amount * 100).toFixed(0)}%`).join('\n');

  return (
    <li className="flex justify-between items-center py-2 border-b border-white/5 last:border-0 uppercase font-bold text-xs">
      <span className="text-zinc-500">{label}</span>
      <div className="flex gap-3 items-center">
        <span className={`text-[11px] font-mono font-bold ${isSpecial ? getStatColor(perc) : 'text-zinc-500'}`}>{perc}%</span>
        {isEditing ? (
          <div className="flex items-center bg-black/40 rounded border border-white/10 overflow-hidden">
            <button onClick={() => handleStatChange(statKey, v - 1)} className="px-3 py-1 hover:bg-white/10">-</button>
            <input
              type="number"
              value={val ?? ""}
              onChange={(e) => handleStatChange(statKey, e.target.value)}
              onFocus={(e) => e.target.select()} // Bonus: selects all text when you click the box
              className="w-10 text-center bg-transparent font-bold text-yellow-500 text-sm outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <button onClick={() => handleStatChange(statKey, v + 1)} className="px-3 py-1 hover:bg-white/10">+</button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <span className="text-yellow-500 font-mono text-lg">{v}</span>
            <TooltipWrapper text={hasBuffs ? tooltipText : null}>
              <span className={`text-[12px] font-black cursor-default transition-colors ${hasBuffs ? 'text-green-500 cursor-help' : 'text-zinc-600'}`}>
                (?)
              </span>
            </TooltipWrapper>
          </div>
        )}
      </div>
    </li>
  );
};

const getEmoji = (desc) => {
  if (!desc || desc === "Sem descrição.") return null;
  const firstWord = desc.split(" ")[0];
  return !/[a-zA-Z0-9]/.test(firstWord) ? firstWord : null;
};

const TagBox = ({ label, list, activeList, field, isEditing, setTempChar, descriptions, color = "text-gray-300 bg-white/5 border-white/5" }) => (
  <div className="p-4 bg-black/20 rounded-2xl border border-white/5">
    <div className="flex justify-between items-center mb-3">
      <span className="text-zinc-500 text-[9px] font-black italic uppercase leading-none">{label}:</span>
      {isEditing && (
        <div className="w-28">
          <CustomSelect
            value=""
            placeholder="ADICIONAR..."
            className="bg-zinc-800 text-[10px] rounded px-2 py-1 w-full outline-none cursor-pointer flex justify-between items-center"
            dropdownClassName="absolute z-[100] top-full left-0 w-full mt-1 bg-zinc-900 border border-white/10 rounded shadow-2xl py-1 max-h-60 overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-top-1 duration-200"
            options={list.filter(x => !(activeList || []).includes(x))}
            descriptions={descriptions}
            onChange={(val) => {
              if (val && !(activeList || []).includes(val)) {
                setTempChar(p => ({ ...p, [field]: [...(activeList || []), val] }));
              }
            }}
          />
        </div>
      )}
    </div>
    <div className="flex flex-wrap gap-2">
      {(activeList || []).length > 0 ? activeList.map((x, i) => {
        const desc = descriptions?.[x];
        const emoji = getEmoji(desc);
        return (
          <TooltipWrapper key={i} text={desc || "Sem descrição."}>
            <span className={`text-[10px] italic px-2 py-1 rounded border flex items-center gap-2 ${color} leading-none`}>
              {emoji ? `${emoji} ${x}` : x}
              {isEditing && (
                <button onClick={() => setTempChar(p => ({ ...p, [field]: activeList.filter(y => y !== x) }))} className="text-red-500 ml-1">×</button>
              )}
            </span>
          </TooltipWrapper>
        );
      }) : (<p className="text-[10px] text-zinc-600 italic uppercase">Nenhum</p>)}
    </div>
  </div>
);
