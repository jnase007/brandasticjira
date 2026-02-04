-- =====================================================
-- FIXED EMAIL TRIGGERS
-- Uses correct column names: assigned_to, reporter_id
-- =====================================================

-- =====================================================
-- 1. HELPER FUNCTION: Queue an Email
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
BEGIN
    -- Get user info
    SELECT id, email, full_name 
    INTO v_user 
    FROM public.profiles 
    WHERE id = p_to_user_id AND is_active = true;
    
    IF v_user IS NULL THEN
        RETURN NULL;
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
-- 2. TRIGGER: Task Assigned (uses assigned_to)
-- =====================================================
CREATE OR REPLACE FUNCTION notify_task_assigned()
RETURNS TRIGGER AS $$
DECLARE
    v_assigner_name TEXT;
    v_client_name TEXT;
    v_ticket_key TEXT;
BEGIN
    -- Only trigger when assigned_to changes and is set
    IF NEW.assigned_to IS NOT NULL AND 
       (OLD.assigned_to IS NULL OR NEW.assigned_to != OLD.assigned_to) THEN
        
        -- Don't notify if assigning to yourself
        IF NEW.assigned_to = auth.uid() THEN
            RETURN NEW;
        END IF;
        
        -- Get assigner name (current user)
        SELECT full_name INTO v_assigner_name 
        FROM public.profiles 
        WHERE id = auth.uid();
        
        -- Get client name
        SELECT c.name INTO v_client_name
        FROM public.clients c
        WHERE c.id = NEW.client_id;
        
        -- Get ticket key
        v_ticket_key := COALESCE(NEW.ticket_id, 'TASK-' || LEFT(NEW.id::text, 8));
        
        -- Queue the email
        PERFORM queue_email(
            NEW.assigned_to,
            'ticket_assigned',
            jsonb_build_object(
                'ticket_id', v_ticket_key,
                'ticket_title', NEW.title,
                'assigned_by', COALESCE(v_assigner_name, 'A team member'),
                'client_name', v_client_name,
                'priority', NEW.priority,
                'due_date', NEW.due_date,
                'url', '/tickets/' || v_ticket_key
            ),
            'assigned:' || NEW.id || ':' || NEW.assigned_to
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create/replace trigger
DROP TRIGGER IF EXISTS trigger_notify_task_assigned ON public.tickets;
CREATE TRIGGER trigger_notify_task_assigned
    AFTER INSERT OR UPDATE OF assigned_to ON public.tickets
    FOR EACH ROW
    EXECUTE FUNCTION notify_task_assigned();

-- =====================================================
-- 3. TRIGGER: Status Changed
-- =====================================================
CREATE OR REPLACE FUNCTION notify_status_changed()
RETURNS TRIGGER AS $$
DECLARE
    v_ticket_key TEXT;
BEGIN
    -- Only trigger when status actually changes
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        -- Notify the assignee (if not the one making the change)
        IF NEW.assigned_to IS NOT NULL AND NEW.assigned_to != auth.uid() THEN
            v_ticket_key := COALESCE(NEW.ticket_id, 'TASK-' || LEFT(NEW.id::text, 8));
            
            PERFORM queue_email(
                NEW.assigned_to,
                'ticket_status_changed',
                jsonb_build_object(
                    'ticket_id', v_ticket_key,
                    'ticket_title', NEW.title,
                    'old_status', OLD.status,
                    'new_status', NEW.status,
                    'url', '/tickets/' || v_ticket_key
                ),
                'status:' || NEW.id || ':' || NEW.status || ':' || NEW.assigned_to
            );
        END IF;
        
        -- Also notify reporter if different from assignee
        IF NEW.reporter_id IS NOT NULL 
           AND NEW.reporter_id != auth.uid() 
           AND NEW.reporter_id != COALESCE(NEW.assigned_to, '00000000-0000-0000-0000-000000000000'::uuid) THEN
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
-- 4. TRIGGER: New Comment
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
    SELECT t.id, t.title, t.ticket_id, t.assigned_to, t.reporter_id
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
    IF v_ticket.assigned_to IS NOT NULL AND v_ticket.assigned_to != NEW.user_id THEN
        PERFORM queue_email(
            v_ticket.assigned_to,
            'new_comment',
            jsonb_build_object(
                'ticket_id', v_ticket_key,
                'ticket_title', v_ticket.title,
                'commenter_name', COALESCE(v_commenter_name, 'Someone'),
                'comment_preview', v_comment_preview,
                'url', '/tickets/' || v_ticket_key
            ),
            'comment:' || NEW.id || ':' || v_ticket.assigned_to
        );
    END IF;
    
    -- Notify reporter (if different from assignee and commenter)
    IF v_ticket.reporter_id IS NOT NULL 
       AND v_ticket.reporter_id != NEW.user_id
       AND v_ticket.reporter_id != COALESCE(v_ticket.assigned_to, '00000000-0000-0000-0000-000000000000'::uuid) THEN
        PERFORM queue_email(
            v_ticket.reporter_id,
            'new_comment',
            jsonb_build_object(
                'ticket_id', v_ticket_key,
                'ticket_title', v_ticket.title,
                'commenter_name', COALESCE(v_commenter_name, 'Someone'),
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
-- 5. TRIGGER: @Mention in Comment
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
    
    -- Find all mentioned user IDs (format: @[Name](uuid))
    FOR v_mention_match IN 
        SELECT (regexp_matches(NEW.content, '@\[[^\]]+\]\(([0-9a-f-]+)\)', 'gi'))[1]
    LOOP
        BEGIN
            v_mentioned_user_id := v_mention_match::uuid;
            
            -- Don't notify if mentioning yourself
            IF v_mentioned_user_id != NEW.user_id THEN
                PERFORM queue_email(
                    v_mentioned_user_id,
                    'mention',
                    jsonb_build_object(
                        'from_user_name', COALESCE(v_mentioner_name, 'Someone'),
                        'entity_name', v_ticket.title,
                        'message_preview', v_mention_preview,
                        'url', '/tickets/' || v_ticket_key
                    ),
                    'mention:' || NEW.id || ':' || v_mentioned_user_id
                );
            END IF;
        EXCEPTION WHEN OTHERS THEN
            -- Skip invalid UUIDs
            NULL;
        END;
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
-- DONE! Triggers are now using correct column names
-- =====================================================
