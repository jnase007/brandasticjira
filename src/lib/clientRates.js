export function rateFromRow(row) {
  if (!row) return null
  const value = row.rate ?? row.rate_per_hour ?? row.hourly_rate
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function isMissingColumn(error) {
  const message = error?.message || ''
  return /does not exist|schema cache|42703/i.test(message) && !/row-level security|permission/i.test(message)
}

export async function fetchClientRate(supabase, clientId) {
  if (!clientId) return { value: null, error: null }

  const fromRates = await supabase
    .from('client_rates')
    .select('*')
    .eq('client_id', clientId)
    .limit(1)
    .maybeSingle()
  const fromRatesValue = rateFromRow(fromRates.data)
  if (fromRatesValue != null) return { value: fromRatesValue, error: null }

  const fromHourly = await supabase
    .from('client_hourly_rates')
    .select('*')
    .eq('client_id', clientId)
    .limit(1)
    .maybeSingle()
  return { value: rateFromRow(fromHourly.data), error: fromHourly.error || fromRates.error }
}

export async function saveClientRate(supabase, clientId, rateValue) {
  const writeTable = async (table, payload) => {
    const { data: existing } = await supabase
      .from(table)
      .select('id')
      .eq('client_id', clientId)
      .maybeSingle()
    if (existing?.id) {
      return supabase.from(table).update(payload).eq('id', existing.id)
    }
    return supabase.from(table).insert({ client_id: clientId, ...payload })
  }

  const primary = await writeTable('client_rates', { rate: rateValue })
  if (!primary.error) return primary
  if (!isMissingColumn(primary.error)) return primary

  const secondary = await writeTable('client_hourly_rates', { rate_per_hour: rateValue })
  if (!secondary.error) return secondary
  return primary
}
