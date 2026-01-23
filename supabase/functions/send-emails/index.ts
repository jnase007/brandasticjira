// =====================================================
// SUPABASE EDGE FUNCTION: Send Email Notifications
// =====================================================
// This function processes the email queue and sends emails
// via Resend (recommended) or your preferred email provider.
//
// Deploy: supabase functions deploy send-emails
// Schedule: Set up a cron to call this every 1-5 minutes
// =====================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Email provider - using Resend (https://resend.com)
// You can swap this for SendGrid, Postmark, etc.
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

// Your domain for email sending
const FROM_EMAIL = 'notifications@brandastic.co'
const FROM_NAME = 'Brandastic PM'

// Email templates
const templates = {
  ticket_assigned: (data: any) => ({
    subject: data.subject || `New Ticket Assigned: ${data.ticket_title}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #FF6B35 0%, #FF8F5E 100%); padding: 24px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">New Ticket Assigned</h1>
        </div>
        <div style="padding: 24px; background: #f9fafb;">
          <p style="color: #374151; font-size: 16px; margin: 0 0 16px;">
            Hi ${data.to_name || 'there'},
          </p>
          <p style="color: #374151; font-size: 16px; margin: 0 0 16px;">
            ${data.assigned_by || 'A team member'} has assigned you a new ticket:
          </p>
          
          <div style="background: white; border-radius: 8px; padding: 16px; border-left: 4px solid #FF6B35;">
            <h2 style="color: #1f2937; font-size: 18px; margin: 0 0 8px;">
              ${data.ticket_title || 'Untitled Ticket'}
            </h2>
            <p style="color: #6b7280; font-size: 14px; margin: 0;">
              ${data.client_name ? `Client: ${data.client_name}` : ''}
              ${data.priority ? ` • Priority: ${data.priority}` : ''}
              ${data.due_date ? ` • Due: ${new Date(data.due_date).toLocaleDateString()}` : ''}
            </p>
          </div>
          
          <div style="margin-top: 24px; text-align: center;">
            <a href="https://brandastic.co${data.url || '/dashboard'}" 
               style="display: inline-block; background: #FF6B35; color: white; padding: 12px 24px; 
                      border-radius: 6px; text-decoration: none; font-weight: 600;">
              View Ticket
            </a>
          </div>
        </div>
        <div style="padding: 16px; text-align: center; color: #9ca3af; font-size: 12px;">
          <p style="margin: 0;">Brandastic PM • You're receiving this because you have ticket notifications enabled.</p>
          <p style="margin: 8px 0 0;"><a href="https://brandastic.co/settings" style="color: #6b7280;">Manage preferences</a></p>
        </div>
      </div>
    `,
  }),

  new_comment: (data: any) => ({
    subject: data.subject || `New Comment on: ${data.ticket_title}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 24px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">💬 New Comment</h1>
        </div>
        <div style="padding: 24px; background: #f9fafb;">
          <p style="color: #374151; font-size: 16px; margin: 0 0 16px;">
            Hi ${data.to_name || 'there'},
          </p>
          <p style="color: #374151; font-size: 16px; margin: 0 0 16px;">
            <strong>${data.commenter_name || 'Someone'}</strong> commented on <strong>${data.ticket_title}</strong>:
          </p>
          
          <div style="background: white; border-radius: 8px; padding: 16px; border: 1px solid #e5e7eb;">
            <p style="color: #374151; font-size: 14px; margin: 0; white-space: pre-wrap;">
              "${data.comment_preview || 'No preview available'}"
            </p>
          </div>
          
          <div style="margin-top: 24px; text-align: center;">
            <a href="https://brandastic.co${data.url || '/dashboard'}" 
               style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; 
                      border-radius: 6px; text-decoration: none; font-weight: 600;">
              View Comment
            </a>
          </div>
        </div>
        <div style="padding: 16px; text-align: center; color: #9ca3af; font-size: 12px;">
          <p style="margin: 0;">Brandastic PM • You're receiving this because you have comment notifications enabled.</p>
          <p style="margin: 8px 0 0;"><a href="https://brandastic.co/settings" style="color: #6b7280;">Manage preferences</a></p>
        </div>
      </div>
    `,
  }),

  achievement_unlocked: (data: any) => ({
    subject: data.subject || `🏆 Achievement Unlocked: ${data.achievement_name}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%); padding: 32px; text-align: center;">
          <div style="font-size: 48px; margin-bottom: 8px;">🏆</div>
          <h1 style="color: white; margin: 0; font-size: 24px;">Achievement Unlocked!</h1>
        </div>
        <div style="padding: 24px; background: #f9fafb; text-align: center;">
          <h2 style="color: #1f2937; font-size: 20px; margin: 0 0 8px;">
            ${data.achievement_name || 'New Achievement'}
          </h2>
          <p style="color: #6b7280; font-size: 14px; margin: 0 0 16px;">
            ${data.achievement_description || 'You unlocked a new achievement!'}
          </p>
          ${data.xp_reward ? `
            <div style="display: inline-block; background: #fef3c7; padding: 8px 16px; border-radius: 20px;">
              <span style="color: #92400e; font-weight: 600;">+${data.xp_reward} XP</span>
            </div>
          ` : ''}
          
          <div style="margin-top: 24px;">
            <a href="https://brandastic.co/achievements" 
               style="display: inline-block; background: #f59e0b; color: white; padding: 12px 24px; 
                      border-radius: 6px; text-decoration: none; font-weight: 600;">
              View All Achievements
            </a>
          </div>
        </div>
        <div style="padding: 16px; text-align: center; color: #9ca3af; font-size: 12px;">
          <p style="margin: 0;">Brandastic PM • Keep crushing it! 🚀</p>
        </div>
      </div>
    `,
  }),

  weekly_summary: (data: any) => ({
    subject: data.subject || `Your Weekly Summary: ${data.week_start} - ${data.week_end}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #10b981 0%, #34d399 100%); padding: 24px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">📊 Your Weekly Summary</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 14px;">
            ${data.week_start} - ${data.week_end}
          </p>
        </div>
        <div style="padding: 24px; background: #f9fafb;">
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 24px;">
            <div style="background: white; border-radius: 8px; padding: 16px; text-align: center;">
              <p style="color: #6b7280; font-size: 12px; margin: 0 0 4px; text-transform: uppercase;">Total Hours</p>
              <p style="color: #1f2937; font-size: 24px; font-weight: 700; margin: 0;">${(data.total_hours || 0).toFixed(1)}h</p>
            </div>
            <div style="background: white; border-radius: 8px; padding: 16px; text-align: center;">
              <p style="color: #6b7280; font-size: 12px; margin: 0 0 4px; text-transform: uppercase;">Billable Hours</p>
              <p style="color: #10b981; font-size: 24px; font-weight: 700; margin: 0;">${(data.billable_hours || 0).toFixed(1)}h</p>
            </div>
            <div style="background: white; border-radius: 8px; padding: 16px; text-align: center;">
              <p style="color: #6b7280; font-size: 12px; margin: 0 0 4px; text-transform: uppercase;">Tickets Completed</p>
              <p style="color: #1f2937; font-size: 24px; font-weight: 700; margin: 0;">${data.tickets_completed || 0}</p>
            </div>
            <div style="background: white; border-radius: 8px; padding: 16px; text-align: center;">
              <p style="color: #6b7280; font-size: 12px; margin: 0 0 4px; text-transform: uppercase;">Clients Worked On</p>
              <p style="color: #1f2937; font-size: 24px; font-weight: 700; margin: 0;">${data.clients_worked_on || 0}</p>
            </div>
          </div>
          
          <div style="text-align: center;">
            <a href="https://brandastic.co/time-tracking" 
               style="display: inline-block; background: #10b981; color: white; padding: 12px 24px; 
                      border-radius: 6px; text-decoration: none; font-weight: 600;">
              View Full Dashboard
            </a>
          </div>
        </div>
        <div style="padding: 16px; text-align: center; color: #9ca3af; font-size: 12px;">
          <p style="margin: 0;">Great work this week! Keep it up! 💪</p>
          <p style="margin: 8px 0 0;"><a href="https://brandastic.co/settings" style="color: #6b7280;">Manage email preferences</a></p>
        </div>
      </div>
    `,
  }),
}

