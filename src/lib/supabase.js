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
    storage: localStorage, // Explicitly use localStorage for persistence
    storageKey: 'brandastic-auth', // Custom storage key
    flowType: 'pkce', // More secure flow
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
  global: {
    headers: {
      'x-client-info': 'brandastic-pm',
    },
  },
})

// ============================================
// SESSION HEALTH MONITOR
// ============================================

// Track session health state
let sessionHealthy = true
let lastHealthCheck = 0
let healthCheckInProgress = false
let consecutiveFailures = 0
const MAX_CONSECUTIVE_FAILURES = 3

// Event system for session state changes
const sessionListeners = new Set()

export function onSessionHealthChange(callback) {
  sessionListeners.add(callback)
  return () => sessionListeners.delete(callback)
}

function notifySessionHealthChange(healthy, reason) {
  sessionHealthy = healthy
  sessionListeners.forEach(cb => {
    try {
      cb(healthy, reason)
    } catch (e) {
      console.error('[SessionHealth] Listener error:', e)
    }
  })
}

/**
 * Performs a health check on the current session.
 * Returns true if session is valid, false if recovery is needed.
 */
export async function checkSessionHealth() {
  const now = Date.now()
  
  // Debounce health checks (max once per 5 seconds)
  if (now - lastHealthCheck < 5000) {
    return sessionHealthy
  }
  
  if (healthCheckInProgress) {
    return sessionHealthy
  }
  
  healthCheckInProgress = true
  lastHealthCheck = now
  
  try {
    // Use getUser() for authoritative server-side validation
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error) {
      if (error.name === 'AuthSessionMissingError') {
        // No session - this is expected when logged out
        consecutiveFailures = 0
        healthCheckInProgress = false
        return true
      }
      
      console.warn('[SessionHealth] Check failed:', error.message)
      consecutiveFailures++
      
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        console.error('[SessionHealth] Multiple failures, attempting recovery...')
        const recovered = await attemptSessionRecovery()
        if (!recovered) {
          notifySessionHealthChange(false, 'Session recovery failed')
        }
        consecutiveFailures = 0
        healthCheckInProgress = false
        return recovered
      }
      
      healthCheckInProgress = false
      return false
    }
    
    if (!user) {
      healthCheckInProgress = false
      return true // No user = logged out state, which is valid
    }
    
    // Session is healthy
    consecutiveFailures = 0
    if (!sessionHealthy) {
      notifySessionHealthChange(true, 'Session recovered')
    }
    
    healthCheckInProgress = false
    return true
  } catch (e) {
    console.error('[SessionHealth] Exception:', e)
    consecutiveFailures++
    healthCheckInProgress = false
    return false
  }
}

/**
 * Attempts to recover a stale or invalid session.
 */
async function attemptSessionRecovery() {
  console.log('[SessionHealth] Attempting session recovery...')
  
  try {
    // First, try to refresh the session
    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession()
    
    if (refreshError) {
      console.warn('[SessionHealth] Refresh failed:', refreshError.message)
      
      // Check if this is a fatal error (refresh token expired/invalid)
      if (refreshError.message?.includes('refresh_token') ||
          refreshError.message?.includes('Invalid Refresh Token') ||
          refreshError.message?.includes('Already Used')) {
        console.error('[SessionHealth] Refresh token invalid - user needs to re-login')
        notifySessionHealthChange(false, 'Refresh token expired')
        return false
      }
      
      // For network errors, the session might still be valid
      return true
    }
    
    if (refreshData?.session) {
      console.log('[SessionHealth] Session refreshed successfully')
      notifySessionHealthChange(true, 'Session refreshed')
      return true
    }
    
    return false
  } catch (e) {
    console.error('[SessionHealth] Recovery exception:', e)
    return false
  }
}

/**
 * Force a session refresh. Call this when you suspect the session is stale.
 */
