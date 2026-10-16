import { createClient } from 'npm:@supabase/supabase-js@2.117.2'
import { createHandler } from './handler.ts'

// Pilot ceiling per isolate only. Distributed quota is required before student rollout.
let used = 0
const handler = createHandler({
  authenticate: async (token) => {
    const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data, error } = await client.auth.getUser(token)
    if (error || !data.user || data.user.is_anonymous) return null
    const { data: profile, error: profileError } = await client
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single()
    if (profileError) return 'user'
    return profile?.role === 'admin' ? 'admin' : 'user'
  },
  apiKey: () => Deno.env.get('YOUTUBE_DATA_API_KEY'),
  fetch,
  reserve: () => {
    if (used >= 3) return false
    used++
    return true
  },
})
Deno.serve(handler)
