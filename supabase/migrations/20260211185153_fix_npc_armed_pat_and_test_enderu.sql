-- Fix NPC armed_pat column type
ALTER TABLE npcs ALTER COLUMN armed_pat TYPE TEXT USING armed_pat::text;

-- Test connectivity by updating .enderu strength
UPDATE characters SET strength = 14 WHERE discord_username = 'enderu';
