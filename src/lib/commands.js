/**
 * ITEM PACK CREATION INSTRUCTIONS:
 * When asked to create a "pack" or "bundle" of items:
 * 1. Define the items in a JSON array.
 * 2. Each item should follow the structure: { name, type, rarity, value, category, subtype, hands, damageType, description, tier, upgrade, isBackpack, cargaIncrease, weight }
 * 3. Instruct the user to copy the JSON and use the "Importar Código" button in the Item Library tab.
 */

import { supabase } from './supabase';
import { MASTER_DISCORD_ID } from '../constants/gameData';
import { calculateDerivedStats } from './rpg-math';

/**
 * Command Definition Structure:
 * {
 *   name: "combat start",
 *   args: [
 *     { name: "hp-percentage", type: "number", min: 0, max: 100 },
 *     { name: "players", type: "array" }
 *   ],
 *   execute: async (args, { user, allPlayers }) => { ... }
 * }
 */

export const COMMANDS = [
  {
    name: "combat start",
    description: "Starts a combat with selected players and sets their HP percentage",
    args: [
      { name: "hp-percentage", type: "number" },
      { name: "players", type: "array" }
    ],
    execute: async ([hpPerc, players], { allPlayers }) => {
      const playerIds = getPlayerIdsFromUsernames(players, allPlayers);
      
      // 1. Reset everyone
      await supabase.from('characters').update({ 
        is_in_combat: false, 
        effects: [],
        current_posture: null 
      }).not('id', 'is', null);

      await supabase.from('npcs').update({ 
        is_in_combat: false, 
        is_enemy: false, 
        effects: [],
        current_hp: null,
        current_posture: null 
      }).not('id', 'is', null);
      
      // 2. Set specified players
      for (const id of playerIds) {
        const p = allPlayers.find(pl => pl.id === id);
        const updateData = {
          is_in_combat: true,
          current_hp: calculateHP(p, hpPerc)
        };
        await supabase.from('characters').update(updateData).eq('id', id);
      }

      // 3. Set Master combat active
      await supabase.from('characters').update({ is_in_combat: true }).eq('discord_username', 'EnderU');

      // 4. Reset turn to 1 and activate combat
      await supabase.from('global').update({
        current_turn: 1,
        is_combat_active: true
      }).eq('id', 1);

      return { success: true, message: `Combat started with ${playerIds.length} players at ${hpPerc}% HP.` };
    }
  },
  {
    name: "combat add-c",
    description: "Adds specific players or NPCs to the ongoing combat",
    args: [
      { name: "hp-percentage", type: "number" },
      { name: "targets", type: "array" }
    ],
    execute: async ([hpPerc, targets], { allPlayers }) => {
      const { data: allNpcs } = await supabase.from('npcs').select('*');
      
      let addedCount = 0;
      for (const targetName of targets) {
        const cleanName = targetName.startsWith('@.') ? targetName.substring(2) : targetName;
        const normalizedTarget = cleanName.toLowerCase().trim();
        
        // 1. Try to find a player
        const player = allPlayers.find(p =>
          p.discord_username?.toLowerCase() === normalizedTarget ||
          p.char_name?.toLowerCase() === normalizedTarget
        );

        if (player) {
          await supabase.from('characters').update({
            is_in_combat: true,
            current_hp: calculateHP(player, hpPerc)
          }).eq('id', player.id);
          addedCount++;
          continue;
        }

        // 2. Try to find an NPC by ID or Name
        const npc = allNpcs?.find(n =>
          n.npc_id?.toLowerCase() === normalizedTarget ||
          n.name?.toLowerCase() === normalizedTarget
        );
        
        if (npc) {
          const { life: maxLife } = calculateDerivedStats(npc);
          await supabase.from('npcs').update({
            is_in_combat: true,
            current_hp: Math.floor((hpPerc / 100) * maxLife)
          }).eq('id', npc.id);
          addedCount++;
        }
      }
      return { success: true, message: `Added ${addedCount} combatants.` };
    }
  },
  {
    name: "combat add-e",
    description: "Adds NPCs to combat as ENEMIES (shown at the top)",
    args: [
      { name: "hp-percentage", type: "number" },
      { name: "targets", type: "array" }
    ],
    execute: async ([hpPerc, targets], { allPlayers }) => {
      const { data: allNpcs } = await supabase.from('npcs').select('*');
      
      let addedCount = 0;
      for (const targetName of targets) {
        const cleanName = targetName.startsWith('@.') ? targetName.substring(2) : targetName;
        const normalizedTarget = cleanName.toLowerCase().trim();
        
        const npc = allNpcs?.find(n =>
          n.npc_id?.toLowerCase() === normalizedTarget ||
          n.name?.toLowerCase() === normalizedTarget
        );
        
        if (npc) {
          const { life: maxLife } = calculateDerivedStats(npc);
          await supabase.from('npcs').update({
            is_in_combat: true,
            is_enemy: true,
            current_hp: Math.floor((hpPerc / 100) * maxLife)
          }).eq('id', npc.id);
          addedCount++;
        }
      }
      return { success: true, message: `Added ${addedCount} enemies.` };
    }
  },
  {
    name: "combat remove-e",
    description: "Removes NPCs from combat",
    args: [
      { name: "targets", type: "array" }
    ],
    execute: async ([targets], { allPlayers }) => {
      const { data: allNpcs } = await supabase.from('npcs').select('*');
      
      let removedCount = 0;
      for (const targetName of targets) {
        const cleanName = targetName.startsWith('@.') ? targetName.substring(2) : targetName;
        const normalizedTarget = cleanName.toLowerCase().trim();
        
        const npc = allNpcs?.find(n =>
          n.npc_id?.toLowerCase() === normalizedTarget ||
          n.name?.toLowerCase() === normalizedTarget
        );
        
        if (npc) {
          await supabase.from('npcs').update({
            is_in_combat: false,
            is_enemy: false,
            current_hp: null,
            effects: [],
            current_posture: null
          }).eq('id', npc.id);
          removedCount++;
        }
      }
      return { success: true, message: `Removed ${removedCount} enemies.` };
    }
  },
  {
    name: "combat add-effect",
    description: "Adds an effect to specified players",
    args: [
      { name: "players", type: "array" },
      { name: "effect", type: "string" },
      { name: "turns", type: "number", optional: true }
    ],
    execute: async ([targets, effectKey, turns], { allPlayers, allNPCs }) => {
      const { EFFECTS, EFFECT_ALIASES } = await import('../constants/gameData');
      const normalizedKey = effectKey.toLowerCase().trim();
      const actualKey = EFFECT_ALIASES[normalizedKey] || normalizedKey;
      const effect = EFFECTS[actualKey];
      
      if (!effect) return { success: false, message: `Effect "${effectKey}" not found.` };

      const cleanUsernames = targets.map(u => u.startsWith('@.') ? u.substring(2) : u);
      const normalizedTargets = cleanUsernames.map(u => u.toLowerCase().trim());
      
      let addedCount = 0;
      
      for (const targetName of normalizedTargets) {
        // 1. Find player or NPC
        let target = allPlayers.find(p => p.discord_username?.toLowerCase() === targetName || p.char_name?.toLowerCase() === targetName);
        let table = 'characters';
        
        if (!target) {
          target = allNPCs.find(n => n.npc_id?.toLowerCase() === targetName || n.name?.toLowerCase() === targetName);
          table = 'npcs';
        }

        if (target) {
          const currentEffects = Array.isArray(target.effects) ? target.effects : [];
          if (currentEffects.find(e => e.key === actualKey)) continue;

          const newEffects = [...currentEffects, { ...effect, key: actualKey, addedAtTurn: 0, duration: turns }];
          
          const { life: newMaxLife } = calculateDerivedStats({ ...target, effects: newEffects });

          const updateData = { effects: newEffects };
          if ((target.current_hp || newMaxLife) > newMaxLife) updateData.current_hp = newMaxLife;

          await supabase.from(table).update(updateData).eq('id', target.id);
          addedCount++;
        }
      }

      return { success: true, message: `Added ${effect.name} to ${addedCount} targets.` };
    }
  },
  {
    name: "combat remove-player",
    description: "Removes specific players from combat",
    args: [
      { name: "players", type: "array" }
    ],
    execute: async ([players], { allPlayers }) => {
      const { data: allNpcs } = await supabase.from('npcs').select('*');
      const cleanUsernames = players.map(u => u.startsWith('@.') ? u.substring(2) : u);
      const normalizedUsernames = cleanUsernames.map(u => u.toLowerCase().trim());

      const playerIds = allPlayers.filter(p => normalizedUsernames.includes(p.discord_username?.toLowerCase()) || normalizedUsernames.includes(p.char_name?.toLowerCase())).map(p => p.id);
      const npcIds = allNpcs.filter(n => normalizedUsernames.includes(n.npc_id?.toLowerCase()) || normalizedUsernames.includes(n.name?.toLowerCase())).map(n => n.id);

      if (playerIds.length > 0) await supabase.from('characters').update({ is_in_combat: false }).in('id', playerIds);
      if (npcIds.length > 0) await supabase.from('npcs').update({ is_in_combat: false }).in('id', npcIds);

      return { success: true, message: `Removed ${playerIds.length + npcIds.length} combatants.` };
    }
  },
  {
    name: "combat ko-player",
    description: "Instantly sets specified players' HP to 0",
    args: [
      { name: "players", type: "array" }
    ],
    execute: async ([players], { allPlayers }) => {
      const playerIds = getPlayerIdsFromUsernames(players, allPlayers);
      await supabase.from('characters').update({ current_hp: 0 }).in('id', playerIds);
      return { success: true, message: `KO'd ${playerIds.length} players.` };
    }
  },
  {
    name: "combat finish",
    description: "Ends the current combat session for everyone",
    args: [],
    execute: async () => {
      // 1. Reset everyone's combat status and effects
      await supabase.from('characters').update({ 
        is_in_combat: false, 
        effects: [],
        current_posture: null
      }).not('id', 'is', null);

      await supabase.from('npcs').update({ 
        is_in_combat: false, 
        is_enemy: false, 
        effects: [],
        current_hp: null,
        current_posture: null
      }).not('id', 'is', null);

      // 2. Reset global combat state
      await supabase.from('global').update({
        current_turn: 1,
        is_combat_active: false
      }).eq('id', 1);

      return { success: true, message: "Combat finished and all combatants cleaned." };
    }
  },
  {
    name: "help",
    description: "Shows all available commands and their descriptions",
    args: [],
    execute: async () => {
      const list = COMMANDS.map(c => `/${c.name}: ${c.description}`).join('\n');
      return { success: true, message: `Available Commands:\n${list}` };
    }
  },
  {
    name: "clear",
    description: "Clears all messages from the chat",
    args: [],
    execute: async () => {
      const { error } = await supabase.rpc('toggle_session', { status: true });
      if (error) return { success: false, message: `Error clearing chat: ${error.message}` };
      return { success: true, message: "Chat cleared via RPC." };
    }
  },
  {
    name: "setturn",
    description: "Sets the current combat turn",
    args: [
      { name: "turn", type: "number" }
    ],
    execute: async ([turn]) => {
      await supabase.from('global').update({ current_turn: turn }).eq('id', 1);
      
      return { success: true, message: `Turn set to ${turn}.` };
    }
  },
  {
    name: "addimage",
    description: "Displays an image for all players",
    args: [
      { name: "url", type: "string" },
      { name: "title", type: "string" },
      { name: "contrast", type: "boolean", optional: true }
    ],
    execute: async ([url, title, contrast]) => {
      const updateData = {
        image_url: url,
        image_title: title,
        image_contrast: contrast === undefined ? false : !!contrast
      };
      console.log("Executing addimage with:", updateData);
      const { error } = await supabase.from('global').update(updateData).eq('id', 1);
      if (error) {
        console.error("Supabase error in addimage:", error);
        return { success: false, message: `Error updating image: ${error.message}` };
      }
      return { success: true, message: `Image "${title}" displayed${contrast ? ' with contrast' : ''}.` };
    }
  },
  {
    name: "hideimage",
    description: "Hides the currently displayed image",
    args: [],
    execute: async () => {
      await supabase.from('global').update({
        image_url: null,
        image_title: null,
        image_contrast: false
      }).eq('id', 1);
      return { success: true, message: "Image hidden." };
    }
  }
];

