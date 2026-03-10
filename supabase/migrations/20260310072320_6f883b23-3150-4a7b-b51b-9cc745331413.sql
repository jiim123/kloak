
-- FIX 5: Harden insert_announcement_comment
DROP FUNCTION IF EXISTS public.insert_announcement_comment(uuid, uuid, text, uuid);
CREATE FUNCTION public.insert_announcement_comment(
  _message_id uuid, _user_id uuid, _content text, _reply_to_id uuid DEFAULT NULL
) RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  msg_channel_id uuid; new_comment announcement_comments%ROWTYPE; normalized_content text;
BEGIN
  IF NOT verify_request_identity(_user_id) THEN RAISE EXCEPTION 'Unauthorized: identity mismatch'; END IF;
  normalized_content := trim(_content);
  IF normalized_content IS NULL OR length(normalized_content) = 0 THEN RAISE EXCEPTION 'Comment content cannot be empty'; END IF;
  IF length(normalized_content) > 2000 THEN RAISE EXCEPTION 'Comment content cannot exceed 2000 characters'; END IF;
  IF NOT message_content_allowed(normalized_content) THEN RAISE EXCEPTION 'Comment contains blocked content'; END IF;
  IF NOT check_rate_limit(_user_id::text, 'insert_announcement_comment', 10, 60) THEN RAISE EXCEPTION 'You are commenting too fast. Please slow down.'; END IF;
  IF EXISTS (SELECT 1 FROM announcement_comments ac WHERE ac.user_id = _user_id AND ac.message_id = _message_id AND ac.content = normalized_content AND ac.created_at > now() - interval '30 seconds') THEN RAISE EXCEPTION 'Duplicate comment blocked'; END IF;
  IF NOT EXISTS (SELECT 1 FROM users u WHERE u.id = _user_id AND u.created_at <= (now() - interval '5 minutes')) THEN RAISE EXCEPTION 'Commenting is temporarily restricted for new accounts'; END IF;
  SELECT channel_id INTO msg_channel_id FROM messages WHERE id = _message_id;
  IF msg_channel_id IS NULL THEN RAISE EXCEPTION 'Message not found'; END IF;
  IF NOT check_user_permission(_user_id, msg_channel_id, 'send_messages') THEN RAISE EXCEPTION 'Permission denied: you do not have permission to comment'; END IF;
  INSERT INTO announcement_comments (message_id, user_id, content, reply_to_id) VALUES (_message_id, _user_id, normalized_content, _reply_to_id) RETURNING * INTO new_comment;
  RETURN row_to_json(new_comment);
END;
$$;

-- FIX 6: Harden insert_media_comment
DROP FUNCTION IF EXISTS public.insert_media_comment(uuid, uuid, text, uuid);
CREATE FUNCTION public.insert_media_comment(
  _media_id uuid, _user_id uuid, _content text, _reply_to_id uuid DEFAULT NULL
) RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  media_channel_id uuid; new_comment media_comments%ROWTYPE; normalized_content text;
BEGIN
  IF NOT verify_request_identity(_user_id) THEN RAISE EXCEPTION 'Unauthorized: identity mismatch'; END IF;
  normalized_content := trim(_content);
  IF normalized_content IS NULL OR length(normalized_content) = 0 THEN RAISE EXCEPTION 'Comment content cannot be empty'; END IF;
  IF length(normalized_content) > 2000 THEN RAISE EXCEPTION 'Comment content cannot exceed 2000 characters'; END IF;
  IF NOT message_content_allowed(normalized_content) THEN RAISE EXCEPTION 'Comment contains blocked content'; END IF;
  IF NOT check_rate_limit(_user_id::text, 'insert_media_comment', 10, 60) THEN RAISE EXCEPTION 'You are commenting too fast. Please slow down.'; END IF;
  IF EXISTS (SELECT 1 FROM media_comments mc WHERE mc.user_id = _user_id AND mc.media_id = _media_id AND mc.content = normalized_content AND mc.created_at > now() - interval '30 seconds') THEN RAISE EXCEPTION 'Duplicate comment blocked'; END IF;
  IF NOT EXISTS (SELECT 1 FROM users u WHERE u.id = _user_id AND u.created_at <= (now() - interval '5 minutes')) THEN RAISE EXCEPTION 'Commenting is temporarily restricted for new accounts'; END IF;
  SELECT channel_id INTO media_channel_id FROM media_items WHERE id = _media_id;
  IF media_channel_id IS NULL THEN RAISE EXCEPTION 'Media item not found'; END IF;
  IF NOT check_user_permission(_user_id, media_channel_id, 'send_messages') THEN RAISE EXCEPTION 'Permission denied: you do not have permission to comment'; END IF;
  INSERT INTO media_comments (media_id, user_id, content, reply_to_id) VALUES (_media_id, _user_id, normalized_content, _reply_to_id) RETURNING * INTO new_comment;
  RETURN row_to_json(new_comment);
END;
$$;

-- FIX 7: Harden insert_media_item (parameter order matches existing)
CREATE OR REPLACE FUNCTION public.insert_media_item(
  _channel_id uuid, _user_id uuid,
  _title text DEFAULT NULL, _description text DEFAULT NULL,
  _media_url text DEFAULT '', _media_type text DEFAULT 'image',
  _thumbnail_url text DEFAULT NULL, _youtube_video_id text DEFAULT NULL,
  _width integer DEFAULT NULL, _height integer DEFAULT NULL, _file_size integer DEFAULT NULL
) RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_item media_items%ROWTYPE;
BEGIN
  IF NOT verify_request_identity(_user_id) THEN RAISE EXCEPTION 'Unauthorized: identity mismatch'; END IF;
  IF NOT check_rate_limit(_user_id::text, 'insert_media_item', 10, 60) THEN RAISE EXCEPTION 'You are uploading media too fast. Please slow down.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM users u WHERE u.id = _user_id AND u.created_at <= (now() - interval '5 minutes')) THEN RAISE EXCEPTION 'Media uploads are temporarily restricted for new accounts'; END IF;
  IF _media_url IS NULL OR length(trim(_media_url)) = 0 THEN RAISE EXCEPTION 'Media URL is required'; END IF;
  IF length(_media_url) > 2048 THEN RAISE EXCEPTION 'Media URL is too long'; END IF;
  IF _title IS NOT NULL AND length(_title) > 200 THEN RAISE EXCEPTION 'Title cannot exceed 200 characters'; END IF;
  IF _description IS NOT NULL AND length(_description) > 2000 THEN RAISE EXCEPTION 'Description cannot exceed 2000 characters'; END IF;
  IF NOT check_user_permission(_user_id, _channel_id, 'send_messages') THEN RAISE EXCEPTION 'Permission denied'; END IF;
  IF NOT check_user_permission(_user_id, _channel_id, 'attach_files') THEN RAISE EXCEPTION 'Permission denied: attach_files'; END IF;
  INSERT INTO media_items (channel_id, user_id, title, description, media_url, media_type, thumbnail_url, youtube_video_id, width, height, file_size)
  VALUES (_channel_id, _user_id, _title, _description, _media_url, _media_type, _thumbnail_url, _youtube_video_id, _width, _height, _file_size)
  RETURNING * INTO new_item;
  RETURN row_to_json(new_item);
END;
$$;
