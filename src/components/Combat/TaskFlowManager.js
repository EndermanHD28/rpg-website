"use client";
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { calculateDerivedStats } from '../../lib/rpg-math';

const TASK_TYPES = {
  music: { label: 'Música', emoji: '🎵', color: 'text-purple-400 border-purple-500/30 bg-purple-500/10' },
  combat: { label: 'Iniciar Combate', emoji: '⚔️', color: 'text-red-400 border-red-500/30 bg-red-500/10' },
  combatant: { label: 'Adicionar Combatente', emoji: '👤', color: 'text-blue-400 border-blue-500/30 bg-blue-500/10' },
  sfx: { label: 'Efeito Sonoro', emoji: '🔊', color: 'text-amber-400 border-amber-500/30 bg-amber-500/10' },
  wait: { label: 'Esperar', emoji: '⏳', color: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10' },
  image: { label: 'Imagem', emoji: '🖼️', color: 'text-pink-400 border-pink-500/30 bg-pink-500/10' },
  revealImage: { label: 'Revelar Imagem', emoji: '🔍', color: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10' },
  hideImage: { label: 'Ocultar Imagem', emoji: '🙈', color: 'text-zinc-400 border-zinc-500/30 bg-zinc-500/10' }
};

export default function TaskFlowManager({
  isActingAsMaster,
  allPlayers,
  allNPCs,
  combatants,
  isCombatActive,
  showToast
}) {
  const [flows, setFlows] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [editingFlow, setEditingFlow] = useState(null); // { id, name, tasks }
  const [runningFlowId, setRunningFlowId] = useState(null);
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0);
  const [dragIndex, setDragIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [sfxList, setSfxList] = useState({ builtIn: [], soundEffects: [] });
  const [showAddTaskMenu, setShowAddTaskMenu] = useState(false);
  const [editingTaskIndex, setEditingTaskIndex] = useState(null);
  const [taskDraft, setTaskDraft] = useState(null);
  const [showCombatantPicker, setShowCombatantPicker] = useState(false);
  const [combatantSearch, setCombatantSearch] = useState('');
  const [showEffectPicker, setShowEffectPicker] = useState(false);
  const [showSfxPicker, setShowSfxPicker] = useState(false);
  const [sfxSearch, setSfxSearch] = useState('');
  const [sfxCategory, setSfxCategory] = useState('playable');
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionLog, setExecutionLog] = useState([]);
  const [showExecutionLog, setShowExecutionLog] = useState(false);
  const [flowName, setFlowName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Fetch SFX list for master
  useEffect(() => {
    if (isActingAsMaster) {
      fetch('/api/sounds')
        .then(res => res.json())
        .then(data => setSfxList(data))
        .catch(err => console.error("Error fetching sounds:", err));
    }
  }, [isActingAsMaster]);

  // Load task flows from global table
  const loadFlows = useCallback(async () => {
    if (!isActingAsMaster) return;
    const { data, error } = await supabase.from('global').select('task_flows').eq('id', 1).maybeSingle();
    if (error) {
      console.error("Error loading task flows:", error);
      return;
    }
    setFlows(data?.task_flows || []);
  }, [isActingAsMaster]);

  useEffect(() => {
    loadFlows();
  }, [loadFlows]);

  // Subscribe to realtime updates for task_flows
  useEffect(() => {
    if (!isActingAsMaster) return;
    const channel = supabase
      .channel('task_flows_sync')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'global', filter: 'id=eq.1' }, (p) => {
        if (p.new?.task_flows !== undefined) {
          setFlows(p.new.task_flows || []);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isActingAsMaster]);

  const saveFlows = async (newFlows) => {
    const { error } = await supabase.from('global').update({ task_flows: newFlows }).eq('id', 1);
    if (error) {
      console.error("Error saving task flows:", error);
      showToast("Erro ao salvar fluxos de tarefas.");
      return false;
    }
    setFlows(newFlows);
    return true;
  };

  const createFlow = () => {
    const newFlow = {
      id: `flow_${Date.now()}`,
      name: "Novo Fluxo",
      tasks: []
    };
    setEditingFlow(newFlow);
    setFlowName("Novo Fluxo");
    setShowAddTaskMenu(false);
  };

  const updateFlow = async () => {
    if (!editingFlow) return;
    setIsSaving(true);
    const updatedFlow = { ...editingFlow, name: flowName || "Fluxo sem nome" };
    const exists = flows.some(f => f.id === updatedFlow.id);
    const newFlows = exists
      ? flows.map(f => f.id === updatedFlow.id ? updatedFlow : f)
      : [...flows, updatedFlow];
    await saveFlows(newFlows);
    setIsSaving(false);
    setEditingFlow(null);
    setShowAddTaskMenu(false);
    setEditingTaskIndex(null);
    setTaskDraft(null);
    showToast("Fluxo salvo!");
  };

  const deleteFlow = async (flowId) => {
    const newFlows = flows.filter(f => f.id !== flowId);
    await saveFlows(newFlows);
    if (editingFlow?.id === flowId) {
      setEditingFlow(null);
      setShowAddTaskMenu(false);
    }
    showToast("Fluxo excluído.");
  };

  const addTask = (type) => {
    if (!editingFlow) return;
    const newTask = { id: `task_${Date.now()}`, type };
    if (type === 'music') {
      newTask.url = '';
    } else if (type === 'combat') {
      // No extra fields needed
    } else if (type === 'combatant') {
      newTask.combatantId = null;
      newTask.combatantName = '';
      newTask.isEnemy = true;
      newTask.startingHp = '';
      newTask.startingPosture = '';
      newTask.effectKey = null;
      newTask.effectDuration = 2;
    } else if (type === 'sfx') {
      newTask.sfxPath = '';
      newTask.sfxName = '';
      newTask.sfxLoop = false;
      newTask.sfxVolume = 1.0;
      newTask.sfxDuration = 30;
    } else if (type === 'wait') {
      newTask.waitSeconds = 2;
    } else if (type === 'image') {
      newTask.imageUrl = '';
    } else if (type === 'revealImage') {
      newTask.imageUrl = '';
      newTask.imageTitle = '';
      newTask.imageContrast = false;
    } else if (type === 'hideImage') {
      // No extra fields needed
    }
    setEditingFlow(prev => ({ ...prev, tasks: [...prev.tasks, newTask] }));
    setShowAddTaskMenu(false);
    setEditingTaskIndex(editingFlow.tasks.length);
    setTaskDraft(newTask);
  };

  const updateTask = (index, updates) => {
    if (!editingFlow) return;
    setEditingFlow(prev => ({
      ...prev,
      tasks: prev.tasks.map((t, i) => i === index ? { ...t, ...updates } : t)
    }));
    if (editingTaskIndex === index) {
      setTaskDraft(prev => prev ? { ...prev, ...updates } : prev);
    }
  };

  const deleteTask = (index) => {
    if (!editingFlow) return;
    setEditingFlow(prev => ({
      ...prev,
      tasks: prev.tasks.filter((_, i) => i !== index)
    }));
    if (editingTaskIndex === index) {
      setEditingTaskIndex(null);
      setTaskDraft(null);
    } else if (editingTaskIndex !== null && editingTaskIndex > index) {
      setEditingTaskIndex(editingTaskIndex - 1);
    }
  };

  const moveTask = (fromIndex, toIndex) => {
    if (!editingFlow) return;
    setEditingFlow(prev => {
      const tasks = [...prev.tasks];
      const [moved] = tasks.splice(fromIndex, 1);
      tasks.splice(toIndex, 0, moved);
      return { ...prev, tasks };
    });
  };

  const moveFlow = (fromIndex, toIndex) => {
    const newFlows = [...flows];
    const [moved] = newFlows.splice(fromIndex, 1);
    newFlows.splice(toIndex, 0, moved);
    setFlows(newFlows);
    saveFlows(newFlows);
  };

  // --- EXECUTION LOGIC ---
  const executeTask = async (task, index) => {
    setCurrentTaskIndex(index);
    const logEntry = { index, task, status: 'running', message: '' };
    setExecutionLog(prev => [...prev, logEntry]);

    try {
      if (task.type === 'music') {
        if (!task.url) {
          throw new Error("URL de música não definida");
        }
        await supabase.from('global').update({
          music_url: task.url,
          music_timestamp: 0,
          music_started_at: new Date().toISOString(),
          music_playing: true
        }).eq('id', 1);
        updateLogEntry(index, 'success', `Música tocando: ${task.url}`);
      } else if (task.type === 'combat') {
        if (!isCombatActive) {
          // Apply initial focus to all active combatants
          for (const p of combatants) {
            const learnedSkills = Array.isArray(p.breathing_skills) ? p.breathing_skills : [];
            if (!p.is_enemy && learnedSkills.includes('skill_0')) {
              const table = p.is_npc ? 'npcs' : 'characters';
              const dbId = p.is_npc ? p.dbId : p.id;
              const { maxFocus } = calculateDerivedStats(p);
              const currentFocus = p.current_focus || 0;
              await supabase.from(table).update({ current_focus: Math.min(currentFocus, maxFocus) }).eq('id', dbId);
            }
          }
          await supabase.from('global').update({ is_combat_active: true, current_turn: 1 }).eq('id', 1);
          updateLogEntry(index, 'success', 'Combate iniciado!');
        } else {
          updateLogEntry(index, 'success', 'Combate já estava ativo.');
        }
      } else if (task.type === 'combatant') {
        if (!task.combatantId) {
          throw new Error("Combatente não selecionado");
        }
        const isNpc = task.combatantId.startsWith('npc-');
        const table = isNpc ? 'npcs' : 'characters';
        const dbId = isNpc ? task.combatantId.replace('npc-', '') : task.combatantId;
        
        const entity = isNpc
          ? allNPCs.find(n => n.id === dbId)
          : allPlayers.find(p => p.id === task.combatantId);
        
        if (!entity) {
          throw new Error("Combatente não encontrado");
        }

        const derived = calculateDerivedStats(entity);
        const update = {
          is_in_combat: true,
          is_enemy: task.isEnemy,
          current_hp: task.startingHp ? parseInt(task.startingHp) : derived.life,
          current_posture: task.startingPosture ? parseInt(task.startingPosture) : derived.posture
        };

        // Add starting effect if specified
        if (task.effectKey) {
          const { EFFECTS } = await import('../../constants/gameData');
          const effectTemplate = EFFECTS[task.effectKey];
          if (effectTemplate) {
            const currentEffects = Array.isArray(entity.effects) ? entity.effects : [];
            const newEffect = {
              ...effectTemplate,
              key: task.effectKey,
              duration: parseInt(task.effectDuration) || 2,
              addedAtTurn: 1
            };
            update.effects = [...currentEffects, newEffect];
          }
        }

        await supabase.from(table).update(update).eq('id', dbId);
        updateLogEntry(index, 'success', `${entity.char_name || entity.name} adicionado ao combate!`);
      } else if (task.type === 'sfx') {
        if (!task.sfxPath) {
          throw new Error("Efeito sonoro não selecionado");
        }
        const triggeredAt = new Date().toISOString();
        await supabase.from('global').update({
          sfx_url: task.sfxPath,
          sfx_triggered_at: triggeredAt,
          sfx_loop: task.sfxLoop,
          sfx_volume: task.sfxVolume,
          sfx_duration: task.sfxDuration
        }).eq('id', 1);
        updateLogEntry(index, 'success', `Efeito sonoro: ${task.sfxName || task.sfxPath}`);
      } else if (task.type === 'wait') {
        const seconds = Math.max(0, parseInt(task.waitSeconds) || 0);
        await new Promise(resolve => setTimeout(resolve, seconds * 1000));
        updateLogEntry(index, 'success', `Aguardou ${seconds}s`);
      } else if (task.type === 'image') {
        if (!task.imageUrl) {
          throw new Error("URL da imagem não definida");
        }
        // Send image in chat using the same IMAGE|url|w|h format as handleImageUpload
        const masterChar = allPlayers.find(p => p.rank === 'Mestre');
        const playerName = masterChar?.char_name || "SISTEMA";
        
        // Load image to get dimensions
        const dimensions = await new Promise((resolve) => {
          const img = new Image();
          img.src = task.imageUrl;
          img.onload = () => resolve({ width: img.width, height: img.height });
          img.onerror = () => resolve({ width: 0, height: 0 });
        });
        
        await supabase.from('messages').insert({
          player_name: playerName,
          content: `IMAGE|${task.imageUrl}|${dimensions.width}|${dimensions.height}`
        });
        updateLogEntry(index, 'success', `Imagem enviada no chat`);
      } else if (task.type === 'revealImage') {
        if (!task.imageUrl) {
          throw new Error("URL da imagem não definida");
        }
        // Same mechanism as /addimage command - updates global table
        await supabase.from('global').update({
          image_url: task.imageUrl,
          image_title: task.imageTitle || null,
          image_contrast: task.imageContrast || false
        }).eq('id', 1);
        updateLogEntry(index, 'success', `Imagem revelada: ${task.imageTitle || task.imageUrl}${task.imageContrast ? ' (Contraste)' : ''}`);
      } else if (task.type === 'hideImage') {
        // Same mechanism as /hideimage command - clears the global image
        await supabase.from('global').update({
          image_url: null,
          image_title: null,
          image_contrast: false
        }).eq('id', 1);
        updateLogEntry(index, 'success', 'Imagem ocultada');
      }
    } catch (err) {
      updateLogEntry(index, 'error', err.message || "Erro ao executar tarefa");
      throw err;
    }
  };

  const updateLogEntry = (index, status, message) => {
    setExecutionLog(prev => prev.map((entry, i) => 
      entry.index === index ? { ...entry, status, message } : entry
    ));
  };

  const runFlow = async (flow) => {
    if (isExecuting) return;
    setIsExecuting(true);
    setRunningFlowId(flow.id);
    setExecutionLog([]);
    setShowExecutionLog(true);
    setCurrentTaskIndex(0);

    // Execute all non-wait tasks in parallel (independently)
    // Wait tasks block execution until their duration passes
    const tasks = flow.tasks;
    const parallelPromises = [];
    let i = 0;
    while (i < tasks.length) {
      const task = tasks[i];
      if (task.type === 'wait') {
        // Wait task blocks - await it before continuing
        try {
          await executeTask(task, i);
        } catch (err) {
          console.error("Task flow execution error:", err);
          showToast(`Erro na tarefa ${i + 1}: ${err.message}`);
        }
        i++;
      } else {
        // Non-wait task - fire in parallel, don't await
        parallelPromises.push(
          executeTask(task, i).catch(err => {
            console.error("Task flow execution error:", err);
            showToast(`Erro na tarefa ${i + 1}: ${err.message}`);
          })
        );
        i++;
      }
    }

    // Wait for all parallel tasks to complete
    await Promise.all(parallelPromises);

    setIsExecuting(false);
    setRunningFlowId(null);
    setCurrentTaskIndex(0);
    showToast("Fluxo de tarefas concluído!");
  };

  const stopFlow = () => {
    setIsExecuting(false);
    setRunningFlowId(null);
    setCurrentTaskIndex(0);
  };

  // --- RENDER HELPERS ---
  const getTaskSummary = (task) => {
    switch (task.type) {
      case 'music':
        return task.url ? `🎵 ${task.url}` : '🎵 URL não definida';
      case 'combat':
        return '⚔️ Iniciar Combate';
      case 'combatant':
        return `👤 ${task.combatantName || 'Selecionar combatente'}${task.isEnemy ? ' (Inimigo)' : ' (Aliado)'}`;
      case 'sfx':
        return `🔊 ${task.sfxName || 'Selecionar efeito'}${task.sfxLoop ? ' (Loop)' : ''}`;
      case 'wait':
        return `⏳ Esperar ${task.waitSeconds || 0}s`;
      case 'image':
        return `🖼️ ${task.imageUrl ? 'Enviar imagem no chat' : 'URL não definida'}`;
      case 'revealImage':
        return `🔍 ${task.imageTitle || 'Revelar imagem'}${task.imageUrl ? '' : ' (URL não definida)'}${task.imageContrast ? ' (Contraste)' : ''}`;
      case 'hideImage':
        return '🙈 Ocultar imagem revelada';
      default:
        return 'Tarefa';
    }
  };

  const getTaskTypeInfo = (type) => TASK_TYPES[type] || TASK_TYPES.music;

  const renderTaskEditor = (task, index) => {
    const typeInfo = getTaskTypeInfo(task.type);
    return (
      <div className="bg-black/40 border border-white/10 rounded-xl p-4 space-y-3 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${typeInfo.color}`}>
              {typeInfo.emoji} {typeInfo.label}
            </span>
            <button
              onClick={() => { setEditingTaskIndex(null); setTaskDraft(null); }}
              className="text-[8px] font-black text-zinc-500 hover:text-white uppercase tracking-widest"
            >
              Fechar
            </button>
          </div>
          <button
            onClick={() => deleteTask(index)}
            className="text-[8px] font-black text-red-500/60 hover:text-red-500 uppercase tracking-widest"
          >
            Excluir
          </button>
        </div>

        {task.type === 'music' && (
          <div className="space-y-2">
            <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">URL do YouTube</label>
            <input
              type="text"
              value={task.url || ''}
              onChange={(e) => updateTask(index, { url: e.target.value })}
              placeholder="https://www.youtube.com/watch?v=..."
              className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-purple-500/50"
            />
          </div>
        )}

        {task.type === 'combat' && (
          <p className="text-[10px] text-zinc-500 italic">
            Inicia o combate se ainda não estiver ativo. Define o turno para 1.
          </p>
        )}

        {task.type === 'combatant' && (
          <div className="space-y-3">
            <div>
              <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-1 block">Combatente</label>
              <button
                onClick={() => { setShowCombatantPicker(true); setCombatantSearch(''); }}
                className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-xs text-left text-white hover:border-blue-500/50 transition-colors"
              >
                {task.combatantName || 'Selecionar combatente...'}
              </button>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => updateTask(index, { isEnemy: false })}
                className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${!task.isEnemy ? 'bg-green-600 text-white' : 'bg-zinc-900 text-zinc-500 hover:text-white'}`}
              >
                🛡️ Aliado
              </button>
              <button
                onClick={() => updateTask(index, { isEnemy: true })}
                className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${task.isEnemy ? 'bg-red-600 text-white' : 'bg-zinc-900 text-zinc-500 hover:text-white'}`}
              >
                💀 Inimigo
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-1 block">HP Inicial</label>
                <input
                  type="text"
                  value={task.startingHp || ''}
                  onChange={(e) => updateTask(index, { startingHp: e.target.value })}
                  placeholder="Auto"
                  className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-blue-500/50"
                />
              </div>
              <div>
                <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-1 block">Postura Inicial</label>
                <input
                  type="text"
                  value={task.startingPosture || ''}
                  onChange={(e) => updateTask(index, { startingPosture: e.target.value })}
                  placeholder="Auto"
                  className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-blue-500/50"
                />
              </div>
            </div>

            <div>
              <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-1 block">Efeito Inicial</label>
              <button
                onClick={() => { setShowEffectPicker(true); }}
                className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-xs text-left text-white hover:border-blue-500/50 transition-colors"
              >
                {task.effectKey ? getEffectName(task.effectKey) : 'Nenhum efeito'}
              </button>
              {task.effectKey && (
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="number"
                    value={task.effectDuration || 2}
                    onChange={(e) => updateTask(index, { effectDuration: parseInt(e.target.value) || 2 })}
                    className="w-20 bg-zinc-900 border border-white/10 rounded-lg px-2 py-1 text-xs text-white outline-none focus:border-blue-500/50"
                  />
                  <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">turnos</span>
                  <button
                    onClick={() => updateTask(index, { effectKey: null })}
                    className="ml-auto text-[8px] font-black text-red-500/60 hover:text-red-500 uppercase tracking-widest"
                  >
                    Remover
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {task.type === 'sfx' && (
          <div className="space-y-3">
            <div>
              <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-1 block">Efeito Sonoro</label>
              <button
                onClick={() => { setShowSfxPicker(true); setSfxSearch(''); }}
                className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-xs text-left text-white hover:border-amber-500/50 transition-colors"
              >
                {task.sfxName || 'Selecionar efeito sonoro...'}
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => updateTask(index, { sfxLoop: !task.sfxLoop })}
                className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${task.sfxLoop ? 'bg-amber-600 text-white' : 'bg-zinc-900 text-zinc-500 hover:text-white'}`}
              >
                {task.sfxLoop ? '🔁 Loop: ON' : '🔁 Loop: OFF'}
              </button>
              {task.sfxLoop && (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="300"
                    value={task.sfxDuration || 30}
                    onChange={(e) => updateTask(index, { sfxDuration: parseInt(e.target.value) || 30 })}
                    className="w-16 bg-zinc-900 border border-white/10 rounded-lg px-2 py-1 text-xs text-white outline-none focus:border-amber-500/50"
                  />
                  <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">seg</span>
                </div>
              )}
            </div>

            <div>
              <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-1 block">Volume: {Math.round((task.sfxVolume || 1.0) * 100)}%</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={task.sfxVolume || 1.0}
                onChange={(e) => updateTask(index, { sfxVolume: parseFloat(e.target.value) })}
                className="w-full custom-slider"
              />
            </div>
          </div>
        )}

        {task.type === 'wait' && (
          <div className="space-y-2">
            <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Duração (segundos)</label>
            <input
              type="number"
              min="0"
              max="300"
              value={task.waitSeconds || 0}
              onChange={(e) => updateTask(index, { waitSeconds: parseInt(e.target.value) || 0 })}
              className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-yellow-500/50"
            />
            <p className="text-[9px] text-zinc-500 italic">
              Bloqueia a execução do fluxo por este tempo antes de continuar.
            </p>
          </div>
        )}

        {task.type === 'image' && (
          <div className="space-y-2">
            <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">URL da Imagem</label>
            <input
              type="text"
              value={task.imageUrl || ''}
              onChange={(e) => updateTask(index, { imageUrl: e.target.value })}
              placeholder="https://exemplo.com/imagem.jpg"
              className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-pink-500/50"
            />
            <p className="text-[9px] text-zinc-500 italic">
              Envia a imagem no chat para todos os jogadores verem.
            </p>
          </div>
        )}

        {task.type === 'revealImage' && (
          <div className="space-y-2">
            <div>
              <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-1 block">URL da Imagem</label>
              <input
                type="text"
                value={task.imageUrl || ''}
                onChange={(e) => updateTask(index, { imageUrl: e.target.value })}
                placeholder="https://exemplo.com/imagem.jpg"
                className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-cyan-500/50"
              />
            </div>
            <div>
              <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-1 block">Título (opcional)</label>
              <input
                type="text"
                value={task.imageTitle || ''}
                onChange={(e) => updateTask(index, { imageTitle: e.target.value })}
                placeholder="Título da imagem..."
                className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-cyan-500/50"
              />
            </div>
            <button
              onClick={() => updateTask(index, { imageContrast: !task.imageContrast })}
              className={`w-full py-2 rounded-lg text-[9px] font-black uppercase transition-all ${task.imageContrast ? 'bg-cyan-600 text-white' : 'bg-zinc-900 text-zinc-500 hover:text-white'}`}
            >
              {task.imageContrast ? '⚡ Contraste: ON' : '⚡ Contraste: OFF'}
            </button>
            <p className="text-[9px] text-zinc-500 italic">
              Revela a imagem em destaque na tela para todos os jogadores, com título opcional. Contraste amplia a imagem temporariamente.
            </p>
          </div>
        )}

        {task.type === 'hideImage' && (
          <p className="text-[10px] text-zinc-500 italic">
            Oculta a imagem atualmente revelada em destaque na tela.
          </p>
        )}
      </div>
    );
  };

  const getEffectName = (key) => {
    const { EFFECTS } = require('../../constants/gameData');
    return EFFECTS[key]?.name || key;
  };

  const renderCombatantPicker = () => {
    const filteredPlayers = allPlayers.filter(p => {
      if (p.discord_username === 'EnderU' && p.rank === 'Mestre') return false;
      return p.char_name?.toLowerCase().includes(combatantSearch.toLowerCase());
    });
    const filteredNPCs = allNPCs.filter(n => 
      n.name?.toLowerCase().includes(combatantSearch.toLowerCase())
    );

    return (
      <div className="absolute inset-0 z-[120] bg-zinc-950 flex flex-col border-l border-white/10 animate-in slide-in-from-right duration-300">
        <div className="p-4 border-b border-white/5 flex items-center justify-between">
          <h3 className="text-[10px] font-black text-white uppercase tracking-[0.4em] italic">Selecionar Combatente</h3>
          <button onClick={() => setShowCombatantPicker(false)} className="text-zinc-500 hover:text-white transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="p-4 border-b border-white/5">
          <input
            type="text"
            placeholder="Pesquisar..."
            value={combatantSearch}
            onChange={(e) => setCombatantSearch(e.target.value)}
            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-blue-500/50"
          />
        </div>
        <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
          <div className="space-y-4">
            <div>
              <h4 className="text-[8px] font-black text-zinc-600 uppercase tracking-widest mb-2 px-2">Jogadores</h4>
              <div className="flex flex-col gap-1">
                {filteredPlayers.map(p => (
                  <button
                    key={p.id}
                    onClick={() => {
                      updateTask(editingTaskIndex, { combatantId: p.id, combatantName: p.char_name });
                      setShowCombatantPicker(false);
                    }}
                    className="flex items-center gap-3 p-2 rounded-lg border border-transparent hover:bg-white/10 hover:border-white/10 transition-all text-left"
                  >
                    <div className="w-8 h-8 rounded-md bg-zinc-800 overflow-hidden shrink-0 border border-white/10">
                      {p.image_url ? <img src={p.image_url} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full flex items-center justify-center text-[10px]">👤</div>}
                    </div>
                    <span className="text-[10px] font-bold uppercase truncate">{p.char_name}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-[8px] font-black text-zinc-600 uppercase tracking-widest mb-2 px-2">NPCs / Inimigos</h4>
              <div className="flex flex-col gap-1">
                {filteredNPCs.map(n => (
                  <button
                    key={n.id}
                    onClick={() => {
                      updateTask(editingTaskIndex, { combatantId: `npc-${n.id}`, combatantName: n.name });
                      setShowCombatantPicker(false);
                    }}
                    className="flex items-center gap-3 p-2 rounded-lg border border-transparent hover:bg-white/10 hover:border-white/10 transition-all text-left"
                  >
                    <div className="w-8 h-8 rounded-md bg-zinc-800 overflow-hidden shrink-0 border border-white/10">
                      {n.image_url ? <img src={n.image_url} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full flex items-center justify-center text-[10px]">👤</div>}
                    </div>
                    <div className="flex flex-col items-start min-w-0">
                      <span className="text-[10px] font-bold uppercase truncate">{n.name}</span>
                      <span className="text-[7px] text-zinc-500 uppercase">{n.category} • {n.type}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderEffectPicker = () => {
    const { EFFECTS } = require('../../constants/gameData');
    return (
      <div className="absolute inset-0 z-[120] bg-zinc-950 flex flex-col border-l border-white/10 animate-in slide-in-from-right duration-300">
        <div className="p-4 border-b border-white/5 flex items-center justify-between">
          <h3 className="text-[10px] font-black text-white uppercase tracking-[0.4em] italic">Selecionar Efeito</h3>
          <button onClick={() => setShowEffectPicker(false)} className="text-zinc-500 hover:text-white transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-2">
          <button
            onClick={() => {
              updateTask(editingTaskIndex, { effectKey: null });
              setShowEffectPicker(false);
            }}
            className="w-full flex items-center gap-3 p-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl transition-all"
          >
            <div className="w-10 h-10 shrink-0 flex items-center justify-center bg-black/40 rounded-lg text-xl border border-white/10">🚫</div>
            <span className="text-[10px] font-black text-white uppercase tracking-wider">Nenhum Efeito</span>
          </button>
          {Object.entries(EFFECTS).map(([key, eff]) => (
            <button
              key={key}
              onClick={() => {
                updateTask(editingTaskIndex, { effectKey: key });
                setShowEffectPicker(false);
              }}
              className="w-full flex items-center gap-3 p-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl transition-all group"
            >
              <div className="w-10 h-10 shrink-0 flex items-center justify-center bg-black/40 rounded-lg text-xl border border-white/10 group-hover:border-blue-500/50 transition-colors leading-none">{eff.emoji}</div>
              <div className="flex flex-col items-start min-w-0">
                <span className="text-[10px] font-black text-white uppercase tracking-wider truncate w-full">{eff.name}</span>
                <span className="text-[8px] text-zinc-500 font-medium line-clamp-2 leading-tight">{eff.description}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  };

  const renderSfxPicker = () => {
    const list = sfxCategory === 'playable' ? sfxList.soundEffects : sfxList.builtIn;
    const filtered = list.filter(s => s.toLowerCase().includes(sfxSearch.toLowerCase()));
    return (
      <div className="absolute inset-0 z-[120] bg-zinc-950 flex flex-col border-l border-white/10 animate-in slide-in-from-right duration-300">
        <div className="p-4 border-b border-white/5 flex items-center justify-between">
          <h3 className="text-[10px] font-black text-white uppercase tracking-[0.4em] italic">Selecionar Efeito Sonoro</h3>
          <button onClick={() => setShowSfxPicker(false)} className="text-zinc-500 hover:text-white transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="p-4 border-b border-white/5 space-y-3">
          <input
            type="text"
            placeholder="Pesquisar..."
            value={sfxSearch}
            onChange={(e) => setSfxSearch(e.target.value)}
            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-amber-500/50"
          />
          <div className="flex gap-2">
            <button
              onClick={() => setSfxCategory('playable')}
              className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${sfxCategory === 'playable' ? 'bg-amber-600 text-white' : 'bg-zinc-900 text-zinc-500 hover:text-white'}`}
            >
              Efeitos
            </button>
            <button
              onClick={() => setSfxCategory('builtIn')}
              className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${sfxCategory === 'builtIn' ? 'bg-amber-600 text-white' : 'bg-zinc-900 text-zinc-500 hover:text-white'}`}
            >
              Built-In
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          <div className="grid grid-cols-2 gap-2">
            {filtered.map(s => {
              const path = sfxCategory === 'playable' ? `/sound_effects/playable/${s}` : `/sound_effects/${s}`;
              return (
                <button
                  key={s}
                  onClick={() => {
                    updateTask(editingTaskIndex, { sfxPath: path, sfxName: s.split('.')[0] });
                    setShowSfxPicker(false);
                  }}
                  className="text-[9px] text-left px-3 py-2 rounded-lg bg-zinc-900/50 text-zinc-300 hover:bg-amber-600/20 hover:text-amber-400 border border-white/5 hover:border-amber-500/30 transition-all truncate"
                  title={s}
                >
                  🔊 {s.split('.')[0]}
                </button>
              );
            })}
            {filtered.length === 0 && <p className="text-[9px] text-zinc-600 italic col-span-2">Nenhum efeito encontrado</p>}
          </div>
        </div>
      </div>
    );
  };

  const renderFlowEditor = () => {
    if (!editingFlow) return null;
    return (
      <div className="absolute inset-0 z-[110] bg-zinc-950 flex flex-col border-l border-white/10 animate-in slide-in-from-right duration-300">
        <div className="p-4 border-b border-white/5 flex items-center justify-between">
          <h3 className="text-[10px] font-black text-white uppercase tracking-[0.4em] italic">Editar Fluxo</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={updateFlow}
              disabled={isSaving}
              className="px-4 py-1.5 bg-green-600 hover:bg-green-500 text-white text-[9px] font-black uppercase rounded-lg transition-all disabled:opacity-50"
            >
              {isSaving ? 'Salvando...' : 'Salvar'}
            </button>
            <button onClick={() => { setEditingFlow(null); setShowAddTaskMenu(false); setEditingTaskIndex(null); setTaskDraft(null); }} className="text-zinc-500 hover:text-white transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
        </div>

        <div className="p-4 border-b border-white/5">
          <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-1 block">Nome do Fluxo</label>
          <input
            type="text"
            value={flowName}
            onChange={(e) => setFlowName(e.target.value)}
            placeholder="Nome do fluxo..."
            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-red-500/50"
          />
        </div>

        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-3">
          {editingFlow.tasks.length === 0 && (
            <div className="text-center py-8 border border-dashed border-white/10 rounded-xl">
              <p className="text-[10px] text-zinc-600 uppercase font-black tracking-widest">Nenhuma tarefa adicionada</p>
            </div>
          )}

          {editingFlow.tasks.map((task, index) => (
            <div
              key={task.id}
              draggable
              onDragStart={() => setDragIndex(index)}
              onDragOver={(e) => { e.preventDefault(); setDragOverIndex(index); }}
              onDrop={() => {
                if (dragIndex !== null && dragIndex !== index) {
                  moveTask(dragIndex, index);
                }
                setDragIndex(null);
                setDragOverIndex(null);
              }}
              onDragEnd={() => { setDragIndex(null); setDragOverIndex(null); }}
              className={`space-y-2 transition-all ${dragOverIndex === index && dragIndex !== null ? 'opacity-50 border-t-2 border-t-red-500' : ''}`}
            >
              <div className={`flex items-center gap-2 p-3 rounded-xl border cursor-grab active:cursor-grabbing transition-all ${dragIndex === index ? 'opacity-50' : ''} ${getTaskTypeInfo(task.type).color}`}>
                <span className="text-zinc-600 text-[10px] font-black font-mono w-5">{index + 1}</span>
                <span className="text-sm">☰</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black text-white uppercase tracking-tight truncate">{getTaskSummary(task)}</p>
                </div>
                <button
                  onClick={() => {
                    if (editingTaskIndex === index) {
                      setEditingTaskIndex(null);
                      setTaskDraft(null);
                    } else {
                      setEditingTaskIndex(index);
                      setTaskDraft(task);
                    }
                  }}
                  className="p-1.5 text-zinc-500 hover:text-white transition-colors"
                  title="Editar tarefa"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                </button>
                <button
                  onClick={() => deleteTask(index)}
                  className="p-1.5 text-zinc-500 hover:text-red-500 transition-colors"
                  title="Excluir tarefa"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              </div>

              {editingTaskIndex === index && renderTaskEditor(task, index)}
            </div>
          ))}

          {showAddTaskMenu && (
            <div className="bg-black/40 border border-white/10 rounded-xl p-3 space-y-1 animate-in fade-in zoom-in-95 duration-200">
              <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-2 px-1">Adicionar Tarefa</p>
              {Object.entries(TASK_TYPES).map(([key, info]) => (
                <button
                  key={key}
                  onClick={() => addTask(key)}
                  className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/5 transition-all text-left"
                >
                  <span className="text-sm">{info.emoji}</span>
                  <span className="text-[10px] font-black text-zinc-300 uppercase tracking-tight">{info.label}</span>
                </button>
              ))}
            </div>
          )}

          <button
            onClick={() => setShowAddTaskMenu(!showAddTaskMenu)}
            className="w-full py-2.5 border border-dashed border-white/20 rounded-xl text-[9px] font-black text-zinc-500 hover:text-white hover:border-red-500/50 uppercase tracking-widest transition-all"
          >
            + Adicionar Tarefa
          </button>
        </div>
      </div>
    );
  };

  const renderExecutionLog = () => {
    if (!showExecutionLog) return null;
    return (
      <div className="absolute bottom-4 right-4 w-80 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl z-[130] overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
        <div className="p-3 border-b border-white/5 flex items-center justify-between">
          <h4 className="text-[9px] font-black text-white uppercase tracking-widest">Log de Execução</h4>
          <button onClick={() => setShowExecutionLog(false)} className="text-zinc-500 hover:text-white transition-colors">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="max-h-60 overflow-y-auto p-3 space-y-1.5 custom-scrollbar">
          {executionLog.length === 0 && (
            <p className="text-[9px] text-zinc-600 italic">Nenhuma tarefa executada ainda.</p>
          )}
          {executionLog.map((entry, i) => (
            <div key={i} className="flex items-start gap-2 text-[9px]">
              <span className={`font-black ${entry.status === 'success' ? 'text-green-500' : entry.status === 'error' ? 'text-red-500' : 'text-yellow-500 animate-pulse'}`}>
                {entry.status === 'success' ? '✓' : entry.status === 'error' ? '✗' : '…'}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-zinc-300 font-medium leading-tight">{entry.message || getTaskSummary(entry.task)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Main Panel */}
      {isOpen && isActingAsMaster && (
        <div className="absolute inset-0 z-[100] bg-zinc-950 flex flex-col border-l border-white/10 animate-in slide-in-from-right duration-300">
          <div className="p-4 border-b border-white/5 flex items-center justify-between">
            <h3 className="text-[10px] font-black text-white uppercase tracking-[0.4em] italic">Fluxos de Tarefas</h3>
            <button onClick={() => setIsOpen(false)} className="text-zinc-500 hover:text-white transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-3">
            {flows.length === 0 && (
              <div className="text-center py-8 border border-dashed border-white/10 rounded-xl">
                <p className="text-[10px] text-zinc-600 uppercase font-black tracking-widest">Nenhum fluxo criado</p>
                <p className="text-[8px] text-zinc-700 mt-1">Crie um fluxo para automatizar tarefas de combate</p>
              </div>
            )}

            {flows.map((flow, index) => (
              <div
                key={flow.id}
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragOver={(e) => { e.preventDefault(); setDragOverIndex(index); }}
                onDrop={() => {
                  if (dragIndex !== null && dragIndex !== index) {
                    moveFlow(dragIndex, index);
                  }
                  setDragIndex(null);
                  setDragOverIndex(null);
                }}
                onDragEnd={() => { setDragIndex(null); setDragOverIndex(null); }}
                className={`bg-zinc-900/50 border border-white/5 rounded-xl p-3 cursor-grab active:cursor-grabbing transition-all ${dragIndex === index ? 'opacity-50' : ''} ${dragOverIndex === index && dragIndex !== null ? 'border-t-2 border-t-red-500' : ''}`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm text-zinc-600">☰</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black text-white uppercase tracking-tight truncate">{flow.name}</p>
                    <p className="text-[8px] text-zinc-500">{flow.tasks.length} tarefas</p>
                  </div>
                  <button
                    onClick={() => runFlow(flow)}
                    disabled={isExecuting}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-[9px] font-black uppercase rounded-lg transition-all disabled:opacity-50 flex items-center gap-1"
                  >
                    {isExecuting && runningFlowId === flow.id ? (
                      <span className="animate-pulse">Executando...</span>
                    ) : (
                      <>▶ Executar</>
                    )}
                  </button>
                </div>

                <div className="mt-2 flex flex-wrap gap-1">
                  {flow.tasks.map((task, i) => (
                    <span key={task.id} className={`text-[7px] font-black uppercase tracking-tight px-1.5 py-0.5 rounded border ${getTaskTypeInfo(task.type).color}`}>
                      {getTaskTypeInfo(task.type).emoji}
                    </span>
                  ))}
                </div>

                <div className="mt-2 flex gap-1">
                  <button
                    onClick={() => { setEditingFlow(flow); setFlowName(flow.name); setShowAddTaskMenu(false); setEditingTaskIndex(null); setTaskDraft(null); }}
                    className="flex-1 py-1 bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white text-[8px] font-black uppercase rounded-lg transition-all"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => deleteFlow(flow.id)}
                    className="px-3 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-500 text-[8px] font-black uppercase rounded-lg transition-all"
                  >
                    Excluir
                  </button>
                </div>
              </div>
            ))}

            <button
              onClick={createFlow}
              className="w-full py-2.5 border border-dashed border-white/20 rounded-xl text-[9px] font-black text-zinc-500 hover:text-white hover:border-red-500/50 uppercase tracking-widest transition-all"
            >
              + Criar Novo Fluxo
            </button>
          </div>
        </div>
      )}

      {/* Flow Editor Overlay */}
      {renderFlowEditor()}

      {/* Combatant Picker */}
      {showCombatantPicker && renderCombatantPicker()}

      {/* Effect Picker */}
      {showEffectPicker && renderEffectPicker()}

      {/* SFX Picker */}
      {showSfxPicker && renderSfxPicker()}

      {/* Execution Log */}
      {renderExecutionLog()}

      {/* Floating Button */}
      {isActingAsMaster && (
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`fixed bottom-8 left-8 z-[200] w-14 h-14 rounded-full flex items-center justify-center transition-all duration-500 shadow-2xl group ${
            isOpen ? 'bg-red-600 scale-110' : 'bg-zinc-900 border border-white/10 hover:border-red-600/50 hover:scale-110'
          }`}
          title="Fluxos de Tarefas"
        >
          <span className="text-xl group-hover:scale-110 transition-transform">📋</span>
        </button>
      )}
    </>
  );
}