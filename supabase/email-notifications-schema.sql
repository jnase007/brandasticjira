-- =====================================================
-- EMAIL NOTIFICATIONS SCHEMA FOR BRANDASTIC PM
-- =====================================================
-- This script sets up:
-- 1. Notification preferences table (per user settings)
-- 2. Email queue table (for processing outbound emails)
-- 3. Triggers to detect events and queue emails
-- 4. Weekly summary scheduling support
-- =====================================================

-- 1. NOTIFICATION PREFERENCES TABLE
-- Stores each user's email notification preferences
-- =====================================================
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Email notification toggles
  email_new_tickets BOOLEAN DEFAULT true,      -- When tickets are assigned to you
  email_comments BOOLEAN DEFAULT true,          -- When someone comments on your tickets
  email_achievements BOOLEAN DEFAULT true,      -- When you unlock new achievements
  email_weekly_summary BOOLEAN DEFAULT false,   -- Weekly activity summary
  
  -- Optional: Additional notification types for future
  email_mentions BOOLEAN DEFAULT true,          -- When you're @mentioned
  email_due_dates BOOLEAN DEFAULT true,         -- Reminders for upcoming due dates
  email_status_changes BOOLEAN DEFAULT false,   -- When ticket status changes
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(user_id)
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user 
ON public.notification_preferences(user_id);

-- 2. EMAIL QUEUE TABLE
-- Stores emails to be sent (processed by Edge Function or external service)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.email_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Recipient info
  to_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  to_email TEXT NOT NULL,
  to_name TEXT,
  
  -- Email content
  subject TEXT NOT NULL,
  template_id TEXT NOT NULL,  -- e.g., 'ticket_assigned', 'new_comment', 'achievement', 'weekly_summary'
  template_data JSONB DEFAULT '{}',  -- Dynamic data for the email template
  
  -- Processing status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')),
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  last_error TEXT,
  
  -- Scheduling
  scheduled_for TIMESTAMPTZ DEFAULT now(),  -- When to send (for delayed/scheduled emails)
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  sent_at TIMESTAMPTZ,
  
  -- Prevent duplicate emails for the same event
  idempotency_key TEXT UNIQUE
);

-- Indexes for efficient queue processing
CREATE INDEX IF NOT EXISTS idx_email_queue_status_scheduled 
ON public.email_queue(status, scheduled_for) 
WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_email_queue_user 
ON public.email_queue(to_user_id);

