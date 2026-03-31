import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function migration() {
  try {
    console.log('[v0] Starting database migration...')
    
    // First, let's check if the columns already exist by attempting a simple query
    const { error: checkError } = await supabase
      .from('players')
      .select('user_id')
      .limit(1)
    
    if (!checkError) {
      console.log('[v0] user_id column already exists, skipping migration')
      return
    }

    // User ID column doesn't exist, we need to add it
    // Since we can't execute raw SQL via the SDK, we'll use the rpc approach if available
    console.log('[v0] Adding missing columns via database function...')
    
    // Try using a stored procedure if it exists
    const { error: rpcError } = await supabase.rpc('add_user_columns', {})
    
    if (!rpcError) {
      console.log('[v0] Migration completed via stored procedure')
      return
    }

    console.warn('[v0] RPC function not available, migration may need manual setup')
    console.warn('[v0] Please run the SQL migration from: /scripts/002_add_user_columns.sql')
    
  } catch (error) {
    console.error('[v0] Migration error:', error)
    process.exit(1)
  }
}

migration()
