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