export async function forceSessionRefresh() {
  console.log('[Session] Force refresh requested...')
  
  try {
    const { data, error } = await supabase.auth.refreshSession()
    
    if (error) {
      console.error('[Session] Force refresh failed:', error.message)
      notifySessionHealthChange(false, error.message)
      return false
    }
    
    if (data?.session) {
      console.log('[Session] Force refresh successful')
      notifySessionHealthChange(true, 'Force refreshed')
      return true
    }
    
    return false
  } catch (e) {
    console.error('[Session] Force refresh exception:', e)
    return false
  }
}

// ============================================
// AUTH HELPERS
// ============================================

/**
 * Ensures the session is valid before making a request.
 * Uses getUser() for secure server-side validation (recommended by Supabase).
 * Proactively refreshes if token is expiring soon.
 * Returns true if session is valid, false if user needs to re-login.
 */
export async function ensureValidSession() {
  try {
    // Use getUser() for secure server-side validation
    // This validates the JWT with Supabase servers, unlike getSession() which only reads local storage
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError) {
      // AuthSessionMissingError is expected when not logged in
      if (userError.name !== 'AuthSessionMissingError') {
        console.warn('[Session] Error validating user:', userError.message)
      }
      return false
    }
    
    if (!user) {
      console.warn('[Session] No authenticated user')
      return false
    }
    
    // Get session for expiry info (needed for proactive refresh timing)
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) {
      // User is valid but no session - this shouldn't happen, but handle gracefully
      return true
    }
    
    // Check if token is expiring soon (within 5 minutes)
    const expiresAt = session.expires_at
    const now = Math.floor(Date.now() / 1000)
    const expiresIn = expiresAt - now
    
    if (expiresIn < 300) { // Less than 5 minutes
      console.log(`[Session] Token expiring in ${expiresIn}s, refreshing...`)
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession()
      
      if (refreshError) {
        console.warn('[Session] Refresh failed:', refreshError.message)
        // Check if it's a fatal error (refresh token expired)
        if (refreshError.message?.includes('refresh_token') || 
            refreshError.message?.includes('expired') ||
            refreshError.message?.includes('invalid')) {
          return false
        }
        // For other errors, session might still work
        return true
      }
      
      console.log('[Session] Token refreshed successfully')
      return !!refreshData?.session
    }
    
    return true
  } catch (e) {
    console.error('[Session] Error validating session:', e)
    return false
  }
}

/**
 * Wrapper for Supabase queries that handles auth errors gracefully.
 * If a query fails due to auth issues, it attempts to refresh and retry.
 * Includes exponential backoff for retries.
 */
export async function safeQuery(queryFn, options = {}) {
  const { maxRetries = 2, retryDelay = 500 } = options
  let lastError = null
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await queryFn()
      
      // Check for auth-related errors
      if (result.error) {
        const errorMsg = result.error.message?.toLowerCase() || ''
        const errorCode = result.error.code || ''
        
        const isAuthError = 
          errorMsg.includes('jwt') || 
          errorMsg.includes('expired') || 
          errorMsg.includes('invalid') ||
          errorMsg.includes('not authenticated') ||
          errorMsg.includes('permission denied') ||
          errorCode === 'PGRST301' ||
          errorCode === '401' ||
          errorCode === '403'
        
        if (isAuthError && attempt < maxRetries) {
          console.warn(`[SafeQuery] Auth error on attempt ${attempt + 1}, refreshing session...`)
          
          // Wait before retry (exponential backoff)
          if (attempt > 0) {
            await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, attempt)))
          }
          
          const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession()
          
          if (!refreshError && refreshData?.session) {
            console.log('[SafeQuery] Session refreshed, retrying query...')
            notifySessionHealthChange(true, 'Session refreshed after query error')
            continue // Retry the query
          } else {
            // Refresh failed, notify listeners
            notifySessionHealthChange(false, 'Failed to refresh session')
            lastError = result.error
            break
          }
        }
        
        // Non-auth error or max retries reached
        lastError = result.error
      }
      
      // Success or non-retryable error
      return result
    } catch (e) {
      console.error(`[SafeQuery] Exception on attempt ${attempt + 1}:`, e)
      lastError = e
      
      // Don't retry on network errors immediately
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, attempt)))
      }
    }
  }
  
  return { data: null, error: lastError }
}

