-- Create players table for multiplayer world
CREATE TABLE IF NOT EXISTS public.players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nickname TEXT NOT NULL,
  model_url TEXT,
  position_x FLOAT DEFAULT 0,
  position_y FLOAT DEFAULT 0,
  position_z FLOAT DEFAULT 0,
  rotation_y FLOAT DEFAULT 0,
  color TEXT DEFAULT '#3b82f6',
  country TEXT NOT NULL DEFAULT 'United States',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen TIMESTAMPTZ DEFAULT NOW()
);

-- Create chat messages table
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  country TEXT NOT NULL DEFAULT 'United States',
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON public.chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_country_created_at ON public.chat_messages(country, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_players_last_seen ON public.players(last_seen);
CREATE INDEX IF NOT EXISTS idx_players_country_last_seen ON public.players(country, last_seen);
