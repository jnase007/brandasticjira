import { createClient } from '@supabase/supabase-js'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function handler(event) {
  const { id } = event.queryStringParameters || {}
  if (!id) {
    return {
      statusCode: 302,
      headers: { Location: '/boards' },
    }
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      statusCode: 302,
      headers: { Location: `/tickets/${id}` },
    }
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
  })

  try {
    const { data } = UUID_REGEX.test(id)
      ? await supabase
          .from('tickets')
          .select('id, ticket_id, client:clients(slug)')
          .eq('id', id)
          .maybeSingle()
      : await supabase
          .from('tickets')
          .select('id, ticket_id, client:clients(slug)')
          .eq('ticket_id', id)
          .maybeSingle()

    const ticketKey = data?.ticket_id || id
    const clientSlug = data?.client?.slug
    const destination = clientSlug
      ? `/clients/${clientSlug}/tickets/${ticketKey}`
      : `/tickets/${ticketKey}`

    return {
      statusCode: 301,
      headers: { Location: destination },
    }
  } catch {
    return {
      statusCode: 302,
      headers: { Location: `/tickets/${id}` },
    }
  }
}

