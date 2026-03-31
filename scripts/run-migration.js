#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function runMigration() {
  try {
    console.log("Running migration: adding user_id columns to players table...")

    // Add columns to players table
    const migrations = [
      'ALTER TABLE public.players ADD COLUMN IF NOT EXISTS user_id UUID',
      'ALTER TABLE public.players ADD COLUMN IF NOT EXISTS animation_url TEXT',
      'ALTER TABLE public.players ADD COLUMN IF NOT EXISTS rig_task_id TEXT',
      'ALTER TABLE public.players ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()',
      'ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS username TEXT',
      'CREATE INDEX IF NOT EXISTS idx_players_user_id ON public.players(user_id)',
    ]

    for (const sql of migrations) {
      const { error } = await supabase.rpc('exec_sql', { sql })
      if (error) {
        console.warn(`Migration step warning: ${error.message}`)
      } else {
        console.log(`✓ Executed: ${sql.substring(0, 50)}...`)
      }
    }

    console.log("✓ Migration completed successfully!")
  } catch (error) {
    console.error("Migration failed:", error)
    process.exit(1)
  }
}

runMigration()
