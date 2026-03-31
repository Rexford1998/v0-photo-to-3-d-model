-- Add missing columns to players table for user authentication and model saving
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS animation_url TEXT;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS rig_task_id TEXT;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS username TEXT;
CREATE INDEX IF NOT EXISTS idx_players_user_id ON public.players(user_id);
