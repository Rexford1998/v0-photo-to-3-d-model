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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen TIMESTAMPTZ DEFAULT NOW()
);

-- Create chat messages table
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read players (for multiplayer visibility)
CREATE POLICY "Anyone can view players" ON public.players FOR SELECT USING (true);

-- Allow anyone to insert players (anonymous join)
CREATE POLICY "Anyone can join as player" ON public.players FOR INSERT WITH CHECK (true);

-- Allow players to update their own position (by id match)
CREATE POLICY "Players can update own data" ON public.players FOR UPDATE USING (true);

-- Allow anyone to delete their own player
CREATE POLICY "Players can delete own data" ON public.players FOR DELETE USING (true);

-- Chat policies - anyone can read and write
CREATE POLICY "Anyone can view chat" ON public.chat_messages FOR SELECT USING (true);
CREATE POLICY "Anyone can send messages" ON public.chat_messages FOR INSERT WITH CHECK (true);

-- Enable realtime for both tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;

-- Create index for faster chat queries
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON public.chat_messages(created_at DESC);

-- Create index for player last_seen (for cleanup)
CREATE INDEX IF NOT EXISTS idx_players_last_seen ON public.players(last_seen);