const calculateHP = (p, hpPerc) => {
  const { life: maxLife } = calculateDerivedStats(p);
  return Math.floor((hpPerc / 100) * maxLife);
};

const getPlayerIdsFromUsernames = (usernames, allPlayers) => {
  // usernames comes from array type "player1,player2" -> ["player1", "player2"]
  // handles both "@.username" and "username"
  const cleanUsernames = usernames.map(u => u.startsWith('@.') ? u.substring(2) : u);
  const normalizedUsernames = cleanUsernames.map(u => u.toLowerCase().trim());
  
  return allPlayers
    .filter(p =>
      normalizedUsernames.includes(p.discord_username?.toLowerCase() || "") ||
      normalizedUsernames.includes(p.char_name?.toLowerCase() || "")
    )
    .map(p => p.id);
};

export const parseArgs = (inputParts, commandDef) => {
  const args = [];
  for (let i = 0; i < commandDef.args.length; i++) {
    const def = commandDef.args[i];
    const rawValue = inputParts[i];
    
    if (rawValue === undefined || rawValue === "") {
      args.push(undefined);
      continue;
    }

    switch (def.type) {
      case 'number':
        const num = parseFloat(rawValue);
        args.push(isNaN(num) ? undefined : num);
        break;
      case 'boolean':
        if (rawValue.toLowerCase() === 'true') args.push(true);
        else if (rawValue.toLowerCase() === 'false') args.push(false);
        else args.push(undefined);
        break;
      case 'array':
        args.push(rawValue.split(',').filter(x => x.length > 0));
        break;
      case 'string':
      default:
        args.push(rawValue);
        break;
    }
  }
  return args;
};