export async function signInWithEmail(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  return { data, error }
}

export async function signUpWithEmail(email, password, metadata = {}) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: metadata,
    },
  })
  return { data, error }
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
    .maybeSingle() // Returns null instead of error if not found
  return { data, error }
}

export async function updateProfile(userId, updates) {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
  // Return first result or null
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
      client:clients(id, name, color)
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
      client:clients(id, name, color, monthly_hours)
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
    .select('*, client:clients(id, name, slug)')
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
  // First get the ticket with basic joins
  const { data: ticket, error } = await supabase
    .from('tickets')
    .select(`
      *,
      board:boards(id, name, client_id),
      client:clients(id, name, color, slug)
    `)
    .eq('id', ticketId)
    .maybeSingle()
  
  if (error || !ticket) {
    return { data: null, error }
  }
  
  // Fetch assigned user and creator profiles separately to avoid foreign key issues
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
  // First get the ticket with basic joins
  const { data: ticket, error } = await supabase
    .from('tickets')
    .select(`
      *,
      board:boards(id, name, client_id),
      client:clients(id, name, color, slug)
    `)
    .eq('ticket_id', ticketIdString)
    .maybeSingle()
  
  if (error || !ticket) {
    return { data: null, error }
  }
  
  // Fetch assigned user and creator profiles separately
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
  
  // Fetch assigned user profile separately
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
  
  // Fetch assigned user profile separately if needed
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
  // Batch update positions
  const promises = updates.map(({ id, position, status }) =>
    supabase
      .from('tickets')
      .update({ position, status })
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
  // Fetch comments first
  const { data: comments, error } = await supabase
    .from('comments')
    .select('*')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true })
  
  if (error || !comments) {
    return { data: null, error }
  }
  
  // Fetch user profiles separately to avoid relationship issues
  const userIds = [...new Set(comments.map(c => c.user_id).filter(Boolean))]
  let users = []
  
  if (userIds.length > 0) {
    const { data: usersData } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', userIds)
    users = usersData || []
  }
  
  // Map users to comments
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
  // Insert the comment
  const { data: comment, error } = await supabase
    .from('comments')
    .insert(commentData)
    .select('*')
    .single()
  
  if (error || !comment) {
    return { data: null, error }
  }
  
  // Fetch the user profile separately
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

  // Fallback for older schemas or missing relationships
  if (error && (error.message?.includes('start_time') || error.message?.includes('relationship') || error.message?.includes('schema cache'))) {
    let fallbackQuery = supabase
      .from('time_entries')
      .select(`
        *
      `)
      .order('created_at', { ascending: false })

    if (ticketId) {
      fallbackQuery = fallbackQuery.eq('ticket_id', ticketId)
    }
    if (clientId) {
      fallbackQuery = fallbackQuery.eq('client_id', clientId)
    }
    if (startDate) {
      fallbackQuery = fallbackQuery.gte('created_at', startDate)
    }
    if (endDate) {
      fallbackQuery = fallbackQuery.lte('created_at', endDate)
    }

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

      const userMap = users.reduce((acc, user) => {
        acc[user.id] = user
        return acc
      }, {})
      const ticketMap = tickets.reduce((acc, ticket) => {
        acc[ticket.id] = ticket
        return acc
      }, {})

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

  const updatePayload = {
    end_time: endTime.toISOString(),
    is_running: false,
    duration_minutes: durationMinutes,
    minutes: durationMinutes,
    date: endTime.toISOString().split('T')[0],
  }

  let { data, error } = await supabase
    .from('time_entries')
    .update(updatePayload)
    .eq('id', entryId)
    .select()
    .single()

  // Fallback for older schemas missing some columns
  if (error && error.message?.includes('column')) {
    const fallbackPayload = {
      end_time: endTime.toISOString(),
      is_running: false,
    }
    ;({ data, error } = await supabase
      .from('time_entries')
      .update(fallbackPayload)
      .eq('id', entryId)
      .select()
      .single())
  }

  return { data, error }
}