// Send email via Resend
async function sendEmail(to: string, subject: string, html: string) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: [to],
      subject,
      html,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Resend API error: ${error}`)
  }

  return response.json()
}

// Main handler
Deno.serve(async (req) => {
  try {
    // Initialize Supabase client with service role
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)

    // Fetch pending emails
    const { data: emails, error: fetchError } = await supabase
      .from('email_queue')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .lt('attempts', 3)
      .order('created_at')
      .limit(10)

    if (fetchError) throw fetchError

    if (!emails || emails.length === 0) {
      return new Response(JSON.stringify({ message: 'No emails to process' }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const results = []

    for (const email of emails) {
      // Mark as processing
      await supabase
        .from('email_queue')
        .update({ status: 'processing', attempts: email.attempts + 1 })
        .eq('id', email.id)

      try {
        // Get the template
        const templateFn = templates[email.template_id as keyof typeof templates]
        if (!templateFn) {
          throw new Error(`Unknown template: ${email.template_id}`)
        }

        const { subject, html } = templateFn({
          ...email.template_data,
          to_name: email.to_name,
          subject: email.subject,
        })

        // Send the email
        await sendEmail(email.to_email, subject, html)

        // Mark as sent
        await supabase
          .from('email_queue')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', email.id)

        results.push({ id: email.id, status: 'sent' })
      } catch (sendError: any) {
        // Mark as failed
        await supabase
          .from('email_queue')
          .update({ 
            status: email.attempts + 1 >= email.max_attempts ? 'failed' : 'pending',
            last_error: sendError.message 
          })
          .eq('id', email.id)

        results.push({ id: email.id, status: 'failed', error: sendError.message })
      }
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
