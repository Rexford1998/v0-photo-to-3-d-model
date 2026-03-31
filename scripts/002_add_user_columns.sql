-- Add missing columns to players table for user authentication and model saving
-- Run this migration to fix model saving to multiplayer world

-- Add user_id column to link players to authenticated users
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS user_id UUID;

-- Add animation_url column for storing animation data
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS animation_url TEXT;

-- Add rig_task_id column for tracking rigging tasks
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS rig_task_id TEXT;

-- Add updated_at column for tracking updates
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Add username column to chat_messages for display
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS username TEXT;

-- Create index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_players_user_id ON public.players(user_id);

-- Create unique constraint on user_id to ensure one player per user
-- First, remove any duplicates (keeping the most recently created)
DELETE FROM public.players a USING public.players b
WHERE a.user_id IS NOT NULL 
  AND a.user_id = b.user_id 
  AND a.created_at < b.created_at;

-- Now add unique constraint
ALTER TABLE public.players DROP CONSTRAINT IF EXISTS players_user_id_unique;
ALTER TABLE public.players ADD CONSTRAINT players_user_id_unique UNIQUE (user_id);
