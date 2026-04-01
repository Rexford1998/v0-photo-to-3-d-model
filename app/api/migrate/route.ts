import { createClient } from '@supabase/supabase-js'

export async function POST() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    return Response.json(
      { error: 'Missing Supabase credentials' },
      { status: 500 }
    )
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  })

  try {
    // Check if migration is needed
    const { error: checkError, data } = await supabase
      .from('players')
      .select('user_id')
      .limit(1)

    if (!checkError) {
      return Response.json(
        { message: 'Columns already exist' },
        { status: 200 }
      )
    }

    // Run migrations one by one via SQL
    const migrations = [
      'ALTER TABLE public.players ADD COLUMN IF NOT EXISTS user_id UUID',
      'ALTER TABLE public.players ADD COLUMN IF NOT EXISTS animation_url TEXT',
      'ALTER TABLE public.players ADD COLUMN IF NOT EXISTS rig_task_id TEXT',
      'ALTER TABLE public.players ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()',
      "ALTER TABLE public.players ADD COLUMN IF NOT EXISTS country TEXT NOT NULL DEFAULT 'United States'",
      'ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS username TEXT',
      "ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS country TEXT NOT NULL DEFAULT 'United States'",
      'CREATE INDEX IF NOT EXISTS idx_players_user_id ON public.players(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_players_country_last_seen ON public.players(country, last_seen)',
      'CREATE INDEX IF NOT EXISTS idx_chat_messages_country_created_at ON public.chat_messages(country, created_at DESC)',
    ]

    const results = []
    for (const sql of migrations) {
      try {
        // Attempt to execute via rpc if available, otherwise skip
        const { error } = await supabase.rpc('exec_sql', { sql })
        results.push({
          sql: sql.substring(0, 50) + '...',
          status: error ? 'warning' : 'success',
          error: error?.message,
        })
      } catch (e) {
        results.push({
          sql: sql.substring(0, 50) + '...',
          status: 'error',
          error: 'RPC not available',
        })
      }
    }

    return Response.json({ results }, { status: 200 })
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Migration failed' },
      { status: 500 }
    )
  }
}
