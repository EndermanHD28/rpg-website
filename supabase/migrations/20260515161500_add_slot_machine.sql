-- Add slot machine columns to global table
ALTER TABLE global ADD COLUMN IF NOT EXISTS slot_machine_target TEXT;
ALTER TABLE global ADD COLUMN IF NOT EXISTS slot_machine_player_id UUID REFERENCES characters(id);
ALTER TABLE global ADD COLUMN IF NOT EXISTS slot_machine_is_spinning BOOLEAN DEFAULT FALSE;
ALTER TABLE global ADD COLUMN IF NOT EXISTS slot_machine_result TEXT;
ALTER TABLE global ADD COLUMN IF NOT EXISTS slot_machine_character_name TEXT;