-- 3. HELPER FUNCTION: Get user email and name
-- =====================================================
CREATE OR REPLACE FUNCTION get_user_email_info(p_user_id UUID)
RETURNS TABLE(email TEXT, full_name TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(p.email, u.email)::TEXT as email,
    COALESCE(p.full_name, u.raw_user_meta_data->>'full_name', 'User')::TEXT as full_name
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE u.id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. HELPER FUNCTION: Check if user wants this notification type
-- =====================================================
CREATE OR REPLACE FUNCTION user_wants_notification(p_user_id UUID, p_notification_type TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_wants BOOLEAN;
BEGIN
  SELECT 
    CASE p_notification_type
      WHEN 'email_new_tickets' THEN COALESCE(email_new_tickets, true)
      WHEN 'email_comments' THEN COALESCE(email_comments, true)
      WHEN 'email_achievements' THEN COALESCE(email_achievements, true)
      WHEN 'email_weekly_summary' THEN COALESCE(email_weekly_summary, false)
      WHEN 'email_mentions' THEN COALESCE(email_mentions, true)
      WHEN 'email_due_dates' THEN COALESCE(email_due_dates, true)
      WHEN 'email_status_changes' THEN COALESCE(email_status_changes, false)
      ELSE true
    END
  INTO v_wants
  FROM public.notification_preferences
  WHERE user_id = p_user_id;
  
  -- Default to true if no preferences exist (except weekly summary)
  IF v_wants IS NULL THEN
    v_wants := CASE WHEN p_notification_type = 'email_weekly_summary' THEN false ELSE true END;
  END IF;
  
  RETURN v_wants;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. FUNCTION: Queue an email notification
-- =====================================================
CREATE OR REPLACE FUNCTION queue_email_notification(
  p_user_id UUID,
  p_template_id TEXT,
  p_subject TEXT,
  p_template_data JSONB,
  p_notification_type TEXT DEFAULT 'email_new_tickets',
  p_scheduled_for TIMESTAMPTZ DEFAULT now(),
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_email TEXT;
  v_name TEXT;
  v_email_id UUID;
BEGIN
  -- Check if user wants this type of notification
  IF NOT user_wants_notification(p_user_id, p_notification_type) THEN
    RETURN NULL;
  END IF;
  
  -- Get user email info
  SELECT email, full_name INTO v_email, v_name
  FROM get_user_email_info(p_user_id);
  
  IF v_email IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Insert into email queue (with conflict handling for idempotency)
  INSERT INTO public.email_queue (
    to_user_id,
    to_email,
    to_name,
    subject,
    template_id,
    template_data,
    scheduled_for,
    idempotency_key
  ) VALUES (
    p_user_id,
    v_email,
    v_name,
    p_subject,
    p_template_id,
    p_template_data,
    p_scheduled_for,
    p_idempotency_key
  )
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING id INTO v_email_id;
  
  RETURN v_email_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. TRIGGER: Email on ticket assignment
-- =====================================================
CREATE OR REPLACE FUNCTION notify_ticket_assigned()
RETURNS TRIGGER AS $$
DECLARE
  v_ticket_title TEXT;
  v_client_name TEXT;
  v_assigner_name TEXT;
BEGIN
  -- Only trigger if assigned_to changed and is not null
  IF NEW.assigned_to IS NOT NULL AND 
     (OLD.assigned_to IS NULL OR OLD.assigned_to != NEW.assigned_to) THEN
    
    -- Get ticket and client info
    SELECT t.title, c.name INTO v_ticket_title, v_client_name
    FROM public.tickets t
    LEFT JOIN public.clients c ON c.id = t.client_id
    WHERE t.id = NEW.id;
    
    -- Get assigner name (the person who made the change)
    SELECT full_name INTO v_assigner_name
    FROM public.profiles
    WHERE id = auth.uid();
    
    -- Queue the email
    PERFORM queue_email_notification(
      NEW.assigned_to,
      'ticket_assigned',
      'New Ticket Assigned: ' || COALESCE(v_ticket_title, 'Untitled'),
      jsonb_build_object(
        'ticket_id', NEW.id,
        'ticket_title', v_ticket_title,
        'ticket_number', NEW.ticket_id,
        'client_name', v_client_name,
        'priority', NEW.priority,
        'due_date', NEW.due_date,
        'assigned_by', v_assigner_name,
        'url', '/clients/' || NEW.client_id || '/tickets/' || COALESCE(NEW.ticket_id, NEW.id::text)
      ),
      'email_new_tickets',
      now(),
      'ticket_assigned_' || NEW.id || '_' || NEW.assigned_to
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for ticket assignment
DROP TRIGGER IF EXISTS trigger_notify_ticket_assigned ON public.tickets;
CREATE TRIGGER trigger_notify_ticket_assigned
  AFTER INSERT OR UPDATE OF assigned_to ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION notify_ticket_assigned();

-- 7. TRIGGER: Email on new comment
-- =====================================================
CREATE OR REPLACE FUNCTION notify_new_comment()
RETURNS TRIGGER AS $$
DECLARE
  v_ticket RECORD;
  v_commenter_name TEXT;
  v_comment_preview TEXT;
BEGIN
  -- Get ticket info and owner
  SELECT t.id, t.title, t.ticket_id, t.assigned_to, t.created_by, c.name as client_name
  INTO v_ticket
  FROM public.tickets t
  LEFT JOIN public.clients c ON c.id = t.client_id
  WHERE t.id = NEW.ticket_id;
  
  -- Get commenter name
  SELECT full_name INTO v_commenter_name
  FROM public.profiles
  WHERE id = NEW.user_id;
  
  -- Truncate comment for preview
  v_comment_preview := LEFT(NEW.content, 200);
  IF LENGTH(NEW.content) > 200 THEN
    v_comment_preview := v_comment_preview || '...';
  END IF;
  
  -- Notify ticket assignee (if not the commenter)
  IF v_ticket.assigned_to IS NOT NULL AND v_ticket.assigned_to != NEW.user_id THEN
    PERFORM queue_email_notification(
      v_ticket.assigned_to,
      'new_comment',
      'New Comment on: ' || COALESCE(v_ticket.title, 'Untitled'),
      jsonb_build_object(
        'ticket_id', v_ticket.id,
        'ticket_title', v_ticket.title,
        'ticket_number', v_ticket.ticket_id,
        'client_name', v_ticket.client_name,
        'commenter_name', v_commenter_name,
        'comment_preview', v_comment_preview,
        'url', '/tickets/' || COALESCE(v_ticket.ticket_id, v_ticket.id::text)
      ),
      'email_comments',
      now(),
      'comment_' || NEW.id || '_' || v_ticket.assigned_to
    );
  END IF;
  
  -- Also notify ticket creator (if different from assignee and commenter)
  IF v_ticket.created_by IS NOT NULL 
     AND v_ticket.created_by != NEW.user_id 
     AND v_ticket.created_by != v_ticket.assigned_to THEN
    PERFORM queue_email_notification(
      v_ticket.created_by,
      'new_comment',
      'New Comment on: ' || COALESCE(v_ticket.title, 'Untitled'),
      jsonb_build_object(
        'ticket_id', v_ticket.id,
        'ticket_title', v_ticket.title,
        'ticket_number', v_ticket.ticket_id,
        'client_name', v_ticket.client_name,
        'commenter_name', v_commenter_name,
        'comment_preview', v_comment_preview,
        'url', '/tickets/' || COALESCE(v_ticket.ticket_id, v_ticket.id::text)
      ),
      'email_comments',
      now(),
      'comment_' || NEW.id || '_' || v_ticket.created_by
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new comments
DROP TRIGGER IF EXISTS trigger_notify_new_comment ON public.comments;
CREATE TRIGGER trigger_notify_new_comment
  AFTER INSERT ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_comment();

-- 8. TRIGGER: Email on achievement unlock
-- =====================================================
CREATE OR REPLACE FUNCTION notify_achievement_unlocked()
RETURNS TRIGGER AS $$
DECLARE
  v_achievement RECORD;
BEGIN
  -- Get achievement info (assuming you have an achievements table)
  -- Adjust this based on your actual achievements schema
  SELECT name, description, xp_reward, icon
  INTO v_achievement
  FROM public.achievements
  WHERE id = NEW.achievement_id;
  
  -- Queue the email
  PERFORM queue_email_notification(
    NEW.user_id,
    'achievement_unlocked',
    '🏆 Achievement Unlocked: ' || COALESCE(v_achievement.name, 'New Achievement'),
    jsonb_build_object(
      'achievement_name', v_achievement.name,
      'achievement_description', v_achievement.description,
      'xp_reward', v_achievement.xp_reward,
      'icon', v_achievement.icon,
      'url', '/achievements'
    ),
    'email_achievements',
    now(),
    'achievement_' || NEW.id
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for achievement unlocks (if user_achievements table exists)
-- Uncomment if you have this table:
-- DROP TRIGGER IF EXISTS trigger_notify_achievement ON public.user_achievements;
-- CREATE TRIGGER trigger_notify_achievement
--   AFTER INSERT ON public.user_achievements
--   FOR EACH ROW
--   EXECUTE FUNCTION notify_achievement_unlocked();

-- 9. FUNCTION: Generate weekly summary data
-- Call this from a scheduled Edge Function
-- =====================================================
CREATE OR REPLACE FUNCTION generate_weekly_summaries()
RETURNS INTEGER AS $$
DECLARE
  v_user RECORD;
  v_summary JSONB;
  v_count INTEGER := 0;
  v_week_start DATE := date_trunc('week', now() - interval '1 week')::date;
  v_week_end DATE := v_week_start + interval '6 days';
BEGIN
  -- Loop through users who want weekly summaries
  FOR v_user IN 
    SELECT np.user_id, p.full_name, p.email
    FROM public.notification_preferences np
    JOIN public.profiles p ON p.id = np.user_id
    WHERE np.email_weekly_summary = true
  LOOP
    -- Calculate user's weekly stats
    SELECT jsonb_build_object(
      'week_start', v_week_start,
      'week_end', v_week_end,
      'total_hours', COALESCE(SUM(te.minutes) / 60.0, 0),
      'billable_hours', COALESCE(SUM(CASE WHEN te.billable THEN te.minutes ELSE 0 END) / 60.0, 0),
      'tickets_completed', (
        SELECT COUNT(*) FROM public.tickets t
        WHERE t.assigned_to = v_user.user_id
          AND t.status = 'done'
          AND t.updated_at >= v_week_start
          AND t.updated_at < v_week_end + interval '1 day'
      ),
      'tickets_created', (
        SELECT COUNT(*) FROM public.tickets t
        WHERE t.created_by = v_user.user_id
          AND t.created_at >= v_week_start
          AND t.created_at < v_week_end + interval '1 day'
      ),
      'comments_made', (
        SELECT COUNT(*) FROM public.comments c
        WHERE c.user_id = v_user.user_id
          AND c.created_at >= v_week_start
          AND c.created_at < v_week_end + interval '1 day'
      ),
      'clients_worked_on', (
        SELECT COUNT(DISTINCT te2.client_id) FROM public.time_entries te2
        WHERE te2.user_id = v_user.user_id
          AND te2.date >= v_week_start
          AND te2.date <= v_week_end
      )
    )
    INTO v_summary
    FROM public.time_entries te
    WHERE te.user_id = v_user.user_id
      AND te.date >= v_week_start
      AND te.date <= v_week_end;
    
    -- Queue the weekly summary email
    PERFORM queue_email_notification(
      v_user.user_id,
      'weekly_summary',
      'Your Weekly Summary: ' || to_char(v_week_start, 'Mon DD') || ' - ' || to_char(v_week_end, 'Mon DD'),
      v_summary,
      'email_weekly_summary',
      now(),
      'weekly_summary_' || v_user.user_id || '_' || v_week_start
    );
    
    v_count := v_count + 1;
  END LOOP;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. ROW LEVEL SECURITY
-- =====================================================

-- Enable RLS
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;

-- Notification preferences: Users can only see/edit their own
DROP POLICY IF EXISTS "Users can view own preferences" ON public.notification_preferences;
CREATE POLICY "Users can view own preferences" ON public.notification_preferences
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own preferences" ON public.notification_preferences;
CREATE POLICY "Users can insert own preferences" ON public.notification_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own preferences" ON public.notification_preferences;
CREATE POLICY "Users can update own preferences" ON public.notification_preferences
  FOR UPDATE USING (auth.uid() = user_id);

-- Email queue: Only service role should access this, but allow users to see their own emails
DROP POLICY IF EXISTS "Users can view own emails" ON public.email_queue;
CREATE POLICY "Users can view own emails" ON public.email_queue
  FOR SELECT USING (auth.uid() = to_user_id);

-- Admins can view all emails
DROP POLICY IF EXISTS "Admins can view all emails" ON public.email_queue;
CREATE POLICY "Admins can view all emails" ON public.email_queue
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 11. AUTO-CREATE PREFERENCES FOR NEW USERS
-- =====================================================
CREATE OR REPLACE FUNCTION create_default_notification_preferences()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.notification_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on profiles table (when a new user profile is created)
DROP TRIGGER IF EXISTS trigger_create_notification_preferences ON public.profiles;
CREATE TRIGGER trigger_create_notification_preferences
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION create_default_notification_preferences();

-- 12. GRANT PERMISSIONS
-- =====================================================
GRANT SELECT, INSERT, UPDATE ON public.notification_preferences TO authenticated;
GRANT SELECT ON public.email_queue TO authenticated;

-- =====================================================
-- DONE! 
-- =====================================================
-- 
-- NEXT STEPS TO COMPLETE EMAIL SETUP:
-- 
-- 1. Run this SQL in your Supabase SQL Editor
-- 
-- 2. Create a Supabase Edge Function to process the email queue
--    The Edge Function should:
--    - Query pending emails from email_queue
--    - Send via Resend, SendGrid, or another email provider
--    - Update status to 'sent' or 'failed'
-- 
-- 3. Set up a cron job (via pg_cron or Supabase) to:
--    - Call generate_weekly_summaries() every Monday at 9am
--    - Call your Edge Function to process the queue every minute
-- 
-- 4. Create email templates in your email provider:
--    - ticket_assigned: New ticket assignment notification
--    - new_comment: New comment on ticket
--    - achievement_unlocked: Achievement unlocked celebration
--    - weekly_summary: Weekly activity summary
-- 
-- Example Edge Function call for queue processing:
-- SELECT * FROM email_queue WHERE status = 'pending' AND scheduled_for <= now() ORDER BY created_at LIMIT 10;
-- 
-- Example cron for weekly summaries (using pg_cron):
-- SELECT cron.schedule('weekly-summaries', '0 9 * * 1', 'SELECT generate_weekly_summaries()');
-- 
-- =====================================================
