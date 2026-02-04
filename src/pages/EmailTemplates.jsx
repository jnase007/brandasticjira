import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Mail, 
  Bell, 
  UserPlus, 
  CheckCircle2, 
  MessageSquare, 
  Clock, 
  AlertTriangle,
  Send,
  Eye,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Calendar,
  Users,
  FileText,
  Star,
  Zap,
  ArrowRight
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { cn } from '../lib/utils'

// Email template data
const EMAIL_TEMPLATES = [
  {
    id: 'welcome',
    category: 'Account',
    name: 'Welcome Email',
    description: 'Sent when a new team member or client signs up',
    trigger: 'User registration / First login',
    priority: 'High',
    subject: 'Welcome to Brandastic! 🎉',
    previewText: 'You\'re all set up and ready to go...',
  },
  {
    id: 'password-reset',
    category: 'Account',
    name: 'Password Reset',
    description: 'Sent when user requests password reset',
    trigger: 'Password reset request',
    priority: 'High',
    subject: 'Reset your Brandastic password',
    previewText: 'Click the link below to reset your password...',
  },
  {
    id: 'ticket-assigned',
    category: 'Task Notifications',
    name: 'Task Assigned',
    description: 'Sent when a task is assigned to a team member',
    trigger: 'Task assignment',
    priority: 'High',
    subject: '📋 New task assigned: {{task_title}}',
    previewText: 'You have been assigned a new task...',
  },
  {
    id: 'ticket-status-changed',
    category: 'Task Notifications',
    name: 'Task Status Changed',
    description: 'Sent when a task status is updated',
    trigger: 'Status change (In Progress, Review, Done, etc.)',
    priority: 'Medium',
    subject: '🔄 Task status updated: {{task_title}}',
    previewText: 'The status has been changed to {{new_status}}...',
  },
  {
    id: 'comment-added',
    category: 'Task Notifications',
    name: 'New Comment',
    description: 'Sent when someone comments on a task you\'re involved in',
    trigger: 'Comment added to assigned/watching task',
    priority: 'Medium',
    subject: '💬 New comment on: {{task_title}}',
    previewText: '{{commenter_name}} left a comment...',
  },
  {
    id: 'mention',
    category: 'Task Notifications',
    name: '@Mention Notification',
    description: 'Sent when someone @mentions you in a comment',
    trigger: '@mention in comment',
    priority: 'High',
    subject: '👋 {{mentioner_name}} mentioned you',
    previewText: 'You were mentioned in a comment on {{task_title}}...',
  },
  {
    id: 'due-date-reminder',
    category: 'Task Notifications',
    name: 'Due Date Reminder',
    description: 'Sent 24 hours before a task is due',
    trigger: '24 hours before due date',
    priority: 'High',
    subject: '⏰ Task due tomorrow: {{task_title}}',
    previewText: 'Don\'t forget, this task is due tomorrow...',
  },
  {
    id: 'overdue',
    category: 'Task Notifications',
    name: 'Overdue Task',
    description: 'Sent when a task passes its due date',
    trigger: 'Task becomes overdue',
    priority: 'High',
    subject: '🚨 Overdue: {{task_title}}',
    previewText: 'This task was due on {{due_date}}...',
  },
  {
    id: 'client-request-submitted',
    category: 'Client Notifications',
    name: 'Request Submitted (Client)',
    description: 'Confirmation sent to client when they submit a request',
    trigger: 'Client submits new request',
    priority: 'High',
    subject: '✅ We received your request: {{request_title}}',
    previewText: 'Thanks for submitting your request. We\'re on it!...',
  },
  {
    id: 'client-request-update',
    category: 'Client Notifications',
    name: 'Request Status Update (Client)',
    description: 'Sent to client when their request status changes',
    trigger: 'Status change on client request',
    priority: 'Medium',
    subject: '📊 Update on your request: {{request_title}}',
    previewText: 'Your request is now {{new_status}}...',
  },
  {
    id: 'client-comment',
    category: 'Client Notifications',
    name: 'Team Comment (Client)',
    description: 'Sent to client when team comments on their request',
    trigger: 'Team adds comment to client request',
    priority: 'Medium',
    subject: '💬 New message about: {{request_title}}',
    previewText: 'The team left you a message...',
  },
  {
    id: 'weekly-digest',
    category: 'Digests',
    name: 'Weekly Summary',
    description: 'Weekly digest of completed tasks and upcoming deadlines',
    trigger: 'Every Monday at 9am',
    priority: 'Low',
    subject: '📈 Your weekly summary - {{week_range}}',
    previewText: 'Here\'s what happened this week...',
  },
  {
    id: 'team-invite',
    category: 'Account',
    name: 'Team Invitation',
    description: 'Sent when inviting a new team member',
    trigger: 'Admin sends team invite',
    priority: 'High',
    subject: '🎉 You\'re invited to join Brandastic',
    previewText: '{{inviter_name}} has invited you to join the team...',
  },
  {
    id: 'account-deactivated',
    category: 'Account',
    name: 'Account Deactivated',
    description: 'Sent when an account is deactivated',
    trigger: 'Admin deactivates account',
    priority: 'Low',
    subject: 'Your Brandastic account has been deactivated',
    previewText: 'Your access has been revoked...',
  },
]

