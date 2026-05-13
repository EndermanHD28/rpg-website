-- Migration to create the toggle_session function
-- This function ensures that starting/ending a session and clearing messages 
-- happens atomically and is properly propagated to all clients.

CREATE OR REPLACE FUNCTION toggle_session(status BOOLEAN)
RETURNS VOID AS $$
BEGIN
    -- 1. Update the session status in the global table
    UPDATE global 
    SET is_session_active = status 
    WHERE id = 1;

    -- 2. If we are STARTING a session, clear all messages
    -- We use status = true to identify session start
    IF status = TRUE THEN
        DELETE FROM messages WHERE id IS NOT NULL;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
