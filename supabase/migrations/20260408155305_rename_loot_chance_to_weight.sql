-- Migration to rename generalChance to weight in loot_tables.items JSON array
UPDATE loot_tables
SET items = (
  SELECT jsonb_agg(
    CASE 
      WHEN item ? 'generalChance' THEN (item - 'generalChance') || jsonb_build_object('weight', item->'generalChance')
      ELSE item
    END
  )
  FROM jsonb_array_elements(items) AS item
)
WHERE items IS NOT NULL AND jsonb_typeof(items) = 'array';
