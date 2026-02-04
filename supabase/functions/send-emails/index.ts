// =====================================================
// SUPABASE EDGE FUNCTION: Send Email Notifications
// =====================================================
// This function processes the email queue and sends emails via Resend.
//
// SETUP REQUIRED:
// 1. Add RESEND_API_KEY to Supabase secrets
// 2. Verify brandastic.co domain in Resend dashboard
// 3. Deploy: supabase functions deploy send-emails
// 4. Set up a cron job or webhook to trigger this
// =====================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Environment variables
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

// Email configuration
const FROM_EMAIL = 'notifications@brandastic.co'
const FROM_NAME = 'Brandastic'
const APP_URL = 'https://brandastic.co'

// Brand colors
const BRAND_ORANGE = '#F97316'
const BRAND_CORAL = '#FF6B6B'
const DARK_BLUE = '#0d1d35'

// =====================================================
// EMAIL TEMPLATES
// =====================================================

const emailHeader = (title: string, emoji: string = '', bgColor: string = BRAND_ORANGE) => `
  <div style="background: linear-gradient(135deg, ${bgColor} 0%, ${bgColor}dd 100%); padding: 24px 30px; border-radius: 12px 12px 0 0;">
    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 16px;">
      <div style="width: 36px; height: 36px; border-radius: 8px; background: rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center;">
        <span style="color: white; font-size: 18px; font-weight: 700;">B</span>
      </div>
      <span style="font-size: 16px; font-weight: 600; color: white;">Brandastic</span>
    </div>
    ${emoji ? `<div style="font-size: 32px; margin-bottom: 8px;">${emoji}</div>` : ''}
    <h1 style="color: white; margin: 0; font-size: 22px; font-weight: 700;">${title}</h1>
  </div>
`

const emailFooter = (unsubscribeReason: string = 'notifications') => `
  <div style="padding: 20px 30px; background: #f8fafc; border-top: 1px solid #e2e8f0; border-radius: 0 0 12px 12px;">
    <p style="color: #94a3b8; font-size: 12px; margin: 0 0 8px; text-align: center;">
      Brandastic Project Management
    </p>
    <p style="color: #94a3b8; font-size: 11px; margin: 0; text-align: center;">
      <a href="${APP_URL}/settings" style="color: #64748b; text-decoration: none;">Manage Preferences</a>
      <span style="margin: 0 8px;">•</span>
      <a href="${APP_URL}/settings" style="color: #64748b; text-decoration: none;">Unsubscribe</a>
    </p>
  </div>
`

const emailButton = (text: string, url: string, color: string = BRAND_ORANGE) => `
  <div style="text-align: center; margin: 24px 0;">
    <a href="${url}" style="display: inline-block; padding: 14px 32px; background: ${color}; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">
      ${text}
    </a>
  </div>
`

const emailWrapper = (content: string) => `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
  </head>
  <body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
    <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
      <div style="background: white; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); overflow: hidden;">
        ${content}
      </div>
    </div>
  </body>
  </html>
`

