import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables. Please check your .env file.')
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: localStorage,
    storageKey: 'brandastic-auth',
    flowType: 'implicit', // Standard OAuth flow
  },
  global: {
    headers: {
      'x-client-info': 'brandastic-pm',
    },
  },
})

// ============================================
// AUTH HELPERS
// ============================================

/**
 * Session validation stub - Supabase handles session management automatically.
 * This function exists for backwards compatibility with existing code.
 */
export async function ensureValidSession() {
  return true
}

export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/dashboard`,
    },
  })
  return { data, error }
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  return { error }
}

export async function getSession() {
  const { data: { session }, error } = await supabase.auth.getSession()
  return { session, error }
}

export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser()
  return { user, error }
}

// ============================================
// PROFILE HELPERS
// ============================================

export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()
  return { data, error }
}

export async function updateProfile(userId, updates) {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
  return { data: data?.[0] || null, error }
}

// ============================================
// CLIENTS HELPERS
// ============================================

export async function getClients() {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .neq('is_active', false)
    .order('name')
  return { data, error }
}

export async function getClient(clientId) {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .single()
  return { data, error }
}

export async function addClient(clientData) {
  const { data, error } = await supabase
    .from('clients')
    .insert(clientData)
    .select()
    .single()
  return { data, error }
}

export async function updateClient(clientId, updates) {
  const { data, error } = await supabase
    .from('clients')
    .update(updates)
    .eq('id', clientId)
    .select()
    .single()
  return { data, error }
}

// ============================================
// BOARDS HELPERS
// ============================================

export async function getBoards(clientId = null) {
  let query = supabase
    .from('boards')
    .select(`
      *,
      client:clients(id, name, color, logo_url, slug)
    `)
    .eq('is_archived', false)
    .order('created_at', { ascending: false })

  if (clientId) {
    query = query.eq('client_id', clientId)
  }

  const { data, error } = await query
  return { data, error }
}

export async function getBoard(boardId) {
  const { data, error } = await supabase
    .from('boards')
    .select(`
      *,
      client:clients(id, name, color, logo_url, slug, monthly_hours)
    `)
    .eq('id', boardId)
    .single()
  return { data, error }
}

export async function createBoard(boardData) {
  const { data, error } = await supabase
    .from('boards')
    .insert(boardData)
    .select()
    .single()
  return { data, error }
}

export async function updateBoard(boardId, updates) {
  const { data, error } = await supabase
    .from('boards')
    .update(updates)
    .eq('id', boardId)
    .select()
    .single()
  return { data, error }
}

// ============================================
// TICKETS HELPERS
// ============================================

export async function getTickets(boardId = null, clientId = null) {
  let query = supabase
    .from('tickets')
    .select('*, client:clients(id, name, slug, logo_url, color)')
    .order('position')

  if (boardId) {
    query = query.eq('board_id', boardId)
  }
  if (clientId) {
    query = query.eq('client_id', clientId)
  }

  const { data: tickets, error } = await query
  if (error || !tickets) {
    return { data: null, error }
  }

  const assignedIds = [...new Set(tickets.map((t) => t.assigned_to).filter(Boolean))]
  let assignedProfiles = []
  if (assignedIds.length > 0) {
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', assignedIds)
    assignedProfiles = profilesData || []
  }

  const assignedMap = assignedProfiles.reduce((acc, profile) => {
    acc[profile.id] = profile
    return acc
  }, {})

  const enrichedTickets = tickets.map((ticket) => ({
    ...ticket,
    assigned_user: ticket.assigned_to ? assignedMap[ticket.assigned_to] : null,
  }))

  return { data: enrichedTickets, error: null }
}

export async function getTicket(ticketId) {
  const { data: ticket, error } = await supabase
    .from('tickets')
    .select(`
      *,
      board:boards(id, name, client_id),
      client:clients(id, name, color, logo_url, slug)
    `)
    .eq('id', ticketId)
    .maybeSingle()
  
  if (error || !ticket) {
    return { data: null, error }
  }
  
  let assigned_user = null
  let creator = null
  
  if (ticket.assigned_to) {
    const { data: assignee } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, email')
      .eq('id', ticket.assigned_to)
      .maybeSingle()
    assigned_user = assignee
  }
  
  if (ticket.created_by) {
    const { data: creatorData } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .eq('id', ticket.created_by)
      .maybeSingle()
    creator = creatorData
  }
  
  return { 
    data: { ...ticket, assigned_user, creator }, 
    error: null 
  }
}

export async function getTicketByTicketId(ticketIdString) {
  const { data: ticket, error } = await supabase
    .from('tickets')
    .select(`
      *,
      board:boards(id, name, client_id),
      client:clients(id, name, color, logo_url, slug)
    `)
    .eq('ticket_id', ticketIdString)
    .maybeSingle()
  
  if (error || !ticket) {
    return { data: null, error }
  }
  
  let assigned_user = null
  let creator = null
  
  if (ticket.assigned_to) {
    const { data: assignee } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, email')
      .eq('id', ticket.assigned_to)
      .maybeSingle()
    assigned_user = assignee
  }
  
  if (ticket.created_by) {
    const { data: creatorData } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .eq('id', ticket.created_by)
      .maybeSingle()
    creator = creatorData
  }
  
  return { 
    data: { ...ticket, assigned_user, creator }, 
    error: null 
  }
}

export async function createTicket(ticketData) {
  const { data: ticket, error } = await supabase
    .from('tickets')
    .insert(ticketData)
    .select('*')
    .single()
  
  if (error || !ticket) {
    return { data: null, error }
  }
  
  let assigned_user = null
  if (ticket.assigned_to) {
    const { data: assignee } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .eq('id', ticket.assigned_to)
      .maybeSingle()
    assigned_user = assignee
  }
  
  return { data: { ...ticket, assigned_user }, error: null }
}

export async function updateTicket(ticketId, updates) {
  const { data: ticket, error } = await supabase
    .from('tickets')
    .update(updates)
    .eq('id', ticketId)
    .select('*')
    .single()
  
  if (error || !ticket) {
    return { data: null, error }
  }
  
  let assigned_user = null
  if (ticket.assigned_to) {
    const { data: assignee } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .eq('id', ticket.assigned_to)
      .maybeSingle()
    assigned_user = assignee
  }
  
  return { data: { ...ticket, assigned_user }, error: null }
}

export async function deleteTicket(ticketId) {
  const { error } = await supabase
    .from('tickets')
    .delete()
    .eq('id', ticketId)
  return { error }
}

export async function updateTicketPositions(updates) {
  const promises = updates.map(({ id, position, status }) =>
    supabase
      .from('tickets')
      .update({ 
        position, 
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
  )
  const results = await Promise.all(promises)
  const error = results.find(r => r.error)?.error
  return { error }
}

// ============================================
// COMMENTS HELPERS
// ============================================

export async function getComments(ticketId) {
  const { data: comments, error } = await supabase
    .from('comments')
    .select('*')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true })
  
  if (error || !comments) {
    return { data: null, error }
  }
  
  const userIds = [...new Set(comments.map(c => c.user_id).filter(Boolean))]
  let users = []
  
  if (userIds.length > 0) {
    const { data: usersData } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', userIds)
    users = usersData || []
  }
  
  const userMap = users.reduce((acc, user) => {
    acc[user.id] = user
    return acc
  }, {})
  
  const enrichedComments = comments.map(comment => ({
    ...comment,
    user: comment.user_id ? userMap[comment.user_id] : null,
  }))
  
  return { data: enrichedComments, error: null }
}

export async function createComment(commentData) {
  const { data: comment, error } = await supabase
    .from('comments')
    .insert(commentData)
    .select('*')
    .single()
  
  if (error || !comment) {
    return { data: null, error }
  }
  
  let user = null
  if (comment.user_id) {
    const { data: userData } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .eq('id', comment.user_id)
      .maybeSingle()
    user = userData
  }
  
  return { data: { ...comment, user }, error: null }
}

export async function updateComment(commentId, content) {
  const { data, error } = await supabase
    .from('comments')
    .update({ content })
    .eq('id', commentId)
    .select()
    .single()
  return { data, error }
}

export async function deleteComment(commentId) {
  const { error } = await supabase
    .from('comments')
    .delete()
    .eq('id', commentId)
  return { error }
}

// ============================================
// TIME ENTRIES HELPERS
// ============================================

export async function getTimeEntries(ticketId = null, clientId = null, startDate = null, endDate = null) {
  let query = supabase
    .from('time_entries')
    .select(`
      *,
      ticket:tickets(id, ticket_id, title),
      user:profiles(id, full_name, avatar_url)
    `)
    .order('start_time', { ascending: false })

  if (ticketId) {
    query = query.eq('ticket_id', ticketId)
  }
  if (clientId) {
    query = query.eq('client_id', clientId)
  }
  if (startDate) {
    query = query.gte('start_time', startDate)
  }
  if (endDate) {
    query = query.lte('start_time', endDate)
  }

  let { data, error } = await query

  // Fallback for older schemas
  if (error && (error.message?.includes('start_time') || error.message?.includes('relationship'))) {
    let fallbackQuery = supabase
      .from('time_entries')
      .select('*')
      .order('created_at', { ascending: false })

    if (ticketId) fallbackQuery = fallbackQuery.eq('ticket_id', ticketId)
    if (clientId) fallbackQuery = fallbackQuery.eq('client_id', clientId)
    if (startDate) fallbackQuery = fallbackQuery.gte('created_at', startDate)
    if (endDate) fallbackQuery = fallbackQuery.lte('created_at', endDate)

    const fallbackResult = await fallbackQuery
    data = fallbackResult.data
    error = fallbackResult.error

    if (!error && data) {
      const userIds = [...new Set(data.map((entry) => entry.user_id).filter(Boolean))]
      const ticketIds = [...new Set(data.map((entry) => entry.ticket_id).filter(Boolean))]

      let users = []
      let tickets = []

      if (userIds.length > 0) {
        const { data: usersData } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', userIds)
        users = usersData || []
      }

      if (ticketIds.length > 0) {
        const { data: ticketsData } = await supabase
          .from('tickets')
          .select('id, ticket_id, title')
          .in('id', ticketIds)
        tickets = ticketsData || []
      }

      const userMap = users.reduce((acc, user) => { acc[user.id] = user; return acc }, {})
      const ticketMap = tickets.reduce((acc, ticket) => { acc[ticket.id] = ticket; return acc }, {})

      data = data.map((entry) => ({
        ...entry,
        user: entry.user_id ? userMap[entry.user_id] : null,
        ticket: entry.ticket_id ? ticketMap[entry.ticket_id] : null,
      }))
    }
  }

  return { data, error }
}

export async function getRunningTimeEntry(userId) {
  const { data, error } = await supabase
    .from('time_entries')
    .select(`
      *,
      ticket:tickets(id, ticket_id, title, client_id)
    `)
    .eq('user_id', userId)
    .eq('is_running', true)
    .single()
  return { data, error }
}

export async function startTimeEntry(ticketId, clientId, userId, notes = '') {
  const startTime = new Date()
  const { data, error } = await supabase
    .from('time_entries')
    .insert({
      ticket_id: ticketId,
      client_id: clientId,
      user_id: userId,
      start_time: startTime.toISOString(),
      date: startTime.toISOString().split('T')[0],
      is_running: true,
      notes,
    })
    .select()
    .single()
  return { data, error }
}

export async function stopTimeEntry(entryId) {
  const endTime = new Date()
  const { data: existingEntry } = await supabase
    .from('time_entries')
    .select('start_time')
    .eq('id', entryId)
    .single()

  const startTime = existingEntry?.start_time ? new Date(existingEntry.start_time) : endTime
  const durationSeconds = Math.max(1, Math.round((endTime - startTime) / 1000))
  const durationMinutes = Math.max(1, Math.ceil(durationSeconds / 60))

  let { data, error } = await supabase
    .from('time_entries')
    .update({
      end_time: endTime.toISOString(),
      is_running: false,
      duration_minutes: durationMinutes,
      minutes: durationMinutes,
      date: endTime.toISOString().split('T')[0],
    })
    .eq('id', entryId)
    .select()
    .single()

  // Fallback for older schemas
  if (error && error.message?.includes('column')) {
    ;({ data, error } = await supabase
      .from('time_entries')
      .update({
        end_time: endTime.toISOString(),
        is_running: false,
      })
      .eq('id', entryId)
      .select()
      .single())
  }

  return { data, error }
}

export async function createManualTimeEntry(entryData) {
  const startDate = entryData.start_time ? new Date(entryData.start_time) : new Date()
  const endDate = entryData.end_time ? new Date(entryData.end_time) : new Date()
  const durationSeconds = Math.max(1, entryData.duration_seconds ?? Math.round((endDate - startDate) / 1000))
  const durationMinutes = Math.max(1, Math.ceil(durationSeconds / 60))
  
  const payload = {
    user_id: entryData.user_id,
    ticket_id: entryData.ticket_id ?? null,
    start_time: startDate.toISOString(),
    end_time: endDate.toISOString(),
    description: entryData.description ?? null,
    notes: entryData.notes ?? null,
    is_running: false,
    minutes: entryData.minutes ?? durationMinutes,
    date: entryData.date ?? startDate.toISOString().split('T')[0],
    billable: entryData.billable ?? true,
  }

  let { data, error } = await supabase
    .from('time_entries')
    .insert(payload)
    .select()
    .single()

  // Fallback for older schemas
  if (error && error.message?.includes('column')) {
    ;({ data, error } = await supabase
      .from('time_entries')
      .insert({
        user_id: entryData.user_id,
        ticket_id: entryData.ticket_id ?? null,
        description: entryData.description ?? null,
        minutes: durationMinutes,
        date: startDate.toISOString().split('T')[0],
        is_running: false,
      })
      .select()
      .single())
  }

  return { data, error }
}

export async function deleteTimeEntry(entryId) {
  const { error } = await supabase
    .from('time_entries')
    .delete()
    .eq('id', entryId)
  return { error }
}

// ============================================
// CLIENT HOURS SUMMARY
// ============================================

export async function getClientHoursSummary() {
  try {
    const { data, error } = await supabase
      .from('client_hours_summary')
      .select('*')
    
    if (!error && data && data.length > 0) {
      return { data, error: null }
    }
    
    // Fallback: calculate from raw data
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id, name, color, monthly_hours')
      .neq('is_active', false)
    
    if (clientsError || !clients) {
      return { data: [], error: null }
    }
    
    const now = new Date()
    const startOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    const startOfNextMonth = now.getMonth() === 11
      ? `${now.getFullYear() + 1}-01-01`
      : `${now.getFullYear()}-${String(now.getMonth() + 2).padStart(2, '0')}-01`
    
    const { data: timeEntries } = await supabase
      .from('time_entries')
      .select('client_id, minutes')
      .gte('date', startOfMonth)
      .lt('date', startOfNextMonth)
    
    const hoursByClient = {}
    for (const entry of timeEntries || []) {
      if (entry.client_id) {
        hoursByClient[entry.client_id] = (hoursByClient[entry.client_id] || 0) + (entry.minutes || 0) / 60
      }
    }
    
    const summary = clients.map(client => ({
      client_id: client.id,
      client_name: client.name,
      color: client.color,
      monthly_hours: client.monthly_hours || 0,
      hours_used: Math.round((hoursByClient[client.id] || 0) * 10) / 10,
    }))
    
    return { data: summary, error: null }
  } catch (e) {
    console.warn('Error fetching client hours summary:', e)
    return { data: [], error: null }
  }
}

// ============================================
// STORAGE HELPERS
// ============================================

export async function uploadAttachment(file, clientId, ticketId) {
  const fileExt = file.name.split('.').pop()
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
  const filePath = `${clientId}/${ticketId}/${fileName}`

  const { data, error } = await supabase.storage
    .from('documents')
    .upload(filePath, file)

  if (error) {
    return { data: null, error }
  }

  const { data: urlData } = supabase.storage
    .from('documents')
    .getPublicUrl(filePath)

  return {
    data: {
      path: filePath,
      url: urlData.publicUrl,
      name: file.name,
      size: file.size,
      type: file.type,
    },
    error: null,
  }
}

export async function deleteAttachment(filePath) {
  const { error } = await supabase.storage
    .from('documents')
    .remove([filePath])
  return { error }
}

export async function getAttachmentUrl(filePath) {
  const { data } = await supabase.storage
    .from('documents')
    .createSignedUrl(filePath, 3600)
  return data?.signedUrl
}

// ============================================
// TEAM MEMBERS
// ============================================

export async function getTeamMembers() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .in('role', ['team', 'admin'])
    .order('full_name')
  return { data, error }
}

// ============================================
// SEARCH
// ============================================

export async function searchTickets(query) {
  const { data, error } = await supabase
    .from('tickets')
    .select(`
      *,
      board:boards(id, name),
      client:clients(id, name, color, logo_url, slug)
    `)
    .or(`title.ilike.%${query}%,ticket_id.ilike.%${query}%,description.ilike.%${query}%`)
    .limit(20)
  return { data, error }
}

export async function globalSearch(query) {
  const searchTerm = `%${query}%`
  
  const [ticketsRes, clientsRes, teamRes] = await Promise.all([
    supabase
      .from('tickets')
      .select(`
        id, title, ticket_id, status, priority,
        board:boards(id, name),
        client:clients(id, name, color, logo_url, slug)
      `)
      .or(`title.ilike.${searchTerm},ticket_id.ilike.${searchTerm},description.ilike.${searchTerm}`)
      .limit(10),
    
    supabase
      .from('clients')
      .select('id, name, color, logo_url, slug, contact_email, contact_name')
      .or(`name.ilike.${searchTerm},contact_email.ilike.${searchTerm},contact_name.ilike.${searchTerm}`)
      .neq('is_active', false)
      .limit(10),
    
    supabase
      .from('profiles')
      .select('id, full_name, email, avatar_url, role')
      .or(`full_name.ilike.${searchTerm},email.ilike.${searchTerm}`)
      .in('role', ['team', 'admin'])
      .limit(10),
  ])
  
  return {
    tickets: ticketsRes.data || [],
    clients: clientsRes.data || [],
    team: teamRes.data || [],
  }
}

// ============================================
// ACTIVITY LOG
// ============================================

export async function logActivity({
  activity_type,
  user_id,
  client_id = null,
  entity_type = null,
  entity_id = null,
  entity_name = null,
  metadata = {},
}) {
  if (!user_id || !activity_type) {
    return { data: null, error: null }
  }
  const { data, error } = await supabase
    .from('activity_log')
    .insert({
      activity_type,
      user_id,
      client_id,
      entity_type,
      entity_id,
      entity_name,
      metadata,
    })
    .select()
    .single()
  return { data, error }
}

// ============================================
// SAMPLE DATA - BRANDASTIC CLIENTS
// ============================================

const BRANDASTIC_CLIENTS = [
  { name: 'Calops', slug: 'calops', monthly_hours: 120, color: '#4F46E5', account_services: ['SEO', 'PPC', 'Social Media'] },
  { name: 'Prudental Labs', slug: 'prudental-labs', monthly_hours: 63, color: '#059669', account_services: ['SEO', 'Content Marketing', 'Web Development'] },
  { name: 'Salvin', slug: 'salvin', monthly_hours: 60, color: '#DC2626', account_services: ['PPC', 'Email Marketing', 'Branding'] },
  { name: 'Wearparts LLC', slug: 'wearparts-llc', monthly_hours: 57, color: '#EA580C', account_services: ['SEO', 'PPC', 'Web Development'] },
  { name: "Check'n Play", slug: 'checknplay', monthly_hours: 55, color: '#7C3AED', account_services: ['Social Media', 'Influencer Marketing', 'Video Production'] },
  { name: 'Young Surgical', slug: 'young-surgical', monthly_hours: 52, color: '#0D9488', account_services: ['SEO', 'PPC', 'Content Marketing'] },
  { name: 'DESS USA', slug: 'dess-usa', monthly_hours: 45, color: '#0891B2', account_services: ['SEO', 'PPC', 'Web Development'] },
  { name: 'Adopt Hwy', slug: 'adopt-hwy', monthly_hours: 34, color: '#16A34A', account_services: ['Social Media', 'Content Marketing'] },
  { name: 'Christian Heart School', slug: 'christian-heart-school', monthly_hours: 30, color: '#2563EB', account_services: ['SEO', 'Social Media', 'Email Marketing'] },
  { name: 'Morehouse', slug: 'morehouse', monthly_hours: 30, color: '#9333EA', account_services: ['PPC', 'Branding', 'Web Development'] },
  { name: 'MonoB', slug: 'monob', monthly_hours: 29, color: '#DB2777', account_services: ['SEO', 'Social Media', 'Influencer Marketing'] },
  { name: 'Friar Tux', slug: 'friar-tux', monthly_hours: 26, color: '#1E293B', account_services: ['SEO', 'PPC', 'Web Development'] },
  { name: 'TriStar Insurance', slug: 'tristar-insurance', monthly_hours: 26, color: '#0369A1', account_services: ['SEO', 'PPC', 'Content Marketing'] },
  { name: 'Starboard Realty', slug: 'starboard-realty', monthly_hours: 25, color: '#0F766E', account_services: ['SEO', 'Social Media', 'Web Development'] },
  { name: 'Husbey Crummack', slug: 'husbey-crummack', monthly_hours: 20, color: '#7E22CE', account_services: ['SEO', 'PPC'] },
  { name: 'Labtech PPC', slug: 'labtech-ppc', monthly_hours: 20, color: '#BE185D', account_services: ['PPC', 'Analytics'] },
  { name: 'Labtech SEO', slug: 'labtech-seo', monthly_hours: 15, color: '#C026D3', account_services: ['SEO', 'Content Marketing'] },
  { name: 'Friar Tux Email', slug: 'friar-tux-email', monthly_hours: 15, color: '#334155', account_services: ['Email Marketing'] },
  { name: 'Roger Beltrans', slug: 'roger-beltrans', monthly_hours: 9, color: '#CA8A04', account_services: ['SEO', 'Web Development'] },
  { name: 'Trico Realty', slug: 'trico-realty', monthly_hours: 9, color: '#65A30D', account_services: ['SEO', 'Social Media'] },
  { name: 'IPA 1031 Group', slug: 'ipa-1031-group', monthly_hours: 7, color: '#0284C7', account_services: ['SEO', 'PPC'] },
  { name: 'Posture Pump', slug: 'posture-pump', monthly_hours: 6, color: '#EA580C', account_services: ['SEO'] },
]

const SERVICE_TICKETS = {
  'SEO': [
    { title: 'Technical SEO audit', description: 'Complete technical audit of website', status: 'done', priority: 'high' },
    { title: 'Keyword research', description: 'Research and map target keywords', status: 'done', priority: 'high' },
    { title: 'On-page optimization', description: 'Optimize meta titles, descriptions, headers', status: 'inprogress', priority: 'medium' },
  ],
  'PPC': [
    { title: 'Campaign structure review', description: 'Review and optimize campaign structure', status: 'done', priority: 'high' },
    { title: 'Ad copy optimization', description: 'Write and test new ad variations', status: 'inprogress', priority: 'medium' },
    { title: 'Bid strategy adjustment', description: 'Optimize bidding for conversions', status: 'todo', priority: 'medium' },
  ],
  'Social Media': [
    { title: 'Content calendar', description: 'Create monthly content calendar', status: 'done', priority: 'high' },
    { title: 'Engagement strategy', description: 'Develop community engagement plan', status: 'inprogress', priority: 'medium' },
  ],
  'Email Marketing': [
    { title: 'Email template design', description: 'Design responsive email templates', status: 'done', priority: 'medium' },
    { title: 'Automation flows', description: 'Set up drip campaigns and automations', status: 'inprogress', priority: 'high' },
  ],
  'Web Development': [
    { title: 'Performance optimization', description: 'Improve page load speed', status: 'inprogress', priority: 'high' },
  ],
  'Content Marketing': [
    { title: 'Blog content strategy', description: 'Plan and schedule blog posts', status: 'done', priority: 'medium' },
  ],
  'Branding': [
    { title: 'Brand guidelines', description: 'Document brand standards', status: 'done', priority: 'high' },
  ],
}

function getTicketsForServices(services) {
  const tickets = []
  for (const service of services || ['SEO']) {
    const serviceTickets = SERVICE_TICKETS[service] || []
    tickets.push(...serviceTickets)
  }
  return tickets.slice(0, 6)
}

export async function seedSampleClients() {
  const results = { clients: [], boards: [], tickets: [], errors: [] }
  
  for (const clientData of BRANDASTIC_CLIENTS) {
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .upsert({
        name: clientData.name,
        slug: clientData.slug,
        monthly_hours: clientData.monthly_hours,
        color: clientData.color,
        account_services: clientData.account_services,
        is_active: true,
      }, { onConflict: 'slug' })
      .select()
      .single()
    
    if (clientError) {
      results.errors.push(`Client ${clientData.name}: ${clientError.message}`)
      continue
    }
    
    results.clients.push(client)
    
    const { data: existingBoard } = await supabase
      .from('boards')
      .select()
      .eq('client_id', client.id)
      .limit(1)
      .single()
    
    if (!existingBoard) {
      const { data: board } = await supabase
        .from('boards')
        .insert({
          name: `${clientData.name} - Q1 2025`,
          description: `Main project board for ${clientData.name}`,
          client_id: client.id,
        })
        .select()
        .single()
      
      if (board) {
        results.boards.push(board)
        
        const serviceTickets = getTicketsForServices(clientData.account_services)
        for (let i = 0; i < serviceTickets.length; i++) {
          const ticketData = serviceTickets[i]
          const { data: ticket } = await supabase
            .from('tickets')
            .insert({
              title: ticketData.title,
              description: ticketData.description,
              status: ticketData.status,
              priority: ticketData.priority,
              board_id: board.id,
              client_id: client.id,
              position: i,
            })
            .select()
            .single()
          
          if (ticket) results.tickets.push(ticket)
        }
      }
    }
  }
  
  return results
}

export async function deleteSampleClients() {
  const slugs = BRANDASTIC_CLIENTS.map(c => c.slug)
  
  const { data: clients } = await supabase
    .from('clients')
    .select('id')
    .in('slug', slugs)
  
  if (!clients?.length) return { deleted: 0 }
  
  const clientIds = clients.map(c => c.id)
  
  await supabase.from('tickets').delete().in('client_id', clientIds)
  await supabase.from('boards').delete().in('client_id', clientIds)
  
  const { error } = await supabase
    .from('clients')
    .delete()
    .in('slug', slugs)
  
  return { deleted: clientIds.length, error }
}
