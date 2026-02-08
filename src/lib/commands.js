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
  }
];

const calculateHP = (p, hpPerc) => {
  const maxLife = (p.strength || 0) + (p.resistance || 0) * 4;
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
    
    if (rawValue === undefined) {
      args.push(undefined);
      continue;
    }

    switch (def.type) {
      case 'number':
        args.push(parseFloat(rawValue));
        break;
      case 'boolean':
        args.push(rawValue.toLowerCase() === 'true');
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
      const parts = remaining ? remaining.split(/\s+/) : [];
      const args = parseArgs(parts, cmd);
      
      // Basic validation
      if (args.length < cmd.args.filter(a => !a.optional).length) {
        return { success: false, message: `Missing arguments for ${cmd.name}` };
      }

      return await cmd.execute(args, { user, allPlayers });
    }
  }

  return { success: false, message: "Unknown command." };
};
