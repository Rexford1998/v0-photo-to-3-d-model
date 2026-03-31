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
      'ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS username TEXT',
      'CREATE INDEX IF NOT EXISTS idx_players_user_id ON public.players(user_id)',
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
