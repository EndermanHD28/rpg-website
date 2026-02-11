/**
 * ITEM PACK CREATION INSTRUCTIONS:
 * When asked to create a "pack" or "bundle" of items:
 * 1. Define the items in a JSON array.
 * 2. Each item should follow the structure: { name, type, rarity, value, category, subtype, hands, damageType, description, tier, upgrade, isBackpack }
 * 3. Instruct the user to copy the JSON and use the "Importar Código" button in the Item Library tab.
 */

import { supabase } from './supabase';
import { MASTER_DISCORD_ID } from '../constants/gameData';

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
      await supabase.from('characters').update({ is_in_combat: false }).neq('rank', 'Mestre');
      
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
      await supabase.from('characters').update({ is_in_combat: true }).eq('id', MASTER_DISCORD_ID);

      // 4. Reset turn to 1 and activate combat
      await supabase.from('global').update({
        current_turn: 1,
        is_combat_active: true
      }).eq('id', 1);

      return { success: true, message: `Combat started with ${playerIds.length} players at ${hpPerc}% HP.` };
    }
  },
  {
    name: "combat add-player",
    description: "Adds specific players to the ongoing combat",
    args: [
      { name: "hp-percentage", type: "number" },
      { name: "players", type: "array" }
    ],
    execute: async ([hpPerc, players], { allPlayers }) => {
      const playerIds = getPlayerIdsFromUsernames(players, allPlayers);
      for (const id of playerIds) {
        const p = allPlayers.find(pl => pl.id === id);
        await supabase.from('characters').update({ 
          is_in_combat: true,
          current_hp: calculateHP(p, hpPerc)
        }).eq('id', id);
      }
      return { success: true, message: `Added ${playerIds.length} players.` };
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
    execute: async ([players, effectKey, turns], { allPlayers }) => {
      const { EFFECTS, EFFECT_ALIASES } = await import('../constants/gameData');
      const normalizedKey = effectKey.toLowerCase().trim();
      const actualKey = EFFECT_ALIASES[normalizedKey] || normalizedKey;
      const effect = EFFECTS[actualKey];
      
      if (!effect) return { success: false, message: `Effect "${effectKey}" not found.` };

      const playerIds = getPlayerIdsFromUsernames(players, allPlayers);
      
      for (const id of playerIds) {
        const p = allPlayers.find(pl => pl.id === id);
        const currentEffects = Array.isArray(p.effects) ? p.effects : [];
        
        // Don't add if already has it (optional, but usually effects don't stack linearly like this)
        if (currentEffects.find(e => e.key === actualKey)) continue;

        const newEffects = [...currentEffects, { ...effect, key: actualKey, addedAtTurn: 0, duration: turns }]; // turn logic will be handled in turn system
        
        // Calculate new Max Life with the added effect
        const baseLife = (p.strength || 0) + (p.resistance || 0) * 7;
        let newMaxLife = baseLife;
        newEffects.forEach(eff => {
          if (eff.modifiers?.maxLife) newMaxLife *= eff.modifiers.maxLife;
        });
        newMaxLife = Math.floor(newMaxLife);

        const updateData = { effects: newEffects };
        
        // Clamp current HP if it exceeds new Max Life
        if ((p.current_hp || baseLife) > newMaxLife) {
          updateData.current_hp = newMaxLife;
        }

        await supabase.from('characters').update(updateData).eq('id', id);
      }

      return { success: true, message: `Added ${effect.name} to ${playerIds.length} players.` };
    }
  },
  {
    name: "combat remove-player",
    description: "Removes specific players from combat",
    args: [
      { name: "players", type: "array" }
    ],
    execute: async ([players], { allPlayers }) => {
      const playerIds = getPlayerIdsFromUsernames(players, allPlayers);
      await supabase.from('characters').update({ is_in_combat: false }).in('id', playerIds);
      return { success: true, message: `Removed ${playerIds.length} players.` };
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
      await supabase.from('characters').update({ is_in_combat: false }).neq('id', 'dummy');
      await supabase.from('global').update({
        current_turn: 1,
        is_combat_active: false
      }).eq('id', 1);
      return { success: true, message: "Combat finished globally." };
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
      const { error } = await supabase.from('messages').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) return { success: false, message: `Error clearing chat: ${error.message}` };
      return { success: true, message: "Chat cleared." };
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
  const baseLife = (p.strength || 0) + (p.resistance || 0) * 7;
  let maxLife = baseLife;
  if (Array.isArray(p.effects)) {
    p.effects.forEach(eff => {
      if (eff.modifiers?.maxLife) maxLife *= eff.modifiers.maxLife;
    });
  }
  maxLife = Math.floor(maxLife);
  return Math.floor((hpPerc / 100) * maxLife);
};

const getPlayerIdsFromUsernames = (usernames, allPlayers) => {
  // usernames comes from array type "player1,player2" -> ["player1", "player2"]
  // handles both "@.username" and "username"
  const cleanUsernames = usernames.map(u => u.startsWith('@.') ? u.substring(2) : u);
  return allPlayers
    .filter(p => cleanUsernames.includes(p.discord_username))
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

export const handleCommand = async (input, user, allPlayers) => {
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

      return await cmd.execute(args, { user, allPlayers });
    }
  }

  return { success: false, message: "Unknown command." };
};
