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
  try {
    const { data, error } = await supabase
      .from('client_hours_summary')
      .select('*')
    
    // If view doesn't exist, return empty array gracefully
    if (error && (error.message?.includes('does not exist') || error.code === '42P01')) {
      console.warn('client_hours_summary view not found, using fallback')
      return { data: [], error: null }
    }
    
    return { data: data || [], error }
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
