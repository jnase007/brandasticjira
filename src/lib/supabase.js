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
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
})

// ============================================
// AUTH HELPERS
// ============================================

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
    .single()
  return { data, error }
}

export async function updateProfile(userId, updates) {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single()
  return { data, error }
}

// ============================================
// CLIENTS HELPERS
// ============================================

export async function getClients() {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('is_active', true)
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
    .select(`
      *,
      assigned_user:profiles!tickets_assigned_to_fkey(id, full_name, avatar_url)
    `)
    .order('position')

  if (boardId) {
    query = query.eq('board_id', boardId)
  }
  if (clientId) {
    query = query.eq('client_id', clientId)
  }

  const { data, error } = await query
  return { data, error }
}

export async function getTicket(ticketId) {
  const { data, error } = await supabase
    .from('tickets')
    .select(`
      *,
      board:boards(id, name, client_id),
      client:clients(id, name, color),
      assigned_user:profiles!tickets_assigned_to_fkey(id, full_name, avatar_url, email),
      creator:profiles!tickets_created_by_fkey(id, full_name, avatar_url)
    `)
    .eq('id', ticketId)
    .single()
  return { data, error }
}

export async function getTicketByTicketId(ticketIdString) {
  const { data, error } = await supabase
    .from('tickets')
    .select(`
      *,
      board:boards(id, name, client_id),
      client:clients(id, name, color),
      assigned_user:profiles!tickets_assigned_to_fkey(id, full_name, avatar_url, email),
      creator:profiles!tickets_created_by_fkey(id, full_name, avatar_url)
    `)
    .eq('ticket_id', ticketIdString)
    .single()
  return { data, error }
}

export async function createTicket(ticketData) {
  const { data, error } = await supabase
    .from('tickets')
    .insert(ticketData)
    .select(`
      *,
      assigned_user:profiles!tickets_assigned_to_fkey(id, full_name, avatar_url)
    `)
    .single()
  return { data, error }
}

export async function updateTicket(ticketId, updates) {
  const { data, error } = await supabase
    .from('tickets')
    .update(updates)
    .eq('id', ticketId)
    .select(`
      *,
      assigned_user:profiles!tickets_assigned_to_fkey(id, full_name, avatar_url)
    `)
    .single()
  return { data, error }
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
  const { data, error } = await supabase
    .from('comments')
    .select(`
      *,
      user:profiles(id, full_name, avatar_url)
    `)
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true })
  return { data, error }
}

export async function createComment(commentData) {
  const { data, error } = await supabase
    .from('comments')
    .insert(commentData)
    .select(`
      *,
      user:profiles(id, full_name, avatar_url)
    `)
    .single()
  return { data, error }
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

  const { data, error } = await query
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
  const { data, error } = await supabase
    .from('time_entries')
    .insert({
      ticket_id: ticketId,
      client_id: clientId,
      user_id: userId,
      start_time: new Date().toISOString(),
      is_running: true,
      notes,
    })
    .select()
    .single()
  return { data, error }
}

export async function stopTimeEntry(entryId) {
  const endTime = new Date().toISOString()
  const { data, error } = await supabase
    .from('time_entries')
    .update({
      end_time: endTime,
      is_running: false,
    })
    .eq('id', entryId)
    .select()
    .single()
  return { data, error }
}

export async function createManualTimeEntry(entryData) {
  const { data, error } = await supabase
    .from('time_entries')
    .insert({
      ...entryData,
      is_running: false,
      duration_minutes: Math.round(
        (new Date(entryData.end_time) - new Date(entryData.start_time)) / 60000
      ),
    })
    .select()
    .single()
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
  const { data, error } = await supabase
    .from('client_hours_summary')
    .select('*')
  return { data, error }
}

// ============================================
// STORAGE HELPERS
// ============================================

export async function uploadAttachment(file, clientId, ticketId) {
  const fileExt = file.name.split('.').pop()
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
  const filePath = `${clientId}/${ticketId}/${fileName}`

  const { data, error } = await supabase.storage
    .from('attachments')
    .upload(filePath, file)

  if (error) {
    return { data: null, error }
  }

  // Get the public URL (or signed URL for private buckets)
  const { data: urlData } = supabase.storage
    .from('attachments')
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
    .from('attachments')
    .remove([filePath])
  return { error }
}

