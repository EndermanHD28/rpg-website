-- Add maintenance columns to global table
ALTER TABLE global ADD COLUMN IF NOT EXISTS is_maintenance_active BOOLEAN DEFAULT FALSE;
ALTER TABLE global ADD COLUMN IF NOT EXISTS allowed_discord_usernames TEXT[] DEFAULT '{}';