// All email templates
const templates: Record<string, (data: any) => { subject: string; html: string }> = {
  
  // ==================== WELCOME ====================
  welcome: (data) => ({
    subject: 'Welcome to Brandastic! 🎉',
    html: emailWrapper(`
      ${emailHeader('Welcome to Brandastic!', '🎉')}
      <div style="padding: 30px;">
        <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
          Hi <strong>${data.to_name || 'there'}</strong>,
        </p>
        <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
          Welcome aboard! Your account is now active and you're ready to start collaborating with the team.
        </p>
        <div style="background: #f8fafc; border-radius: 10px; padding: 20px; margin-bottom: 20px;">
          <p style="color: #334155; font-size: 14px; font-weight: 600; margin: 0 0 12px;">Here's what you can do:</p>
          <ul style="margin: 0; padding: 0 0 0 20px; color: #64748b; font-size: 14px; line-height: 1.8;">
            <li>View your personalized dashboard</li>
            <li>Check assigned tasks and deadlines</li>
            <li>Track time on projects</li>
            <li>Collaborate with your team</li>
          </ul>
        </div>
        ${emailButton('Go to Dashboard →', `${APP_URL}/dashboard`)}
      </div>
      ${emailFooter()}
    `),
  }),

  // ==================== PASSWORD RESET ====================
  password_reset: (data) => ({
    subject: 'Reset your Brandastic password',
    html: emailWrapper(`
      ${emailHeader('Reset Your Password', '🔐', '#6366f1')}
      <div style="padding: 30px;">
        <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
          Hi <strong>${data.to_name || 'there'}</strong>,
        </p>
        <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
          We received a request to reset your password. Click the button below to create a new password.
        </p>
        ${emailButton('Reset Password →', data.reset_url || `${APP_URL}/reset-password`, '#6366f1')}
        <p style="color: #94a3b8; font-size: 13px; text-align: center; margin: 0;">
          This link expires in 1 hour. If you didn't request this, you can safely ignore this email.
        </p>
      </div>
      ${emailFooter()}
    `),
  }),

  // ==================== TEAM INVITE ====================
  team_invite: (data) => ({
    subject: `🎉 You're invited to join Brandastic`,
    html: emailWrapper(`
      ${emailHeader("You're Invited!", '🎉')}
      <div style="padding: 30px;">
        <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
          <strong>${data.inviter_name || 'Someone'}</strong> has invited you to join the Brandastic team!
        </p>
        <div style="background: linear-gradient(135deg, ${BRAND_ORANGE}10 0%, ${BRAND_ORANGE}20 100%); border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 20px;">
          <img src="${APP_URL}/favicon.svg" alt="Brandastic" style="width: 48px; height: 48px; margin-bottom: 12px;" />
          <p style="color: #475569; font-size: 15px; margin: 0;">
            Join the team and start collaborating on projects, tracking tasks, and more.
          </p>
        </div>
        ${emailButton('Accept Invitation →', data.invite_url || `${APP_URL}/login`)}
        <p style="color: #94a3b8; font-size: 12px; text-align: center; margin: 0;">
          This invitation expires in 7 days.
        </p>
      </div>
      ${emailFooter()}
    `),
  }),

  // ==================== TASK ASSIGNED ====================
  ticket_assigned: (data) => ({
    subject: `📋 New task assigned: ${data.ticket_title || 'Untitled'}`,
    html: emailWrapper(`
      ${emailHeader('New Task Assigned', '📋')}
      <div style="padding: 30px;">
        <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
          Hi <strong>${data.to_name || 'there'}</strong>,
        </p>
        <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
          ${data.assigned_by || 'A team member'} has assigned you a new task:
        </p>
        <div style="background: #f8fafc; border-radius: 10px; padding: 20px; border-left: 4px solid ${BRAND_ORANGE}; margin-bottom: 20px;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
            ${data.ticket_id ? `<span style="background: ${BRAND_ORANGE}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">${data.ticket_id}</span>` : ''}
          </div>
          <h2 style="color: ${DARK_BLUE}; font-size: 18px; font-weight: 600; margin: 0 0 8px;">
            ${data.ticket_title || 'Untitled Task'}
          </h2>
          <div style="color: #64748b; font-size: 13px;">
            ${data.client_name ? `<span>Client: <strong>${data.client_name}</strong></span>` : ''}
            ${data.priority ? `<span style="margin-left: 12px;">Priority: <strong>${data.priority}</strong></span>` : ''}
            ${data.due_date ? `<span style="margin-left: 12px;">Due: <strong>${new Date(data.due_date).toLocaleDateString()}</strong></span>` : ''}
          </div>
        </div>
        ${emailButton('View Task →', `${APP_URL}${data.url || '/dashboard'}`)}
      </div>
      ${emailFooter('task assignments')}
    `),
  }),

  // ==================== STATUS CHANGED ====================
  ticket_status_changed: (data) => ({
    subject: `🔄 Task status updated: ${data.ticket_title || 'Untitled'}`,
    html: emailWrapper(`
      ${emailHeader('Task Status Updated', '🔄', '#3b82f6')}
      <div style="padding: 30px;">
        <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
          Hi <strong>${data.to_name || 'there'}</strong>,
        </p>
        <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
          The status of <strong>${data.ticket_title}</strong> has been updated:
        </p>
        <div style="background: #f8fafc; border-radius: 10px; padding: 20px; text-align: center; margin-bottom: 20px;">
          <div style="display: inline-flex; align-items: center; gap: 16px;">
            <span style="background: #e2e8f0; color: #64748b; padding: 6px 12px; border-radius: 6px; font-size: 13px; text-decoration: line-through;">
              ${data.old_status || 'Previous'}
            </span>
            <span style="color: #94a3b8;">→</span>
            <span style="background: #10b981; color: white; padding: 6px 12px; border-radius: 6px; font-size: 13px; font-weight: 600;">
              ${data.new_status || 'New'}
            </span>
          </div>
        </div>
        ${emailButton('View Task →', `${APP_URL}${data.url || '/dashboard'}`, '#3b82f6')}
      </div>
      ${emailFooter('status updates')}
    `),
  }),

  // ==================== NEW COMMENT ====================
  new_comment: (data) => ({
    subject: `💬 New comment on: ${data.ticket_title || 'a task'}`,
    html: emailWrapper(`
      ${emailHeader('New Comment', '💬', '#8b5cf6')}
      <div style="padding: 30px;">
        <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
          Hi <strong>${data.to_name || 'there'}</strong>,
        </p>
        <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
          <strong>${data.commenter_name || 'Someone'}</strong> commented on <strong>${data.ticket_title}</strong>:
        </p>
        <div style="background: #f8fafc; border-radius: 10px; padding: 20px; border-left: 4px solid #8b5cf6; margin-bottom: 20px;">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
            <div style="width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%); display: flex; align-items: center; justify-content: center; color: white; font-size: 13px; font-weight: 600;">
              ${(data.commenter_name || 'U').charAt(0).toUpperCase()}
            </div>
            <span style="color: ${DARK_BLUE}; font-weight: 600; font-size: 14px;">${data.commenter_name || 'User'}</span>
          </div>
          <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0; white-space: pre-wrap;">
            "${data.comment_preview || 'No preview available'}"
          </p>
        </div>
        ${emailButton('View & Reply →', `${APP_URL}${data.url || '/dashboard'}`, '#8b5cf6')}
      </div>
      ${emailFooter('comments')}
    `),
  }),

  // ==================== @MENTION ====================
  mention: (data) => ({
    subject: `👋 ${data.from_user_name || 'Someone'} mentioned you`,
    html: emailWrapper(`
      ${emailHeader('You Were Mentioned', '👋', '#3b82f6')}
      <div style="padding: 30px;">
        <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
          Hi <strong>${data.to_name || 'there'}</strong>,
        </p>
        <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
          <strong>${data.from_user_name || 'Someone'}</strong> mentioned you${data.entity_name ? ` in <strong>${data.entity_name}</strong>` : ''}:
        </p>
        <div style="background: #f8fafc; border-radius: 10px; padding: 20px; border-left: 4px solid #3b82f6; margin-bottom: 20px;">
          <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0; white-space: pre-wrap;">
            "${data.message_preview || 'No preview available'}"
          </p>
        </div>
        ${emailButton('View Message →', `${APP_URL}${data.url || '/dashboard'}`, '#3b82f6')}
      </div>
      ${emailFooter('mentions')}
    `),
  }),

  // ==================== DUE DATE REMINDER ====================
  due_date_reminder: (data) => ({
    subject: `⏰ Task due ${data.due_when || 'tomorrow'}: ${data.ticket_title || 'Untitled'}`,
    html: emailWrapper(`
      ${emailHeader(data.due_when === 'today' ? 'Due Today!' : 'Due Tomorrow', '⏰', '#f59e0b')}
      <div style="padding: 30px;">
        <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
          Hi <strong>${data.to_name || 'there'}</strong>,
        </p>
        <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
          Just a friendly reminder - this task is due ${data.due_when || 'tomorrow'}:
        </p>
        <div style="background: #fffbeb; border-radius: 10px; padding: 20px; border: 1px solid #fcd34d; margin-bottom: 20px;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
            ${data.ticket_id ? `<span style="background: #f59e0b; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">${data.ticket_id}</span>` : ''}
          </div>
          <h2 style="color: #92400e; font-size: 17px; font-weight: 600; margin: 0 0 8px;">
            ${data.ticket_title || 'Untitled Task'}
          </h2>
          <p style="color: #a16207; font-size: 13px; margin: 0;">
            Due: <strong>${data.due_date ? new Date(data.due_date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : 'Soon'}</strong>
          </p>
        </div>
        ${emailButton('Open Task →', `${APP_URL}${data.url || '/dashboard'}`, '#f59e0b')}
      </div>
      ${emailFooter('reminders')}
    `),
  }),

  // ==================== OVERDUE ====================
  overdue: (data) => ({
    subject: `🚨 Overdue: ${data.ticket_title || 'Untitled'}`,
    html: emailWrapper(`
      ${emailHeader('Task Overdue', '🚨', '#dc2626')}
      <div style="padding: 30px;">
        <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
          Hi <strong>${data.to_name || 'there'}</strong>,
        </p>
        <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
          This task is now overdue and needs your attention:
        </p>
        <div style="background: #fef2f2; border-radius: 10px; padding: 20px; border: 1px solid #fecaca; margin-bottom: 20px;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
            <span style="background: #dc2626; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">OVERDUE</span>
          </div>
          <h2 style="color: #991b1b; font-size: 17px; font-weight: 600; margin: 0 0 8px;">
            ${data.ticket_title || 'Untitled Task'}
          </h2>
          <p style="color: #b91c1c; font-size: 13px; margin: 0;">
            Was due: <strong>${data.due_date ? new Date(data.due_date).toLocaleDateString() : 'Unknown'}</strong>
          </p>
        </div>
        <p style="color: #64748b; font-size: 14px; text-align: center; margin: 0 0 20px;">
          Please update the status or extend the deadline if needed.
        </p>
        ${emailButton('Take Action →', `${APP_URL}${data.url || '/dashboard'}`, '#dc2626')}
      </div>
      ${emailFooter('overdue alerts')}
    `),
  }),

  // ==================== CLIENT REQUEST SUBMITTED ====================
  client_request_submitted: (data) => ({
    subject: `✅ We received your request: ${data.request_title || 'New Request'}`,
    html: emailWrapper(`
      ${emailHeader('Request Received!', '✅', '#10b981')}
      <div style="padding: 30px;">
        <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
          Hi <strong>${data.to_name || 'there'}</strong>,
        </p>
        <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
          Thanks for submitting your request! Our team has been notified and will get started right away.
        </p>
        <div style="background: #f0fdf4; border-radius: 10px; padding: 20px; border: 1px solid #bbf7d0; margin-bottom: 20px;">
          <p style="color: #64748b; font-size: 12px; margin: 0 0 6px; text-transform: uppercase; letter-spacing: 0.5px;">Request Title</p>
          <h2 style="color: ${DARK_BLUE}; font-size: 17px; font-weight: 600; margin: 0;">
            ${data.request_title || 'Your Request'}
          </h2>
        </div>
        <p style="color: #64748b; font-size: 14px; text-align: center; margin: 0 0 20px;">
          We'll keep you updated on the progress. You can also check the status anytime:
        </p>
        ${emailButton('View Request Status →', `${APP_URL}${data.url || '/client-dashboard'}`, '#10b981')}
      </div>
      ${emailFooter('request updates')}
    `),
  }),

  // ==================== CLIENT STATUS UPDATE ====================
  client_request_update: (data) => ({
    subject: `📊 Update on your request: ${data.request_title || 'Request'}`,
    html: emailWrapper(`
      ${emailHeader('Request Update', '📊', '#3b82f6')}
      <div style="padding: 30px;">
        <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
          Hi <strong>${data.to_name || 'there'}</strong>,
        </p>
        <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
          There's an update on your request: <strong>${data.request_title}</strong>
        </p>
        <div style="background: #f8fafc; border-radius: 10px; padding: 20px; text-align: center; margin-bottom: 20px;">
          <p style="color: #64748b; font-size: 12px; margin: 0 0 8px; text-transform: uppercase;">New Status</p>
          <span style="background: #3b82f6; color: white; padding: 8px 16px; border-radius: 20px; font-size: 14px; font-weight: 600;">
            ${data.new_status || 'Updated'}
          </span>
        </div>
        ${emailButton('View Details →', `${APP_URL}${data.url || '/client-dashboard'}`, '#3b82f6')}
      </div>
      ${emailFooter('request updates')}
    `),
  }),

  // ==================== WEEKLY SUMMARY ====================
  weekly_summary: (data) => ({
    subject: `📈 Your weekly summary: ${data.week_start || 'This Week'} - ${data.week_end || 'Now'}`,
    html: emailWrapper(`
      ${emailHeader('Weekly Summary', '📈', '#10b981')}
      <div style="padding: 30px;">
        <p style="color: #64748b; font-size: 14px; text-align: center; margin: 0 0 20px;">
          ${data.week_start || 'This Week'} - ${data.week_end || 'Now'}
        </p>
        
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 24px;">
          <div style="background: #f8fafc; border-radius: 10px; padding: 16px; text-align: center;">
            <p style="color: #10b981; font-size: 28px; font-weight: 700; margin: 0;">${data.tickets_completed || 0}</p>
            <p style="color: #64748b; font-size: 12px; margin: 4px 0 0;">Tasks Completed</p>
          </div>
          <div style="background: #f8fafc; border-radius: 10px; padding: 16px; text-align: center;">
            <p style="color: #3b82f6; font-size: 28px; font-weight: 700; margin: 0;">${data.tickets_in_progress || 0}</p>
            <p style="color: #64748b; font-size: 12px; margin: 4px 0 0;">In Progress</p>
          </div>
          <div style="background: #f8fafc; border-radius: 10px; padding: 16px; text-align: center;">
            <p style="color: ${BRAND_ORANGE}; font-size: 28px; font-weight: 700; margin: 0;">${(data.total_hours || 0).toFixed(1)}h</p>
            <p style="color: #64748b; font-size: 12px; margin: 4px 0 0;">Hours Tracked</p>
          </div>
          <div style="background: #f8fafc; border-radius: 10px; padding: 16px; text-align: center;">
            <p style="color: #8b5cf6; font-size: 28px; font-weight: 700; margin: 0;">${data.clients_worked_on || 0}</p>
            <p style="color: #64748b; font-size: 12px; margin: 4px 0 0;">Clients</p>
          </div>
        </div>
        
        ${emailButton('View Full Dashboard →', `${APP_URL}/dashboard`, '#10b981')}
        
        <p style="color: #94a3b8; font-size: 13px; text-align: center; margin: 20px 0 0;">
          Keep up the great work! 💪
        </p>
      </div>
      ${emailFooter('weekly digests')}
    `),
  }),

  // ==================== ACHIEVEMENT UNLOCKED ====================
  achievement_unlocked: (data) => ({
    subject: `🏆 Achievement Unlocked: ${data.achievement_name || 'New Achievement'}`,
    html: emailWrapper(`
      ${emailHeader('Achievement Unlocked!', '🏆', '#f59e0b')}
      <div style="padding: 30px; text-align: center;">
        <h2 style="color: ${DARK_BLUE}; font-size: 22px; font-weight: 700; margin: 0 0 8px;">
          ${data.achievement_name || 'New Achievement'}
        </h2>
        <p style="color: #64748b; font-size: 15px; margin: 0 0 20px;">
          ${data.achievement_description || 'You unlocked a new achievement!'}
        </p>
        ${data.xp_reward ? `
          <div style="display: inline-block; background: #fef3c7; padding: 10px 20px; border-radius: 20px; margin-bottom: 20px;">
            <span style="color: #92400e; font-weight: 700; font-size: 16px;">+${data.xp_reward} XP</span>
          </div>
        ` : ''}
        ${emailButton('View Achievements →', `${APP_URL}/leaderboard`, '#f59e0b')}
      </div>
      ${emailFooter('achievements')}
    `),
  }),

  // ==================== ACCOUNT DEACTIVATED ====================
  account_deactivated: (data) => ({
    subject: 'Your Brandastic account has been deactivated',
    html: emailWrapper(`
      ${emailHeader('Account Deactivated', '', '#64748b')}
      <div style="padding: 30px;">
        <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
          Hi <strong>${data.to_name || 'there'}</strong>,
        </p>
        <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
          Your Brandastic account has been deactivated. You will no longer have access to the platform.
        </p>
        <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
          If you believe this was done in error, please contact your administrator.
        </p>
        <p style="color: #64748b; font-size: 14px; margin: 0;">
          Thank you for being part of the team.
        </p>
      </div>
      ${emailFooter()}
    `),
  }),
}

