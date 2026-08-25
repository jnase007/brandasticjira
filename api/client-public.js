import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  const token = typeof req.query?.token === 'string' ? req.query.token : req.query?.token?.[0]
  if (!token) {
    return res.status(400).json({ error: 'Missing token' })
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'Server not configured' })
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  })

  try {
    let clientQuery = supabase
      .from('clients')
      .select('id, name, color, logo_url, banner_url, monthly_hours, account_services, public_enabled, public_token')
      .eq('public_token', token)
      .or('public_enabled.is.null,public_enabled.eq.true')

    let { data: client, error: clientError } = await clientQuery.maybeSingle()

    if (clientError && clientError.message?.includes('public_enabled')) {
      const fallbackRes = await supabase
        .from('clients')
        .select('id, name, color, logo_url, banner_url, monthly_hours, account_services, public_token')
        .eq('public_token', token)
        .maybeSingle()
      client = fallbackRes.data
    }

    if (!client) {
      const { data: clientById } = await supabase
        .from('clients')
        .select('id, name, color, logo_url, banner_url, monthly_hours, account_services, public_enabled, public_token')
        .eq('id', token)
        .maybeSingle()

      if (clientById && (clientById.public_enabled === true || clientById.public_enabled === null)) {
        client = clientById
      }
    }

    if (!client) {
      return res.status(404).json({ error: 'Client not found or public access not enabled' })
    }

    const [boardsRes, ticketsRes, projectsRes, recapsRes, activityRes] = await Promise.all([
      supabase
        .from('boards')
        .select('id, name, description, created_at')
        .eq('client_id', client.id)
        .eq('is_archived', false)
        .order('created_at', { ascending: false }),
      supabase
        .from('tickets')
        .select('id, title, ticket_id, status, priority, board_id, created_at')
        .eq('client_id', client.id)
        .order('updated_at', { ascending: false })
        .limit(100),
      supabase
        .from('client_projects')
        .select('id, title')
        .eq('client_id', client.id)
        .eq('is_visible_to_client', true)
        .order('completed_date', { ascending: false }),
      supabase
        .from('client_monthly_recaps')
        .select('id, title, month, year, created_at')
        .eq('client_id', client.id)
        .eq('status', 'published')
        .order('year', { ascending: false })
        .order('month', { ascending: false })
        .limit(4),
      supabase
        .from('activity_log')
        .select('id, entity_name, created_at')
        .eq('client_id', client.id)
        .order('created_at', { ascending: false })
        .limit(5),
    ])

    let hoursSummary = null
    try {
      const { data } = await supabase
        .from('client_hours_summary')
        .select('*')
        .eq('client_id', client.id)
        .maybeSingle()
      hoursSummary = data || null
    } catch {
      hoursSummary = null
    }

    return res.status(200).json({
      client,
      boards: boardsRes.data || [],
      tickets: ticketsRes.data || [],
      projects: projectsRes.data || [],
      recaps: recapsRes.data || [],
      recent_updates: activityRes.data || [],
      hours_summary: hoursSummary,
    })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
}