export const handleCommand = async (input, user, allPlayers, allNPCs = []) => {
  const isMaster = user?.user_metadata?.sub === MASTER_DISCORD_ID;
  if (!isMaster) return { success: false, message: "Only the Master can use commands." };

  if (!input.startsWith('/')) return { success: false, message: "Not a command." };
  
  const fullContent = input.substring(1).trim();
  
  // Find matching command by name (longest match first)
  const sortedCommands = [...COMMANDS].sort((a, b) => b.name.length - a.name.length);
  
  for (const cmd of sortedCommands) {
    if (fullContent.startsWith(cmd.name)) {
      const remaining = fullContent.substring(cmd.name.length).trim();
      
      // Smart parsing for quoted strings
      const parts = [];
      const regex = /"([^"]*)"|(\S+)/g;
      let match;
      while ((match = regex.exec(remaining)) !== null) {
        parts.push(match[1] !== undefined ? match[1] : match[2]);
      }

      const args = parseArgs(parts, cmd);
      
      // Basic validation
      // Filter out trailing undefined args from the end of the array to count provided args correctly
      const providedArgsCount = args.filter((a, idx) => a !== undefined || idx < parts.length).length;
      const requiredArgsCount = cmd.args.filter(a => !a.optional).length;
      
      if (providedArgsCount < requiredArgsCount) {
        return { success: false, message: `Missing arguments for ${cmd.name}` };
      }

      return await cmd.execute(args, { user, allPlayers, allNPCs });
    }
  }

  return { success: false, message: "Unknown command." };
};
