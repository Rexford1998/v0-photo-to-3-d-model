-- Add missing columns to players table for user authentication and model saving
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS animation_url TEXT;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS rig_task_id TEXT;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS country TEXT NOT NULL DEFAULT 'United States';
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS country TEXT NOT NULL DEFAULT 'United States';
CREATE INDEX IF NOT EXISTS idx_players_user_id ON public.players(user_id);
CREATE INDEX IF NOT EXISTS idx_players_country_last_seen ON public.players(country, last_seen);
CREATE INDEX IF NOT EXISTS idx_chat_messages_country_created_at ON public.chat_messages(country, created_at DESC);
