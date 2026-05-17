ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_sender_role_check;
ALTER TABLE messages ADD CONSTRAINT messages_sender_role_check CHECK (sender_role IN ('consumer', 'expert', 'system'));