export async function createManualTimeEntry(entryData) {
  const startDate = entryData.start_time ? new Date(entryData.start_time) : new Date()
  const endDate = entryData.end_time ? new Date(entryData.end_time) : new Date()
  const durationSeconds = Math.max(
    1,
    entryData.duration_seconds ?? Math.round((endDate - startDate) / 1000)
  )
  const durationMinutes = Math.max(1, Math.ceil(durationSeconds / 60))
  
  // Build payload with only fields that definitely exist
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

  // If error mentions a column, try minimal payload
  if (error && error.message?.includes('column')) {
    console.warn('Time entry insert failed, trying minimal payload:', error.message)
    const minimalPayload = {
      user_id: entryData.user_id,
      ticket_id: entryData.ticket_id ?? null,
      description: entryData.description ?? null,
      minutes: durationMinutes,
      date: startDate.toISOString().split('T')[0],
      is_running: false,
    }
    ;({ data, error } = await supabase
      .from('time_entries')
      .insert(minimalPayload)
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
    // First try the view
    const { data, error } = await supabase
      .from('client_hours_summary')
      .select('*')
    
    // If view works and has data, return it
    if (!error && data && data.length > 0) {
      console.log('[ClientHoursSummary] View returned', data.length, 'records')
      return { data, error: null }
    }
    
    // Fallback: calculate from clients and time_entries tables
    console.log('[ClientHoursSummary] View empty or failed, calculating from raw data...')
    
    // Get all clients
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id, name, color, monthly_hours')
      .neq('is_active', false)
    
    if (clientsError || !clients) {
      console.warn('[ClientHoursSummary] Failed to fetch clients:', clientsError)
      return { data: [], error: null }
    }
    
    // Get current month's time entries grouped by client
    const now = new Date()
    const startOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    const startOfNextMonth = now.getMonth() === 11
      ? `${now.getFullYear() + 1}-01-01`
      : `${now.getFullYear()}-${String(now.getMonth() + 2).padStart(2, '0')}-01`
    
    const { data: timeEntries, error: timeError } = await supabase
      .from('time_entries')
      .select('client_id, minutes')
      .gte('date', startOfMonth)
      .lt('date', startOfNextMonth)
    
    if (timeError) {
      console.warn('[ClientHoursSummary] Failed to fetch time entries:', timeError)
    }
    
    // Calculate hours per client
    const hoursByClient = {}
    for (const entry of timeEntries || []) {
      if (entry.client_id) {
        hoursByClient[entry.client_id] = (hoursByClient[entry.client_id] || 0) + (entry.minutes || 0) / 60
      }
    }
    
    // Build summary
    const summary = clients.map(client => ({
      client_id: client.id,
      client_name: client.name,
      color: client.color,
      monthly_hours: client.monthly_hours || 0,
      hours_used: Math.round((hoursByClient[client.id] || 0) * 10) / 10,
    }))
    
    console.log('[ClientHoursSummary] Calculated summary for', summary.length, 'clients')
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

  // Get the public URL (or signed URL for private buckets)
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
    .createSignedUrl(filePath, 3600) // 1 hour expiry
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
      client:clients(id, name, color, slug)
    `)
    .or(`title.ilike.%${query}%,ticket_id.ilike.%${query}%,description.ilike.%${query}%`)
    .limit(20)
  return { data, error }
}

// Global search - searches tickets, clients, and team members
export async function globalSearch(query) {
  const searchTerm = `%${query}%`
  
  const [ticketsRes, clientsRes, teamRes] = await Promise.all([
    // Search tickets
    supabase
      .from('tickets')
      .select(`
        id, title, ticket_id, status, priority,
        board:boards(id, name),
        client:clients(id, name, color, slug)
      `)
      .or(`title.ilike.${searchTerm},ticket_id.ilike.${searchTerm},description.ilike.${searchTerm}`)
      .limit(10),
    
    // Search clients
    supabase
      .from('clients')
      .select('id, name, color, slug, contact_email, contact_name')
      .or(`name.ilike.${searchTerm},contact_email.ilike.${searchTerm},contact_name.ilike.${searchTerm}`)
      .neq('is_active', false)
      .limit(10),
    
    // Search team members
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
// REAL CLIENT DATA - ALL BRANDASTIC CLIENTS
// $175/hr billing rate
// ============================================

const BRANDASTIC_CLIENTS = [
  // $21,000/mo = 120 hours
  { name: 'Calops', slug: 'calops', monthly_hours: 120, monthly_revenue: 21000, start_date: '2025-01-14', color: '#4F46E5', account_services: ['SEO', 'PPC', 'Social Media'] },
  // $11,000/mo = 63 hours
  { name: 'Prudental Labs', slug: 'prudental-labs', monthly_hours: 63, monthly_revenue: 11000, start_date: '2025-11-14', color: '#059669', account_services: ['SEO', 'Content Marketing', 'Web Development'] },
  // $10,500/mo = 60 hours
  { name: 'Salvin', slug: 'salvin', monthly_hours: 60, monthly_revenue: 10500, start_date: '2025-06-14', color: '#DC2626', account_services: ['PPC', 'Email Marketing', 'Branding'] },
  // $10,000/mo = 57 hours
  { name: 'Wearparts LLC', slug: 'wearparts-llc', monthly_hours: 57, monthly_revenue: 10000, start_date: '2025-08-14', color: '#EA580C', account_services: ['SEO', 'PPC', 'Web Development'] },
  // $9,600/mo = 55 hours
  { name: "Check'n Play", slug: 'checknplay', monthly_hours: 55, monthly_revenue: 9600, start_date: '2025-01-14', color: '#7C3AED', account_services: ['Social Media', 'Influencer Marketing', 'Video Production'] },
  // $9,100/mo = 52 hours
  { name: 'Young Surgical', slug: 'young-surgical', monthly_hours: 52, monthly_revenue: 9100, start_date: '2025-01-14', color: '#0D9488', account_services: ['SEO', 'PPC', 'Content Marketing'] },
  // $7,800/mo = 45 hours
  { name: 'DESS USA', slug: 'dess-usa', monthly_hours: 45, monthly_revenue: 7800, start_date: '2025-01-14', color: '#0891B2', account_services: ['SEO', 'PPC', 'Web Development'] },
  // $5,880/mo = 34 hours
  { name: 'Adopt Hwy', slug: 'adopt-hwy', monthly_hours: 34, monthly_revenue: 5880, start_date: '2025-01-14', color: '#16A34A', account_services: ['Social Media', 'Content Marketing'] },
  // $5,250/mo = 30 hours
  { name: 'Christian Heart School', slug: 'christian-heart-school', monthly_hours: 30, monthly_revenue: 5250, start_date: '2025-12-14', color: '#2563EB', account_services: ['SEO', 'Social Media', 'Email Marketing'] },
  // $5,250/mo = 30 hours
  { name: 'Morehouse', slug: 'morehouse', monthly_hours: 30, monthly_revenue: 5250, start_date: '2026-01-14', color: '#9333EA', account_services: ['PPC', 'Branding', 'Web Development'] },
  // $5,000/mo = 29 hours
  { name: 'MonoB', slug: 'monob', monthly_hours: 29, monthly_revenue: 5000, start_date: '2025-12-14', color: '#DB2777', account_services: ['SEO', 'Social Media', 'Influencer Marketing'] },
  // $4,550/mo = 26 hours
  { name: 'Friar Tux', slug: 'friar-tux', monthly_hours: 26, monthly_revenue: 4550, start_date: '2025-01-14', color: '#1E293B', account_services: ['SEO', 'PPC', 'Web Development'] },
  // $4,500/mo = 26 hours
  { name: 'TriStar Insurance', slug: 'tristar-insurance', monthly_hours: 26, monthly_revenue: 4500, start_date: '2025-12-31', color: '#0369A1', account_services: ['SEO', 'PPC', 'Content Marketing'] },
  // $4,350/mo = 25 hours
  { name: 'Starboard Realty', slug: 'starboard-realty', monthly_hours: 25, monthly_revenue: 4350, start_date: '2025-06-14', color: '#0F766E', account_services: ['SEO', 'Social Media', 'Web Development'] },
  // $3,500/mo = 20 hours
  { name: 'Husbey Crummack', slug: 'husbey-crummack', monthly_hours: 20, monthly_revenue: 3500, start_date: '2025-11-14', color: '#7E22CE', account_services: ['SEO', 'PPC'] },
  // $3,500/mo = 20 hours
  { name: 'Labtech PPC', slug: 'labtech-ppc', monthly_hours: 20, monthly_revenue: 3500, start_date: '2025-12-14', color: '#BE185D', account_services: ['PPC', 'Analytics'] },
  // $2,650/mo = 15 hours
  { name: 'Labtech SEO', slug: 'labtech-seo', monthly_hours: 15, monthly_revenue: 2650, start_date: '2025-01-14', color: '#C026D3', account_services: ['SEO', 'Content Marketing'] },
  // $2,600/mo = 15 hours
  { name: 'Friar Tux Email', slug: 'friar-tux-email', monthly_hours: 15, monthly_revenue: 2600, start_date: '2025-12-14', color: '#334155', account_services: ['Email Marketing'] },
  // $1,500/mo = 9 hours
  { name: 'Roger Beltrans', slug: 'roger-beltrans', monthly_hours: 9, monthly_revenue: 1500, start_date: '2025-05-14', color: '#CA8A04', account_services: ['SEO', 'Web Development'] },
  // $1,500/mo = 9 hours
  { name: 'Trico Realty', slug: 'trico-realty', monthly_hours: 9, monthly_revenue: 1500, start_date: '2025-01-14', color: '#65A30D', account_services: ['SEO', 'Social Media'] },
  // $1,199/mo = 7 hours
  { name: 'IPA 1031 Group', slug: 'ipa-1031-group', monthly_hours: 7, monthly_revenue: 1199, start_date: '2025-01-14', color: '#0284C7', account_services: ['SEO', 'PPC'] },
  // $1,000/mo = 6 hours
  { name: 'Posture Pump', slug: 'posture-pump', monthly_hours: 6, monthly_revenue: 1000, start_date: '2025-01-14', color: '#EA580C', account_services: ['SEO'] },
]

// Total Monthly Revenue: $130,434
// Total Monthly Hours: 745

const SAMPLE_TICKETS = [
  { status: 'done', priority: 'high', title: 'Keyword research', description: 'Research top 50 keywords for campaign' },
  { status: 'done', priority: 'medium', title: 'Competitor analysis', description: 'Analyze top 5 competitors' },
  { status: 'inprogress', priority: 'high', title: 'Landing page design', description: 'Design new landing page for campaign' },
  { status: 'inprogress', priority: 'medium', title: 'Ad copy writing', description: 'Write copy for Google Ads' },
  { status: 'todo', priority: 'high', title: 'Campaign setup', description: 'Set up Google Ads campaign' },
  { status: 'todo', priority: 'low', title: 'Reporting dashboard', description: 'Create monthly reporting dashboard' },
]

export async function seedSampleClients() {
  const results = { clients: [], boards: [], tickets: [], rates: [], errors: [] }
  
  for (const clientData of BRANDASTIC_CLIENTS) {
    // Calculate monthly revenue from hours (or use provided)
    const monthlyRevenue = clientData.monthly_revenue || (clientData.monthly_hours * 175)
    
    // Upsert client
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .upsert({
        name: clientData.name,
        slug: clientData.slug,
        monthly_hours: clientData.monthly_hours,
        color: clientData.color,
        account_services: clientData.account_services,
        is_active: true,
        // Store start date in created_at if needed, or use a custom field
      }, { onConflict: 'slug' })
      .select()
      .single()
    
    if (clientError) {
      results.errors.push(`Client ${clientData.name}: ${clientError.message}`)
      continue
    }
    
    results.clients.push({ ...client, monthly_revenue: monthlyRevenue })
    
    // Create main board for client
    const boardName = `${clientData.name} - Q1 2025`
    const { data: existingBoard } = await supabase
      .from('boards')
      .select()
      .eq('client_id', client.id)
      .limit(1)
      .single()
    
    if (!existingBoard) {
      const { data: board, error: boardError } = await supabase
        .from('boards')
        .insert({
          name: boardName,
          description: `Main project board for ${clientData.name}`,
          client_id: client.id,
        })
        .select()
        .single()
      
      if (board) {
        results.boards.push(board)
        
        // Create sample tickets based on services
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
    
    // Set client hourly rate ($175/hr)
    const { data: rate } = await supabase
      .from('client_hourly_rates')
      .upsert({
        client_id: client.id,
        rate_per_hour: 175.00,
        effective_date: clientData.start_date || '2025-01-14',
      }, { onConflict: 'client_id,effective_date' })
      .select()
      .single()
    
    if (rate) results.rates.push(rate)
  }
  
  return results
}

// Generate relevant tickets based on client services
function getTicketsForServices(services) {
  const serviceTicketTemplates = {
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
      { title: 'Analytics review', description: 'Monthly performance analysis', status: 'todo', priority: 'low' },
    ],
    'Email Marketing': [
      { title: 'Email template design', description: 'Design responsive email templates', status: 'done', priority: 'medium' },
      { title: 'Automation flows', description: 'Set up drip campaigns and automations', status: 'inprogress', priority: 'high' },
    ],
    'Web Development': [
      { title: 'Performance optimization', description: 'Improve page load speed', status: 'inprogress', priority: 'high' },
      { title: 'Mobile responsiveness', description: 'Ensure site works on all devices', status: 'todo', priority: 'medium' },
    ],
    'Content Marketing': [
      { title: 'Blog content strategy', description: 'Plan and schedule blog posts', status: 'done', priority: 'medium' },
      { title: 'Content creation', description: 'Write and publish new content', status: 'inprogress', priority: 'medium' },
    ],
    'Branding': [
      { title: 'Brand guidelines', description: 'Document brand standards', status: 'done', priority: 'high' },
      { title: 'Visual assets', description: 'Create branded visual assets', status: 'inprogress', priority: 'medium' },
    ],
  }
  
  const tickets = []
  for (const service of services || ['SEO']) {
    const serviceTickets = serviceTicketTemplates[service] || []
    tickets.push(...serviceTickets)
  }
  
  // Limit to 6 tickets max per client and shuffle statuses
  return tickets.slice(0, 6)
}

export async function deleteSampleClients() {
  const slugs = BRANDASTIC_CLIENTS.map(c => c.slug)
  
  // Get client IDs
  const { data: clients } = await supabase
    .from('clients')
    .select('id')
    .in('slug', slugs)
  
  if (!clients?.length) return { deleted: 0 }
  
  const clientIds = clients.map(c => c.id)
  
  // Delete in order: tickets, boards, client_hourly_rates, clients
  await supabase.from('tickets').delete().in('client_id', clientIds)
  await supabase.from('boards').delete().in('client_id', clientIds)
  await supabase.from('client_hourly_rates').delete().in('client_id', clientIds)
  
  const { error } = await supabase
    .from('clients')
    .delete()
    .in('slug', slugs)
  
  return { deleted: clientIds.length, error }
}
