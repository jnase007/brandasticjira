-- =====================================================
-- EMAIL TRIGGER FOR @MENTIONS
-- =====================================================
-- This adds email notifications when someone is @mentioned
-- Works with the existing email_queue and notification_preferences
-- =====================================================

-- 1. TRIGGER: Email on @mention notification
-- When a 'mention' type notification is inserted, queue an email
-- =====================================================
CREATE OR REPLACE FUNCTION notify_mention_email()
RETURNS TRIGGER AS $$
DECLARE
  v_from_user_name TEXT;
  v_message_preview TEXT;
  v_entity_url TEXT;
BEGIN
  -- Only trigger for mention type notifications
  IF NEW.type != 'mention' THEN
    RETURN NEW;
  END IF;
  
  -- Get the sender's name from the notification data
  v_from_user_name := NEW.title; -- Title is usually "John Doe mentioned you"
  
  -- Get message preview from the notification
  v_message_preview := LEFT(COALESCE(NEW.message, ''), 200);
  IF LENGTH(COALESCE(NEW.message, '')) > 200 THEN
    v_message_preview := v_message_preview || '...';
  END IF;
  
  -- Build URL from notification data
  v_entity_url := CASE 
    WHEN NEW.data->>'entity_type' = 'ticket' THEN '/tickets/' || COALESCE(NEW.data->>'entity_id', '')
    WHEN NEW.data->>'entity_type' = 'client_note' THEN '/clients/' || COALESCE(NEW.data->>'client_id', '')
    WHEN NEW.data->>'entity_type' = 'client_note_reply' THEN '/clients/' || COALESCE(NEW.data->>'client_id', '')
    ELSE '/dashboard'
  END;
  
  -- Queue the email
  PERFORM queue_email_notification(
    NEW.user_id,
    'mention',
    NEW.title,  -- e.g., "John Doe mentioned you"
    jsonb_build_object(
      'from_user_name', v_from_user_name,
      'message_preview', v_message_preview,
      'entity_type', NEW.data->>'entity_type',
      'entity_name', NEW.data->>'entity_name',
      'client_id', NEW.data->>'client_id',
      'url', v_entity_url
    ),
    'email_mentions',  -- Check email_mentions preference
    now(),
    'mention_email_' || NEW.id  -- Idempotency key
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on notifications table for mentions
DROP TRIGGER IF EXISTS trigger_mention_email ON public.notifications;
CREATE TRIGGER trigger_mention_email
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  WHEN (NEW.type = 'mention')
  EXECUTE FUNCTION notify_mention_email();

-- =====================================================
-- DONE! 
-- =====================================================
-- 
-- After running this SQL:
-- 1. When someone is @mentioned, they get an in-app notification (existing)
-- 2. An email is also queued to email_queue (new)
-- 3. The Edge Function will send the email (existing)
--
-- Make sure to also add the 'mention' template to your Edge Function!
-- =====================================================
