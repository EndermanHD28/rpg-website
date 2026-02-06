import { supabase } from './supabase';
import { MASTER_DISCORD_ID } from '../constants/gameData';

export const handleCommand = async (input, user, allPlayers) => {
  const isMaster = user?.user_metadata?.sub === MASTER_DISCORD_ID;
  if (!isMaster) return { success: false, message: "Only the Master can use commands." };

  const parts = input.trim().split(/\s+/);
  const command = parts[0];
  const subcommand = parts[1];
  const hpArg = parts[2]; // Positional HP arg
  const mentions = parts.slice(3); // Mentions start from part 4

  if (command === '/combat') {
    switch (subcommand) {
      case 'start':
        return await startCombat(hpArg, mentions, allPlayers);
      case 'add-player':
        return await addPlayerToCombat(hpArg, mentions, allPlayers);
      case 'remove-player':
        // remove-player might not need HP arg, but we follow the structure
        // /combat remove-player ignore_this @mentions
        return await removePlayerFromCombat(parts.slice(2), allPlayers);
      case 'ko-player':
        return await koPlayer(parts.slice(2), allPlayers);
      case 'finish':
        return await finishCombat();
      default:
        return { success: false, message: "Unknown combat subcommand." };
    }
  }

  return { success: false, message: "Unknown command." };
};

const calculateHP = (p, hpValue) => {
  const maxLife = (p.strength || 0) + (p.resistance || 0) * 4;
  if (!hpValue) return p.current_hp;
  
  if (hpValue.toLowerCase() === 'full') return maxLife;

  if (typeof hpValue === 'string' && hpValue.endsWith('%')) {
    const percentage = parseInt(hpValue.replace('%', ''));
    if (isNaN(percentage)) return p.current_hp;
    return Math.floor((percentage / 100) * maxLife);
  }
  
  const absolute = parseInt(hpValue);
  return isNaN(absolute) ? p.current_hp : absolute;
};

const startCombat = async (hpArg, mentions, allPlayers) => {
  const playerIds = getPlayerIdsFromMentions(mentions, allPlayers);
  
  // 1. Reset everyone
  await supabase.from('characters').update({ is_in_combat: false }).neq('rank', 'Mestre');
  
  // 2. Set specified players
  if (playerIds.length > 0) {
    for (const id of playerIds) {
      const p = allPlayers.find(pl => pl.id === id);
      const updateData = { 
        is_in_combat: true,
        current_hp: calculateHP(p, hpArg)
      };
      await supabase.from('characters').update(updateData).eq('id', id);
    }
  }

  // 3. Set Master combat active
  await supabase.from('characters').update({ is_in_combat: true }).eq('id', MASTER_DISCORD_ID);

  return { success: true, message: `Combat started with ${playerIds.length} players at ${hpArg} HP.` };
};

const addPlayerToCombat = async (hpArg, mentions, allPlayers) => {
  const playerIds = getPlayerIdsFromMentions(mentions, allPlayers);
  if (playerIds.length === 0) return { success: false, message: "No players specified." };

  for (const id of playerIds) {
    const p = allPlayers.find(pl => pl.id === id);
    const updateData = { 
      is_in_combat: true,
      current_hp: calculateHP(p, hpArg)
    };
    await supabase.from('characters').update(updateData).eq('id', id);
  }

  return { success: true, message: `Added ${playerIds.length} players to combat at ${hpArg} HP.` };
};

const removePlayerFromCombat = async (mentions, allPlayers) => {
  const playerIds = getPlayerIdsFromMentions(mentions, allPlayers);
  if (playerIds.length === 0) return { success: false, message: "No players specified." };

  await supabase.from('characters')
    .update({ is_in_combat: false })
    .in('id', playerIds);

  return { success: true, message: `Removed ${playerIds.length} players from combat.` };
};

const koPlayer = async (mentions, allPlayers) => {
  const playerIds = getPlayerIdsFromMentions(mentions, allPlayers);
  if (playerIds.length === 0) return { success: false, message: "No players specified." };

  await supabase.from('characters')
    .update({ current_hp: 0 })
    .in('id', playerIds);

  return { success: true, message: `KO'd ${playerIds.length} players.` };
};

const finishCombat = async () => {
  // Use .in to target all characters efficiently, or just update all
  const { error } = await supabase.from('characters').update({ is_in_combat: false }).neq('id', 'dummy'); 
  if (error) return { success: false, message: "Error finishing combat." };
  return { success: true, message: "Combat finished globally." };
};

const getPlayerIdsFromMentions = (mentions, allPlayers) => {
  // Support comma separated mentions as well as multiple args
  const flatMentions = mentions.join(',').split(',').filter(m => m.trim().startsWith('@.'));
  const usernames = flatMentions.map(m => m.trim().substring(2));

  return allPlayers
    .filter(p => usernames.includes(p.discord_username))
    .map(p => p.id);
};