// Group templates by category
const groupedTemplates = EMAIL_TEMPLATES.reduce((acc, template) => {
  if (!acc[template.category]) {
    acc[template.category] = []
  }
  acc[template.category].push(template)
  return acc
}, {})

const categoryIcons = {
  'Account': UserPlus,
  'Task Notifications': Bell,
  'Client Notifications': Users,
  'Digests': Calendar,
}

const priorityColors = {
  'High': 'bg-red-500/10 text-red-600 border-red-500/20',
  'Medium': 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  'Low': 'bg-slate-500/10 text-slate-600 border-slate-500/20',
}

// Email Preview Component (renders an HTML email preview)
function EmailPreview({ template }) {
  const brandColor = '#F97316' // brand-orange
  const darkBlue = '#0d1d35'
  
  // Sample data for preview
  const sampleData = {
    user_name: 'Sarah Johnson',
    task_title: 'Website Redesign - Phase 2',
    task_id: 'BRA-47',
    client_name: 'Brandastic',
    commenter_name: 'Justin Chen',
    mentioner_name: 'Erin Smith',
    new_status: 'In Progress',
    due_date: 'February 10, 2026',
    week_range: 'Jan 27 - Feb 2, 2026',
    inviter_name: 'Justin Nassie',
    request_title: 'New Landing Page Design',
  }

  // Replace template variables with sample data
  const replaceVars = (text) => {
    return text.replace(/\{\{(\w+)\}\}/g, (match, key) => sampleData[key] || match)
  }

  const renderEmailContent = () => {
    switch (template.id) {
      case 'welcome':
        return (
          <>
            <div style={{ textAlign: 'center', padding: '30px 0' }}>
              <div style={{ fontSize: '48px', marginBottom: '20px' }}>🎉</div>
              <h1 style={{ color: darkBlue, fontSize: '28px', fontWeight: '700', margin: '0 0 10px' }}>
                Welcome to Brandastic!
              </h1>
              <p style={{ color: '#64748b', fontSize: '16px', margin: '0' }}>
                You're all set up and ready to rock.
              </p>
            </div>
            <div style={{ padding: '20px', background: '#f8fafc', borderRadius: '12px', marginBottom: '20px' }}>
              <p style={{ color: '#475569', fontSize: '15px', lineHeight: '1.6', margin: '0 0 15px' }}>
                Hi <strong>{sampleData.user_name}</strong>,
              </p>
              <p style={{ color: '#475569', fontSize: '15px', lineHeight: '1.6', margin: '0 0 15px' }}>
                Welcome aboard! Your account is now active and you're ready to start collaborating with the team.
              </p>
              <p style={{ color: '#475569', fontSize: '15px', lineHeight: '1.6', margin: '0' }}>
                Here's what you can do next:
              </p>
            </div>
            <div style={{ marginBottom: '20px' }}>
              {['View your dashboard', 'Check assigned tasks', 'Update your profile'].map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '12px 0', borderBottom: i < 2 ? '1px solid #e2e8f0' : 'none' }}>
                  <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: brandColor, color: 'white', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '600', marginRight: '12px' }}>
                    {i + 1}
                  </span>
                  <span style={{ color: '#334155', fontSize: '14px' }}>{item}</span>
                </div>
              ))}
            </div>
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <a href="#" style={{ display: 'inline-block', padding: '14px 32px', background: brandColor, color: 'white', textDecoration: 'none', borderRadius: '8px', fontWeight: '600', fontSize: '15px' }}>
                Go to Dashboard →
              </a>
            </div>
          </>
        )

      case 'ticket-assigned':
        return (
          <>
            <div style={{ padding: '20px', background: `linear-gradient(135deg, ${brandColor}15 0%, #3b82f615 100%)`, borderRadius: '12px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '15px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: brandColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: 'white', fontSize: '18px' }}>📋</span>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' }}>New Task Assigned</div>
                  <div style={{ fontSize: '11px', color: brandColor, fontWeight: '600' }}>{sampleData.task_id}</div>
                </div>
              </div>
              <h2 style={{ color: darkBlue, fontSize: '20px', fontWeight: '700', margin: '0' }}>
                {sampleData.task_title}
              </h2>
            </div>
            <p style={{ color: '#475569', fontSize: '15px', lineHeight: '1.6', margin: '0 0 20px' }}>
              Hi <strong>{sampleData.user_name}</strong>,
            </p>
            <p style={{ color: '#475569', fontSize: '15px', lineHeight: '1.6', margin: '0 0 20px' }}>
              You've been assigned a new task. Here are the details:
            </p>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden', marginBottom: '20px' }}>
              <div style={{ padding: '12px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b', fontSize: '13px' }}>Client</span>
                <span style={{ color: '#334155', fontSize: '13px', fontWeight: '600' }}>{sampleData.client_name}</span>
              </div>
              <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b', fontSize: '13px' }}>Due Date</span>
                <span style={{ color: '#334155', fontSize: '13px', fontWeight: '600' }}>{sampleData.due_date}</span>
              </div>
            </div>
            <div style={{ textAlign: 'center', padding: '10px 0' }}>
              <a href="#" style={{ display: 'inline-block', padding: '14px 32px', background: brandColor, color: 'white', textDecoration: 'none', borderRadius: '8px', fontWeight: '600', fontSize: '15px' }}>
                View Task →
              </a>
            </div>
          </>
        )

      case 'comment-added':
      case 'mention':
        const isMention = template.id === 'mention'
        return (
          <>
            <div style={{ padding: '20px', background: '#f8fafc', borderRadius: '12px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '15px' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '600', fontSize: '16px' }}>
                  {(isMention ? sampleData.mentioner_name : sampleData.commenter_name).split(' ').map(n => n[0]).join('')}
                </div>
                <div>
                  <div style={{ color: darkBlue, fontSize: '15px', fontWeight: '600' }}>
                    {isMention ? sampleData.mentioner_name : sampleData.commenter_name}
                  </div>
                  <div style={{ color: '#64748b', fontSize: '13px' }}>
                    {isMention ? 'mentioned you' : 'commented'} on <strong style={{ color: brandColor }}>{sampleData.task_id}</strong>
                  </div>
                </div>
              </div>
              <div style={{ padding: '16px', background: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', borderLeft: `3px solid ${brandColor}` }}>
                <p style={{ color: '#475569', fontSize: '14px', lineHeight: '1.6', margin: '0' }}>
                  {isMention ? (
                    <>Hey <span style={{ color: brandColor, fontWeight: '600' }}>@{sampleData.user_name}</span>, can you take a look at this when you get a chance? I think we need to adjust the color palette.</>
                  ) : (
                    <>I've reviewed the mockups and they look great! Just a few minor tweaks needed on the header section. Let me know if you have questions.</>
                  )}
                </p>
              </div>
            </div>
            <p style={{ color: '#64748b', fontSize: '14px', textAlign: 'center', margin: '0 0 20px' }}>
              On task: <strong style={{ color: darkBlue }}>{sampleData.task_title}</strong>
            </p>
            <div style={{ textAlign: 'center' }}>
              <a href="#" style={{ display: 'inline-block', padding: '12px 28px', background: brandColor, color: 'white', textDecoration: 'none', borderRadius: '8px', fontWeight: '600', fontSize: '14px' }}>
                View & Reply →
              </a>
            </div>
          </>
        )

      case 'due-date-reminder':
        return (
          <>
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ width: '60px', height: '60px', margin: '0 auto 15px', borderRadius: '50%', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '28px' }}>⏰</span>
              </div>
              <h2 style={{ color: darkBlue, fontSize: '22px', fontWeight: '700', margin: '0 0 5px' }}>
                Due Tomorrow
              </h2>
              <p style={{ color: '#64748b', fontSize: '14px', margin: '0' }}>
                Just a friendly reminder!
              </p>
            </div>
            <div style={{ padding: '20px', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '12px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{ padding: '3px 8px', background: '#f59e0b', color: 'white', borderRadius: '4px', fontSize: '11px', fontWeight: '600' }}>
                  {sampleData.task_id}
                </div>
                <div>
                  <div style={{ color: '#92400e', fontSize: '16px', fontWeight: '600', marginBottom: '4px' }}>
                    {sampleData.task_title}
                  </div>
                  <div style={{ color: '#a16207', fontSize: '13px' }}>
                    Due: <strong>{sampleData.due_date}</strong>
                  </div>
                </div>
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <a href="#" style={{ display: 'inline-block', padding: '12px 28px', background: '#f59e0b', color: 'white', textDecoration: 'none', borderRadius: '8px', fontWeight: '600', fontSize: '14px' }}>
                Open Task →
              </a>
            </div>
          </>
        )

      case 'overdue':
        return (
          <>
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ width: '60px', height: '60px', margin: '0 auto 15px', borderRadius: '50%', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '28px' }}>🚨</span>
              </div>
              <h2 style={{ color: '#dc2626', fontSize: '22px', fontWeight: '700', margin: '0 0 5px' }}>
                Task Overdue
              </h2>
              <p style={{ color: '#64748b', fontSize: '14px', margin: '0' }}>
                This task needs your attention
              </p>
            </div>
            <div style={{ padding: '20px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{ padding: '3px 8px', background: '#dc2626', color: 'white', borderRadius: '4px', fontSize: '11px', fontWeight: '600' }}>
                  OVERDUE
                </div>
                <div>
                  <div style={{ color: '#991b1b', fontSize: '16px', fontWeight: '600', marginBottom: '4px' }}>
                    {sampleData.task_title}
                  </div>
                  <div style={{ color: '#b91c1c', fontSize: '13px' }}>
                    Was due: <strong>{sampleData.due_date}</strong>
                  </div>
                </div>
              </div>
            </div>
            <p style={{ color: '#475569', fontSize: '14px', lineHeight: '1.6', textAlign: 'center', margin: '0 0 20px' }}>
              Please update the status or extend the deadline if needed.
            </p>
            <div style={{ textAlign: 'center' }}>
              <a href="#" style={{ display: 'inline-block', padding: '12px 28px', background: '#dc2626', color: 'white', textDecoration: 'none', borderRadius: '8px', fontWeight: '600', fontSize: '14px' }}>
                Take Action →
              </a>
            </div>
          </>
        )

      case 'client-request-submitted':
        return (
          <>
            <div style={{ textAlign: 'center', padding: '30px 0' }}>
              <div style={{ width: '60px', height: '60px', margin: '0 auto 15px', borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '28px' }}>✅</span>
              </div>
              <h2 style={{ color: darkBlue, fontSize: '24px', fontWeight: '700', margin: '0 0 5px' }}>
                Request Received!
              </h2>
              <p style={{ color: '#64748b', fontSize: '14px', margin: '0' }}>
                We're on it.
              </p>
            </div>
            <div style={{ padding: '20px', background: '#f8fafc', borderRadius: '12px', marginBottom: '20px' }}>
              <p style={{ color: '#475569', fontSize: '15px', lineHeight: '1.6', margin: '0 0 15px' }}>
                Thanks for submitting your request! Our team has been notified and will get started right away.
              </p>
              <div style={{ padding: '16px', background: 'white', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '6px' }}>Request Title</div>
                <div style={{ fontSize: '16px', color: darkBlue, fontWeight: '600' }}>{sampleData.request_title}</div>
              </div>
            </div>
            <p style={{ color: '#64748b', fontSize: '14px', textAlign: 'center', margin: '0 0 20px' }}>
              We'll keep you updated on the progress. You can also check the status anytime:
            </p>
            <div style={{ textAlign: 'center' }}>
              <a href="#" style={{ display: 'inline-block', padding: '12px 28px', background: brandColor, color: 'white', textDecoration: 'none', borderRadius: '8px', fontWeight: '600', fontSize: '14px' }}>
                View Request Status →
              </a>
            </div>
          </>
        )

      case 'weekly-digest':
        return (
          <>
            <div style={{ textAlign: 'center', padding: '20px 0', background: `linear-gradient(135deg, ${brandColor}10 0%, #3b82f610 100%)`, borderRadius: '12px', marginBottom: '20px' }}>
              <div style={{ fontSize: '32px', marginBottom: '10px' }}>📈</div>
              <h2 style={{ color: darkBlue, fontSize: '22px', fontWeight: '700', margin: '0 0 5px' }}>
                Weekly Summary
              </h2>
              <p style={{ color: '#64748b', fontSize: '14px', margin: '0' }}>
                {sampleData.week_range}
              </p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '20px' }}>
              {[
                { label: 'Completed', value: '12', color: '#22c55e' },
                { label: 'In Progress', value: '8', color: '#3b82f6' },
                { label: 'Overdue', value: '2', color: '#ef4444' },
              ].map((stat, i) => (
                <div key={i} style={{ textAlign: 'center', padding: '16px', background: '#f8fafc', borderRadius: '10px' }}>
                  <div style={{ fontSize: '28px', fontWeight: '700', color: stat.color }}>{stat.value}</div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>{stat.label}</div>
                </div>
              ))}
            </div>
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '14px', fontWeight: '600', color: darkBlue, marginBottom: '10px' }}>
                🎯 Upcoming This Week
              </div>
              {['Homepage redesign review', 'Client presentation', 'Q1 planning meeting'].map((item, i) => (
                <div key={i} style={{ padding: '10px 12px', background: i % 2 === 0 ? '#f8fafc' : 'white', borderRadius: '6px', fontSize: '14px', color: '#475569', marginBottom: '4px' }}>
                  • {item}
                </div>
              ))}
            </div>
            <div style={{ textAlign: 'center' }}>
              <a href="#" style={{ display: 'inline-block', padding: '12px 28px', background: brandColor, color: 'white', textDecoration: 'none', borderRadius: '8px', fontWeight: '600', fontSize: '14px' }}>
                View Full Dashboard →
              </a>
            </div>
          </>
        )

      case 'team-invite':
        return (
          <>
            <div style={{ textAlign: 'center', padding: '30px 0' }}>
              <div style={{ fontSize: '48px', marginBottom: '15px' }}>🎉</div>
              <h2 style={{ color: darkBlue, fontSize: '26px', fontWeight: '700', margin: '0 0 10px' }}>
                You're Invited!
              </h2>
              <p style={{ color: '#64748b', fontSize: '15px', margin: '0' }}>
                {sampleData.inviter_name} has invited you to join Brandastic
              </p>
            </div>
            <div style={{ padding: '24px', background: `linear-gradient(135deg, ${brandColor}08 0%, ${brandColor}15 100%)`, borderRadius: '16px', marginBottom: '24px', textAlign: 'center' }}>
              <div style={{ width: '80px', height: '80px', margin: '0 auto 16px', borderRadius: '16px', background: 'white', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src="https://brandastic.co/favicon.svg" alt="Brandastic" style={{ width: '48px', height: '48px' }} />
              </div>
              <p style={{ color: '#475569', fontSize: '15px', lineHeight: '1.6', margin: '0' }}>
                Join the team and start collaborating on projects, tracking tasks, and more.
              </p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <a href="#" style={{ display: 'inline-block', padding: '16px 40px', background: brandColor, color: 'white', textDecoration: 'none', borderRadius: '10px', fontWeight: '700', fontSize: '16px' }}>
                Accept Invitation →
              </a>
              <p style={{ color: '#94a3b8', fontSize: '12px', marginTop: '12px' }}>
                This invitation expires in 7 days
              </p>
            </div>
          </>
        )

      default:
        return (
          <>
            <div style={{ padding: '20px', background: '#f8fafc', borderRadius: '12px', marginBottom: '20px' }}>
              <p style={{ color: '#475569', fontSize: '15px', lineHeight: '1.6', margin: '0 0 15px' }}>
                Hi <strong>{sampleData.user_name}</strong>,
              </p>
              <p style={{ color: '#475569', fontSize: '15px', lineHeight: '1.6', margin: '0' }}>
                {template.description}
              </p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <a href="#" style={{ display: 'inline-block', padding: '12px 28px', background: brandColor, color: 'white', textDecoration: 'none', borderRadius: '8px', fontWeight: '600', fontSize: '14px' }}>
                View Details →
              </a>
            </div>
          </>
        )
    }
  }

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', background: '#ffffff', maxWidth: '600px', margin: '0 auto' }}>
      {/* Email Header */}
      <div style={{ padding: '24px 30px', borderBottom: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: `linear-gradient(135deg, ${brandColor} 0%, #ea580c 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: 'white', fontSize: '18px', fontWeight: '700' }}>B</span>
          </div>
          <span style={{ fontSize: '18px', fontWeight: '700', color: '#0d1d35' }}>Brandastic</span>
        </div>
      </div>

      {/* Email Body */}
      <div style={{ padding: '30px' }}>
        {renderEmailContent()}
      </div>

      {/* Email Footer */}
      <div style={{ padding: '24px 30px', background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: '#94a3b8', fontSize: '12px', margin: '0 0 8px' }}>
            Brandastic Project Management
          </p>
          <p style={{ color: '#94a3b8', fontSize: '11px', margin: '0' }}>
            <a href="#" style={{ color: '#64748b' }}>Unsubscribe</a> · <a href="#" style={{ color: '#64748b' }}>Preferences</a> · <a href="#" style={{ color: '#64748b' }}>Help</a>
          </p>
        </div>
      </div>
    </div>
  )
}

export default function EmailTemplates() {
  const [selectedTemplate, setSelectedTemplate] = useState(EMAIL_TEMPLATES[0])
  const [expandedCategories, setExpandedCategories] = useState(Object.keys(groupedTemplates))
  const [copiedField, setCopiedField] = useState(null)

  const toggleCategory = (category) => {
    setExpandedCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category)
        : [...prev, category]
    )
  }

  const copyToClipboard = (text, field) => {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0a1628] p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-orange to-brand-coral flex items-center justify-center">
              <Mail className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 dark:text-white">
                Email Templates
              </h1>
              <p className="text-slate-500 dark:text-white/60">
                Preview and export templates for SendGrid
              </p>
            </div>
          </div>
        </div>

        {/* Summary Card */}
        <Card className="bg-white dark:bg-[#0d1d35] border-slate-200 dark:border-white/10 mb-6">
          <CardContent className="p-6">
            <div className="flex flex-wrap gap-4">
              {Object.entries(groupedTemplates).map(([category, templates]) => {
                const Icon = categoryIcons[category] || Mail
                return (
                  <div key={category} className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-white/5 rounded-lg">
                    <Icon className="h-4 w-4 text-brand-orange" />
                    <span className="text-sm font-medium text-slate-700 dark:text-white/80">{category}</span>
                    <Badge variant="secondary" className="text-xs">{templates.length}</Badge>
                  </div>
                )
              })}
              <div className="flex items-center gap-2 px-4 py-2 bg-brand-orange/10 rounded-lg ml-auto">
                <Sparkles className="h-4 w-4 text-brand-orange" />
                <span className="text-sm font-medium text-brand-orange">{EMAIL_TEMPLATES.length} Total Templates</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid lg:grid-cols-[350px_1fr] gap-6">
          {/* Template List */}
          <div className="space-y-4">
            {Object.entries(groupedTemplates).map(([category, templates]) => {
              const Icon = categoryIcons[category] || Mail
              const isExpanded = expandedCategories.includes(category)
              
              return (
                <Card key={category} className="bg-white dark:bg-[#0d1d35] border-slate-200 dark:border-white/10 overflow-hidden">
                  <button
                    onClick={() => toggleCategory(category)}
                    className="w-full p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-brand-orange/10 flex items-center justify-center">
                        <Icon className="h-4 w-4 text-brand-orange" />
                      </div>
                      <span className="font-semibold text-slate-900 dark:text-white">{category}</span>
                      <Badge variant="secondary" className="text-xs">{templates.length}</Badge>
                    </div>
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    )}
                  </button>
                  
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: 'auto' }}
                        exit={{ height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="border-t border-slate-100 dark:border-white/5">
                          {templates.map((template) => (
                            <button
                              key={template.id}
                              onClick={() => setSelectedTemplate(template)}
                              className={cn(
                                "w-full p-3 pl-14 text-left hover:bg-slate-50 dark:hover:bg-white/5 transition-colors border-b border-slate-100 dark:border-white/5 last:border-b-0",
                                selectedTemplate.id === template.id && "bg-brand-orange/5 dark:bg-brand-orange/10"
                              )}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <div className="font-medium text-sm text-slate-900 dark:text-white">
                                    {template.name}
                                  </div>
                                  <div className="text-xs text-slate-500 dark:text-white/50 mt-0.5">
                                    {template.trigger}
                                  </div>
                                </div>
                                <Badge className={cn("text-[10px] shrink-0", priorityColors[template.priority])}>
                                  {template.priority}
                                </Badge>
                              </div>
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              )
            })}
          </div>

          {/* Preview Panel */}
          <div className="space-y-4">
            {/* Template Info */}
            <Card className="bg-white dark:bg-[#0d1d35] border-slate-200 dark:border-white/10">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg text-slate-900 dark:text-white">
                      {selectedTemplate.name}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {selectedTemplate.description}
                    </CardDescription>
                  </div>
                  <Badge className={cn(priorityColors[selectedTemplate.priority])}>
                    {selectedTemplate.priority} Priority
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-slate-500 dark:text-white/50 uppercase tracking-wider">
                      Subject Line
                    </label>
                    <div className="mt-1 flex items-center gap-2">
                      <code className="flex-1 text-sm bg-slate-100 dark:bg-white/5 px-3 py-2 rounded-lg text-slate-700 dark:text-white/80">
                        {selectedTemplate.subject}
                      </code>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-8 w-8 shrink-0"
                        onClick={() => copyToClipboard(selectedTemplate.subject, 'subject')}
                      >
                        {copiedField === 'subject' ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500 dark:text-white/50 uppercase tracking-wider">
                      Trigger Event
                    </label>
                    <div className="mt-1 flex items-center gap-2 text-sm bg-slate-100 dark:bg-white/5 px-3 py-2 rounded-lg text-slate-700 dark:text-white/80">
                      <Zap className="h-4 w-4 text-brand-orange shrink-0" />
                      {selectedTemplate.trigger}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Email Preview */}
            <Card className="bg-white dark:bg-[#0d1d35] border-slate-200 dark:border-white/10">
              <CardHeader className="pb-3 border-b border-slate-100 dark:border-white/5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4 text-slate-400" />
                    <CardTitle className="text-sm text-slate-700 dark:text-white/80">
                      Email Preview
                    </CardTitle>
                  </div>
                  <div className="text-xs text-slate-400">
                    Sample data shown
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="bg-slate-100 dark:bg-slate-900 p-4 sm:p-6">
                  <div className="rounded-lg overflow-hidden shadow-xl border border-slate-200 dark:border-slate-700">
                    <EmailPreview template={selectedTemplate} />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Resend Instructions */}
            <Card className="bg-gradient-to-br from-brand-orange/5 to-brand-coral/5 dark:from-brand-orange/10 dark:to-brand-coral/10 border-brand-orange/20">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-brand-orange/20 flex items-center justify-center shrink-0">
                    <Send className="h-4 w-4 text-brand-orange" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 dark:text-white text-sm">
                      Resend.com Integration
                    </h4>
                    <p className="text-xs text-slate-600 dark:text-white/60 mt-1 mb-2">
                      Emails are sent automatically via Resend. To enable:
                    </p>
                    <ol className="text-xs text-slate-600 dark:text-white/60 space-y-1 list-decimal list-inside">
                      <li>Create account at <a href="https://resend.com" target="_blank" rel="noopener" className="text-brand-orange hover:underline">resend.com</a></li>
                      <li>Verify <strong>brandastic.co</strong> domain</li>
                      <li>Add <code className="bg-white/50 dark:bg-white/10 px-1 rounded">RESEND_API_KEY</code> to Supabase secrets</li>
                      <li>Run <code className="bg-white/50 dark:bg-white/10 px-1 rounded">email-notifications-setup.sql</code></li>
                      <li>Deploy edge function: <code className="bg-white/50 dark:bg-white/10 px-1 rounded">supabase functions deploy send-emails</code></li>
                    </ol>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
