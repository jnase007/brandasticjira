-- =====================================================
-- EMAIL NOTIFICATIONS SYSTEM
-- Complete setup for automated email notifications
-- =====================================================
-- 
-- WHAT THIS DOES:
-- 1. Creates email_queue table to store pending emails
-- 2. Creates notification_preferences table for user settings
-- 3. Creates triggers to automatically queue emails when:
--    - Task is assigned to someone
--    - Comment is added to a task
--    - @mention in a comment
--    - Task status changes
--    - Task becomes due/overdue
--
-- AFTER RUNNING THIS SQL, YOU NEED TO:
-- 1. Set up Resend.com account and verify brandastic.co domain
-- 2. Add RESEND_API_KEY to Supabase secrets
-- 3. Deploy the edge function: supabase functions deploy send-emails
-- 4. Set up a cron job to process the queue (pg_cron or external)
-- =====================================================

-- =====================================================
-- 1. EMAIL QUEUE TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.email_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Recipient info
    to_email TEXT NOT NULL,
    to_name TEXT,
    to_user_id UUID REFERENCES public.profiles(id),
    
    -- Email content
    template_id TEXT NOT NULL,  -- e.g., 'ticket_assigned', 'new_comment'
    subject TEXT,               -- Optional override
    template_data JSONB DEFAULT '{}'::jsonb,  -- Data passed to template
    
    -- Scheduling
    scheduled_for TIMESTAMPTZ DEFAULT NOW(),
    
    -- Status tracking
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')),
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    sent_at TIMESTAMPTZ,
    last_error TEXT,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES public.profiles(id),
    
    -- Prevent duplicate emails
    dedup_key TEXT,  -- e.g., 'comment:uuid:recipient:uuid'
    
    CONSTRAINT unique_dedup_key UNIQUE (dedup_key)
);

-- Indexes for efficient queue processing
CREATE INDEX IF NOT EXISTS idx_email_queue_status ON public.email_queue(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_email_queue_scheduled ON public.email_queue(scheduled_for) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_email_queue_user ON public.email_queue(to_user_id);

-- =====================================================
-- 2. NOTIFICATION PREFERENCES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    
    -- Email notification settings
    email_task_assigned BOOLEAN DEFAULT true,
    email_task_status_changed BOOLEAN DEFAULT true,
    email_new_comment BOOLEAN DEFAULT true,
    email_mention BOOLEAN DEFAULT true,
    email_due_reminder BOOLEAN DEFAULT true,
    email_overdue BOOLEAN DEFAULT true,
    email_weekly_summary BOOLEAN DEFAULT true,
    email_achievements BOOLEAN DEFAULT false,
    
    -- In-app notification settings (for future)
    push_enabled BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_user_preferences UNIQUE (user_id)
);

-- =====================================================
-- 3. HELPER FUNCTION: Queue an Email
-- =====================================================
CREATE OR REPLACE FUNCTION queue_email(
    p_to_user_id UUID,
    p_template_id TEXT,
    p_template_data JSONB DEFAULT '{}'::jsonb,
    p_dedup_key TEXT DEFAULT NULL,
    p_scheduled_for TIMESTAMPTZ DEFAULT NOW()
)
RETURNS UUID AS $$
DECLARE
    v_user RECORD;
    v_email_id UUID;
    v_pref_column TEXT;
    v_should_send BOOLEAN := true;
