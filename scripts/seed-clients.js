/**
 * Seed sample clients from actual Brandastic data
 * Run with: node scripts/seed-clients.js
 * 
 * Hourly Rate: $175/hr
 * Monthly Hours = Monthly Revenue / 175
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://mjguavikbkqrzlvaizqa.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseKey) {
  console.error('Missing SUPABASE_SERVICE_KEY or VITE_SUPABASE_ANON_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

const HOURLY_RATE = 175

// Real clients from screenshots
const clients = [
  {
    name: 'Calops',
    slug: 'calops',
    monthly_revenue: 21000,
    start_date: '2025-01-14',
    contact_name: 'Alex Johnson',
    contact_email: 'alex@calops.com',
    color: '#4F46E5', // Indigo
    account_services: ['SEO', 'PPC', 'Social Media'],
  },
  {
    name: 'Prudental Labs',
    slug: 'prudental-labs',
    monthly_revenue: 11000,
    start_date: '2025-11-14',
    contact_name: 'Sarah Chen',
    contact_email: 'sarah@prudentallabs.com',
    color: '#059669', // Emerald
    account_services: ['SEO', 'Content Marketing', 'Web Development'],
  },
  {
    name: 'Salvin',
    slug: 'salvin',
    monthly_revenue: 10500,
    start_date: '2025-06-14',
    contact_name: 'Mike Torres',
    contact_email: 'mike@salvin.com',
    color: '#DC2626', // Red
    account_services: ['PPC', 'Email Marketing', 'Branding'],
  },
  {
    name: 'Check\'n Play',
    slug: 'checknplay',
    monthly_revenue: 9600,
    start_date: '2025-01-14',
    contact_name: 'Lisa Wang',
    contact_email: 'lisa@checknplay.com',
    color: '#7C3AED', // Violet
    account_services: ['Social Media', 'Influencer Marketing', 'Video Production'],
  },
  {
    name: 'DESS USA',
    slug: 'dess-usa',
    monthly_revenue: 7800,
    start_date: '2025-01-14',
    contact_name: 'Robert Kim',
    contact_email: 'robert@dessusa.com',
    color: '#0891B2', // Cyan
    account_services: ['SEO', 'PPC', 'Web Development'],
  },
]

async function seedClients() {
  console.log('🌱 Seeding clients...\n')
  console.log(`Hourly Rate: $${HOURLY_RATE}/hr\n`)

  for (const client of clients) {
    // Calculate monthly hours
    const monthly_hours = Math.round(client.monthly_revenue / HOURLY_RATE)
    
    console.log(`📦 ${client.name}`)
    console.log(`   Revenue: $${client.monthly_revenue.toLocaleString()}/month`)
    console.log(`   Hours: ${monthly_hours}h/month`)
    console.log(`   Start: ${client.start_date}`)
    
    const { data, error } = await supabase
      .from('clients')
      .upsert({
        name: client.name,
        slug: client.slug,
        monthly_hours: monthly_hours,
        contact_name: client.contact_name,
        contact_email: client.contact_email,
        color: client.color,
        account_services: client.account_services,
        is_active: true,
      }, {
        onConflict: 'slug',
      })
      .select()

    if (error) {
      console.log(`   ❌ Error: ${error.message}`)
    } else {
      console.log(`   ✅ Created/Updated`)
    }
    console.log()
  }

  console.log('✨ Done seeding clients!')
}

seedClients()
