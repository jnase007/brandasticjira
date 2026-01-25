import { createClient } from '@supabase/supabase-js'

export async function handler(event) {
  const token = event.queryStringParameters?.token
  if (!token) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing token' }) }
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Server not configured' }) }
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  })

  try {
    // First try to find by public_token
    let clientQuery = supabase
      .from('clients')
      .select('id, name, color, logo_url, banner_url, monthly_hours, account_services, public_enabled, public_token')
      .eq('public_token', token)
      .or('public_enabled.is.null,public_enabled.eq.true')

    let { data: client, error: clientError } = await clientQuery.maybeSingle()

    // Fallback for schemas missing public_enabled
    if (clientError && clientError.message?.includes('public_enabled')) {
      const fallbackRes = await supabase
        .from('clients')
        .select('id, name, color, logo_url, banner_url, monthly_hours, account_services, public_token')
        .eq('public_token', token)
        .maybeSingle()
      client = fallbackRes.data
    }

    // If not found by token, try by ID (fallback for direct ID links)
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
      return { statusCode: 404, body: JSON.stringify({ error: 'Client not found or public access not enabled' }) }
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

    return {
      statusCode: 200,
      body: JSON.stringify({
        client,
        boards: boardsRes.data || [],
        tickets: ticketsRes.data || [],
        projects: projectsRes.data || [],
        recaps: recapsRes.data || [],
        recent_updates: activityRes.data || [],
        hours_summary: hoursSummary,
      }),
    }
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) }
  }
}