// =====================================================
// SEND EMAIL VIA RESEND
// =====================================================
async function sendEmail(to: string, subject: string, html: string): Promise<{ id: string }> {
  if (!RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is not configured')
  }

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
    const errorText = await response.text()
    throw new Error(`Resend API error (${response.status}): ${errorText}`)
  }

  return response.json()
}

// =====================================================
// MAIN HANDLER
// =====================================================
Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    })
  }

  try {
    // Initialize Supabase client with service role
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase credentials not configured')
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Check if this is a direct send request or queue processing
    const contentType = req.headers.get('content-type')
    
    if (contentType?.includes('application/json')) {
      // Direct send request
      const body = await req.json()
      
      if (body.template_id && body.to_email) {
        // Direct send
        const templateFn = templates[body.template_id]
        if (!templateFn) {
          throw new Error(`Unknown template: ${body.template_id}`)
        }

        const { subject, html } = templateFn(body.data || {})
        const result = await sendEmail(body.to_email, body.subject || subject, html)

        return new Response(JSON.stringify({ success: true, id: result.id }), {
          headers: { 'Content-Type': 'application/json' },
        })
      }
    }

    // Queue processing mode - fetch pending emails
    const { data: emails, error: fetchError } = await supabase
      .from('email_queue')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .lt('attempts', 3)
      .order('created_at')
      .limit(20)

    if (fetchError) throw fetchError

    if (!emails || emails.length === 0) {
      return new Response(JSON.stringify({ message: 'No emails to process', processed: 0 }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const results: Array<{ id: string; status: string; error?: string }> = []

    for (const email of emails) {
      // Mark as processing
      await supabase
        .from('email_queue')
        .update({ status: 'processing', attempts: email.attempts + 1 })
        .eq('id', email.id)

      try {
        // Get the template
        const templateFn = templates[email.template_id]
        if (!templateFn) {
          throw new Error(`Unknown template: ${email.template_id}`)
        }

        const templateData = {
          ...email.template_data,
          to_name: email.to_name,
        }

        const { subject, html } = templateFn(templateData)

        // Send the email
        await sendEmail(email.to_email, email.subject || subject, html)

        // Mark as sent
        await supabase
          .from('email_queue')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', email.id)

        results.push({ id: email.id, status: 'sent' })
      } catch (sendError: any) {
        // Mark as failed or pending for retry
        const newStatus = email.attempts + 1 >= 3 ? 'failed' : 'pending'
        await supabase
          .from('email_queue')
          .update({ 
            status: newStatus,
            last_error: sendError.message 
          })
          .eq('id', email.id)

        results.push({ id: email.id, status: 'failed', error: sendError.message })
      }
    }

    return new Response(JSON.stringify({ 
      processed: results.length, 
      sent: results.filter(r => r.status === 'sent').length,
      failed: results.filter(r => r.status === 'failed').length,
      results 
    }), {
      headers: { 'Content-Type': 'application/json' },
    })

  } catch (error: any) {
    console.error('Email function error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
