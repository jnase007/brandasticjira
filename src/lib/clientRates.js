export function rateFromRow(row) {
  if (!row) return null
  const value = row.hourly_rate ?? row.rate ?? row.rate_per_hour
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export async function fetchClientRate(supabase, clientId) {
  if (!clientId) return { value: null, error: null }
  const query = supabase
    .from('client_rates')
    .select('*')
    .eq('client_id', clientId)
    .limit(1)
  const ordered = await query.order('effective_date', { ascending: false }).maybeSingle()
  if (!ordered.error) return { value: rateFromRow(ordered.data), error: null }
  const fallback = await supabase
    .from('client_rates')
    .select('*')
    .eq('client_id', clientId)
    .limit(1)
    .maybeSingle()
  return { value: rateFromRow(fallback.data), error: fallback.error }
}

export async function saveClientRate(supabase, clientId, rateValue) {
  const { data: existing } = await supabase
    .from('client_rates')
    .select('id')
    .eq('client_id', clientId)
    .maybeSingle()

  const write = async (payload) => {
    if (existing?.id) {
      return supabase.from('client_rates').update(payload).eq('id', existing.id)
    }
    return supabase.from('client_rates').insert({ client_id: clientId, ...payload })
  }

  let result = await write({ rate: rateValue })
  if (result.error && /column|schema cache|hourly_rate|rate/i.test(result.error.message || '')) {
    result = await write({ hourly_rate: rateValue })
  }
  return result
}