export async function getAttachmentUrl(filePath) {
  const { data } = await supabase.storage
    .from('attachments')
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
      client:clients(id, name, color)
    `)
    .or(`title.ilike.%${query}%,ticket_id.ilike.%${query}%,description.ilike.%${query}%`)
    .limit(20)
  return { data, error }
}

// ============================================
// SAMPLE DATA SEEDING
// ============================================

const SAMPLE_CLIENTS = [
  {
    name: 'Calops',
    slug: 'calops',
    monthly_hours: 120, // $21,000 @ $175/hr
    contact_name: 'Alex Johnson',
    contact_email: 'alex@calops.com',
    color: '#4F46E5',
    account_services: ['SEO', 'PPC', 'Social Media'],
  },
  {
    name: 'Prudental Labs',
    slug: 'prudental-labs',
    monthly_hours: 63, // $11,000 @ $175/hr
    contact_name: 'Sarah Chen',
    contact_email: 'sarah@prudentallabs.com',
    color: '#059669',
    account_services: ['SEO', 'Content Marketing', 'Web Development'],
  },
  {
    name: 'Salvin',
    slug: 'salvin',
    monthly_hours: 60, // $10,500 @ $175/hr
    contact_name: 'Mike Torres',
    contact_email: 'mike@salvin.com',
    color: '#DC2626',
    account_services: ['PPC', 'Email Marketing', 'Branding'],
  },
  {
    name: "Check'n Play",
    slug: 'checknplay',
    monthly_hours: 55, // $9,600 @ $175/hr
    contact_name: 'Lisa Wang',
    contact_email: 'lisa@checknplay.com',
    color: '#7C3AED',
    account_services: ['Social Media', 'Influencer Marketing', 'Video Production'],
  },
  {
    name: 'DESS USA',
    slug: 'dess-usa',
    monthly_hours: 45, // $7,800 @ $175/hr
    contact_name: 'Robert Kim',
    contact_email: 'robert@dessusa.com',
    color: '#0891B2',
    account_services: ['SEO', 'PPC', 'Web Development'],
  },
]

const SAMPLE_BOARDS = {
  'calops': { name: 'Q1 2025 Marketing Campaign', description: 'Main marketing initiatives for Q1' },
  'prudental-labs': { name: 'Website Redesign', description: 'Full website overhaul and optimization' },
  'salvin': { name: 'Brand Refresh', description: 'Logo, colors, and brand guidelines update' },
  'checknplay': { name: 'Social Media Launch', description: 'New social media presence and campaigns' },
  'dess-usa': { name: 'SEO Optimization', description: 'Technical SEO and content strategy' },
}

const SAMPLE_TICKETS = [
  { status: 'done', priority: 'high', title: 'Keyword research', description: 'Research top 50 keywords for campaign' },
  { status: 'done', priority: 'medium', title: 'Competitor analysis', description: 'Analyze top 5 competitors' },
  { status: 'inprogress', priority: 'high', title: 'Landing page design', description: 'Design new landing page for campaign' },
  { status: 'inprogress', priority: 'medium', title: 'Ad copy writing', description: 'Write copy for Google Ads' },
  { status: 'todo', priority: 'high', title: 'Campaign setup', description: 'Set up Google Ads campaign' },
  { status: 'todo', priority: 'low', title: 'Reporting dashboard', description: 'Create monthly reporting dashboard' },
]

export async function seedSampleClients() {
  const results = { clients: [], boards: [], tickets: [], errors: [] }
  
  for (const clientData of SAMPLE_CLIENTS) {
    // Upsert client
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .upsert({
        ...clientData,
        is_active: true,
      }, { onConflict: 'slug' })
      .select()
      .single()
    
    if (clientError) {
      results.errors.push(`Client ${clientData.name}: ${clientError.message}`)
      continue
    }
    
    results.clients.push(client)
    
    // Create board
    const boardInfo = SAMPLE_BOARDS[clientData.slug]
    if (boardInfo) {
      const { data: existingBoard } = await supabase
        .from('boards')
        .select()
        .eq('client_id', client.id)
        .eq('name', boardInfo.name)
        .single()
      
      if (!existingBoard) {
        const { data: board, error: boardError } = await supabase
          .from('boards')
          .insert({
            name: boardInfo.name,
            description: boardInfo.description,
            client_id: client.id,
          })
          .select()
          .single()
        
        if (board) {
          results.boards.push(board)
          
          // Create sample tickets for this board
          for (let i = 0; i < SAMPLE_TICKETS.length; i++) {
            const ticketData = SAMPLE_TICKETS[i]
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
    
    // Set client hourly rate
    await supabase
      .from('client_hourly_rates')
      .upsert({
        client_id: client.id,
        rate_per_hour: 175.00,
        effective_date: new Date().toISOString().split('T')[0],
      }, { onConflict: 'client_id,effective_date' })
  }
  
  return results
}

export async function deleteSampleClients() {
  const slugs = SAMPLE_CLIENTS.map(c => c.slug)
  
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