BEGIN
    -- Get user info
    SELECT id, email, full_name 
    INTO v_user 
    FROM public.profiles 
    WHERE id = p_to_user_id AND is_active = true;
    
    IF v_user IS NULL THEN
        RETURN NULL;  -- User not found or inactive
    END IF;
    
    -- Check notification preferences
    v_pref_column := 'email_' || p_template_id;
    
    -- Map template_id to preference column
    CASE p_template_id
        WHEN 'ticket_assigned' THEN v_pref_column := 'email_task_assigned';
        WHEN 'ticket_status_changed' THEN v_pref_column := 'email_task_status_changed';
        WHEN 'new_comment' THEN v_pref_column := 'email_new_comment';
        WHEN 'mention' THEN v_pref_column := 'email_mention';
        WHEN 'due_date_reminder' THEN v_pref_column := 'email_due_reminder';
        WHEN 'overdue' THEN v_pref_column := 'email_overdue';
        WHEN 'weekly_summary' THEN v_pref_column := 'email_weekly_summary';
        WHEN 'achievement_unlocked' THEN v_pref_column := 'email_achievements';
        ELSE v_pref_column := NULL;
    END CASE;
    
    -- Check if user has disabled this notification type
    IF v_pref_column IS NOT NULL THEN
        EXECUTE format(
            'SELECT COALESCE((SELECT %I FROM notification_preferences WHERE user_id = $1), true)',
            v_pref_column
        ) INTO v_should_send USING p_to_user_id;
    END IF;
    
    IF NOT v_should_send THEN
        RETURN NULL;  -- User has disabled this notification
    END IF;
    
    -- Insert into queue
    INSERT INTO public.email_queue (
        to_email,
        to_name,
        to_user_id,
        template_id,
        template_data,
        scheduled_for,
        dedup_key
    ) VALUES (
        v_user.email,
        v_user.full_name,
        p_to_user_id,
        p_template_id,
        p_template_data,
        p_scheduled_for,
        p_dedup_key
    )
    ON CONFLICT (dedup_key) DO NOTHING
    RETURNING id INTO v_email_id;
    
    RETURN v_email_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 4. TRIGGER: Task Assigned
-- =====================================================
CREATE OR REPLACE FUNCTION notify_task_assigned()
RETURNS TRIGGER AS $$
DECLARE
    v_assigner_name TEXT;
    v_client_name TEXT;
    v_ticket_key TEXT;
BEGIN
    -- Only trigger when assignee changes and is set
    IF NEW.assignee_id IS NOT NULL AND 
       (OLD.assignee_id IS NULL OR NEW.assignee_id != OLD.assignee_id) THEN
        
        -- Don't notify if assigning to yourself
        IF NEW.assignee_id = COALESCE(NEW.reporter_id, auth.uid()) THEN
            RETURN NEW;
        END IF;
        
        -- Get assigner name
        SELECT full_name INTO v_assigner_name 
        FROM public.profiles 
        WHERE id = COALESCE(NEW.reporter_id, auth.uid());
        
        -- Get client name
        SELECT c.name INTO v_client_name
        FROM public.boards b
        JOIN public.clients c ON c.id = b.client_id
        WHERE b.id = NEW.board_id;
        
        -- Get ticket key
        v_ticket_key := COALESCE(NEW.ticket_id, 'TASK-' || LEFT(NEW.id::text, 8));
        
        -- Queue the email
        PERFORM queue_email(
            NEW.assignee_id,
            'ticket_assigned',
            jsonb_build_object(
                'ticket_id', v_ticket_key,
                'ticket_title', NEW.title,
                'assigned_by', v_assigner_name,
                'client_name', v_client_name,
                'priority', NEW.priority,
                'due_date', NEW.due_date,
                'url', '/tickets/' || v_ticket_key
            ),
            'assigned:' || NEW.id || ':' || NEW.assignee_id
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create/replace trigger
DROP TRIGGER IF EXISTS trigger_notify_task_assigned ON public.tickets;
CREATE TRIGGER trigger_notify_task_assigned
    AFTER INSERT OR UPDATE OF assignee_id ON public.tickets
    FOR EACH ROW
    EXECUTE FUNCTION notify_task_assigned();

-- =====================================================
-- 5. TRIGGER: Status Changed
-- =====================================================
CREATE OR REPLACE FUNCTION notify_status_changed()
RETURNS TRIGGER AS $$
DECLARE
    v_ticket_key TEXT;
BEGIN
    -- Only trigger when status actually changes
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        -- Notify the assignee (if not the one making the change)
        IF NEW.assignee_id IS NOT NULL AND NEW.assignee_id != auth.uid() THEN
            v_ticket_key := COALESCE(NEW.ticket_id, 'TASK-' || LEFT(NEW.id::text, 8));
            
            PERFORM queue_email(
                NEW.assignee_id,
                'ticket_status_changed',
                jsonb_build_object(
                    'ticket_id', v_ticket_key,
                    'ticket_title', NEW.title,
                    'old_status', OLD.status,
                    'new_status', NEW.status,
                    'url', '/tickets/' || v_ticket_key
                ),
                'status:' || NEW.id || ':' || NEW.status || ':' || NEW.assignee_id
            );
        END IF;
        
        -- Also notify reporter if different from assignee
        IF NEW.reporter_id IS NOT NULL 
           AND NEW.reporter_id != auth.uid() 
           AND NEW.reporter_id != COALESCE(NEW.assignee_id, '00000000-0000-0000-0000-000000000000'::uuid) THEN
            v_ticket_key := COALESCE(NEW.ticket_id, 'TASK-' || LEFT(NEW.id::text, 8));
            
            PERFORM queue_email(
                NEW.reporter_id,
                'ticket_status_changed',
                jsonb_build_object(
                    'ticket_id', v_ticket_key,
                    'ticket_title', NEW.title,
                    'old_status', OLD.status,
                    'new_status', NEW.status,
                    'url', '/tickets/' || v_ticket_key
                ),
                'status:' || NEW.id || ':' || NEW.status || ':' || NEW.reporter_id
            );
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create/replace trigger
DROP TRIGGER IF EXISTS trigger_notify_status_changed ON public.tickets;
CREATE TRIGGER trigger_notify_status_changed
    AFTER UPDATE OF status ON public.tickets
    FOR EACH ROW
    EXECUTE FUNCTION notify_status_changed();

-- =====================================================
-- 6. TRIGGER: New Comment
-- =====================================================
CREATE OR REPLACE FUNCTION notify_new_comment()
RETURNS TRIGGER AS $$
DECLARE
    v_ticket RECORD;
    v_commenter_name TEXT;
    v_ticket_key TEXT;
    v_comment_preview TEXT;
BEGIN
    -- Get ticket info
    SELECT t.id, t.title, t.ticket_id, t.assignee_id, t.reporter_id
    INTO v_ticket
    FROM public.tickets t
    WHERE t.id = NEW.ticket_id;
    
    IF v_ticket IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- Get commenter name
    SELECT full_name INTO v_commenter_name
    FROM public.profiles
    WHERE id = NEW.user_id;
    
    v_ticket_key := COALESCE(v_ticket.ticket_id, 'TASK-' || LEFT(v_ticket.id::text, 8));
    v_comment_preview := LEFT(NEW.content, 200);
    
    -- Notify assignee (if not the commenter)
    IF v_ticket.assignee_id IS NOT NULL AND v_ticket.assignee_id != NEW.user_id THEN
        PERFORM queue_email(
            v_ticket.assignee_id,
            'new_comment',
            jsonb_build_object(
                'ticket_id', v_ticket_key,
                'ticket_title', v_ticket.title,
                'commenter_name', v_commenter_name,
                'comment_preview', v_comment_preview,
                'url', '/tickets/' || v_ticket_key
            ),
            'comment:' || NEW.id || ':' || v_ticket.assignee_id
        );
    END IF;
    
    -- Notify reporter (if different from assignee and commenter)
    IF v_ticket.reporter_id IS NOT NULL 
       AND v_ticket.reporter_id != NEW.user_id
       AND v_ticket.reporter_id != COALESCE(v_ticket.assignee_id, '00000000-0000-0000-0000-000000000000'::uuid) THEN
        PERFORM queue_email(
            v_ticket.reporter_id,
            'new_comment',
            jsonb_build_object(
                'ticket_id', v_ticket_key,
                'ticket_title', v_ticket.title,
                'commenter_name', v_commenter_name,
                'comment_preview', v_comment_preview,
                'url', '/tickets/' || v_ticket_key
            ),
            'comment:' || NEW.id || ':' || v_ticket.reporter_id
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create/replace trigger
DROP TRIGGER IF EXISTS trigger_notify_new_comment ON public.comments;
CREATE TRIGGER trigger_notify_new_comment
    AFTER INSERT ON public.comments
    FOR EACH ROW
    EXECUTE FUNCTION notify_new_comment();

-- =====================================================
-- 7. TRIGGER: @Mention in Comment
-- =====================================================
CREATE OR REPLACE FUNCTION notify_mention()
RETURNS TRIGGER AS $$
DECLARE
    v_ticket RECORD;
    v_mentioner_name TEXT;
    v_ticket_key TEXT;
    v_mention_preview TEXT;
    v_mentioned_user_id UUID;
    v_mention_match TEXT;
BEGIN
    -- Look for @mentions in the content (format: @[name](user_id))
    -- or simple @username format
    
    -- Get ticket info
    SELECT t.id, t.title, t.ticket_id
    INTO v_ticket
    FROM public.tickets t
    WHERE t.id = NEW.ticket_id;
    
    IF v_ticket IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- Get mentioner name
    SELECT full_name INTO v_mentioner_name
    FROM public.profiles
    WHERE id = NEW.user_id;
    
    v_ticket_key := COALESCE(v_ticket.ticket_id, 'TASK-' || LEFT(v_ticket.id::text, 8));
    v_mention_preview := LEFT(NEW.content, 200);
    
    -- Find all mentioned user IDs (assuming format: data-user-id="uuid" or @[Name](uuid))
    FOR v_mention_match IN 
        SELECT (regexp_matches(NEW.content, '@\[[^\]]+\]\(([0-9a-f-]+)\)', 'gi'))[1]
    LOOP
        v_mentioned_user_id := v_mention_match::uuid;
        
        -- Don't notify if mentioning yourself
        IF v_mentioned_user_id != NEW.user_id THEN
            PERFORM queue_email(
                v_mentioned_user_id,
                'mention',
                jsonb_build_object(
                    'from_user_name', v_mentioner_name,
                    'entity_name', v_ticket.title,
                    'message_preview', v_mention_preview,
                    'url', '/tickets/' || v_ticket_key
                ),
                'mention:' || NEW.id || ':' || v_mentioned_user_id
            );
        END IF;
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create/replace trigger
DROP TRIGGER IF EXISTS trigger_notify_mention ON public.comments;
CREATE TRIGGER trigger_notify_mention
    AFTER INSERT ON public.comments
    FOR EACH ROW
    EXECUTE FUNCTION notify_mention();

-- =====================================================
-- 8. RLS POLICIES
-- =====================================================
ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- Email queue - only service role should access
CREATE POLICY "Service role can manage email queue"
    ON public.email_queue FOR ALL
    TO service_role
    USING (true);

-- Allow users to see their own queued emails
CREATE POLICY "Users can view their own emails"
    ON public.email_queue FOR SELECT
    TO authenticated
    USING (to_user_id = auth.uid());

-- Notification preferences
CREATE POLICY "Users can view their own preferences"
    ON public.notification_preferences FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Users can update their own preferences"
    ON public.notification_preferences FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own preferences"
    ON public.notification_preferences FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

-- =====================================================
-- 9. DEFAULT PREFERENCES FOR NEW USERS
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

-- Create trigger on profiles table
DROP TRIGGER IF EXISTS trigger_create_notification_preferences ON public.profiles;
CREATE TRIGGER trigger_create_notification_preferences
    AFTER INSERT ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION create_default_notification_preferences();

-- =====================================================
-- 10. CREATE PREFERENCES FOR EXISTING USERS
-- =====================================================
INSERT INTO public.notification_preferences (user_id)
SELECT id FROM public.profiles
WHERE id NOT IN (SELECT user_id FROM public.notification_preferences)
ON CONFLICT (user_id) DO NOTHING;

-- =====================================================
-- DONE! 
-- =====================================================
-- Next steps:
-- 1. Run this SQL in Supabase SQL Editor
-- 2. Set up Resend.com and add RESEND_API_KEY to Supabase secrets
-- 3. Deploy edge function: supabase functions deploy send-emails
-- 4. Set up cron to call the edge function every 1-5 minutes
--    OR use Supabase's pg_cron extension
-- =====================================================
