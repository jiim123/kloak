
-- =====================================================================
-- PHASE 5: Media, Announcements, Comments RPCs
-- PHASE 6: Server Emoji RPCs
-- =====================================================================

-- =============================================
-- insert_media_item: check send_messages + attach_files
-- =============================================
CREATE OR REPLACE FUNCTION public.insert_media_item(
  _channel_id uuid,
  _user_id uuid,
  _title text DEFAULT NULL,
  _description text DEFAULT NULL,
  _media_url text DEFAULT '',
  _media_type text DEFAULT 'image',
  _thumbnail_url text DEFAULT NULL,
  _youtube_video_id text DEFAULT NULL,
  _width int DEFAULT NULL,
  _height int DEFAULT NULL,
  _file_size int DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_item media_items%ROWTYPE;
BEGIN
  IF NOT check_user_permission(_user_id, _channel_id, 'send_messages') THEN
    RAISE EXCEPTION 'Permission denied: you do not have permission to send messages in this channel';
  END IF;
  IF NOT check_user_permission(_user_id, _channel_id, 'attach_files') THEN
    RAISE EXCEPTION 'Permission denied: you do not have permission to attach files in this channel';
  END IF;
  INSERT INTO media_items (channel_id, user_id, title, description, media_url, media_type, thumbnail_url, youtube_video_id, width, height, file_size)
  VALUES (_channel_id, _user_id, _title, _description, _media_url, _media_type, _thumbnail_url, _youtube_video_id, _width, _height, _file_size)
  RETURNING * INTO new_item;
  RETURN row_to_json(new_item);
END;
$$;

-- =============================================
-- delete_media_item: check ownership or manage_messages
-- =============================================
CREATE OR REPLACE FUNCTION public.delete_media_item(
  _item_id uuid,
  _user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item_channel_id uuid;
  item_owner_id uuid;
BEGIN
  SELECT channel_id, user_id INTO item_channel_id, item_owner_id FROM media_items WHERE id = _item_id;
  IF item_channel_id IS NULL THEN
    RAISE EXCEPTION 'Media item not found';
  END IF;
  IF item_owner_id != _user_id THEN
    IF NOT check_user_permission(_user_id, item_channel_id, 'manage_messages') THEN
      RAISE EXCEPTION 'Permission denied: you can only delete your own media or need manage_messages permission';
    END IF;
  END IF;
  DELETE FROM media_items WHERE id = _item_id;
  RETURN true;
END;
$$;

-- =============================================
-- insert_media_comment: check send_messages on channel
-- =============================================
CREATE OR REPLACE FUNCTION public.insert_media_comment(
  _media_id uuid,
  _user_id uuid,
  _content text,
  _reply_to_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  media_channel_id uuid;
  new_comment media_comments%ROWTYPE;
BEGIN
  SELECT channel_id INTO media_channel_id FROM media_items WHERE id = _media_id;
  IF media_channel_id IS NULL THEN
    RAISE EXCEPTION 'Media item not found';
  END IF;
  IF NOT check_user_permission(_user_id, media_channel_id, 'send_messages') THEN
    RAISE EXCEPTION 'Permission denied: you do not have permission to comment';
  END IF;
  INSERT INTO media_comments (media_id, user_id, content, reply_to_id)
  VALUES (_media_id, _user_id, _content, _reply_to_id)
  RETURNING * INTO new_comment;
  RETURN row_to_json(new_comment);
END;
$$;

-- =============================================
-- edit_media_comment: verify ownership
-- =============================================
CREATE OR REPLACE FUNCTION public.edit_media_comment(
  _comment_id uuid,
  _user_id uuid,
  _content text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  comment_owner_id uuid;
BEGIN
  SELECT user_id INTO comment_owner_id FROM media_comments WHERE id = _comment_id;
  IF comment_owner_id IS NULL THEN
    RAISE EXCEPTION 'Comment not found';
  END IF;
  IF comment_owner_id != _user_id THEN
    RAISE EXCEPTION 'Permission denied: you can only edit your own comments';
  END IF;
  UPDATE media_comments SET content = _content, edited_at = now() WHERE id = _comment_id;
  RETURN true;
END;
$$;

-- =============================================
-- delete_media_comment: ownership or manage_messages
-- =============================================
CREATE OR REPLACE FUNCTION public.delete_media_comment(
  _comment_id uuid,
  _user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  comment_owner_id uuid;
  media_channel_id uuid;
BEGIN
  SELECT mc.user_id, mi.channel_id INTO comment_owner_id, media_channel_id
  FROM media_comments mc
  JOIN media_items mi ON mi.id = mc.media_id
  WHERE mc.id = _comment_id;
  IF comment_owner_id IS NULL THEN
    RAISE EXCEPTION 'Comment not found';
  END IF;
  IF comment_owner_id != _user_id THEN
    IF NOT check_user_permission(_user_id, media_channel_id, 'manage_messages') THEN
      RAISE EXCEPTION 'Permission denied: you can only delete your own comments';
    END IF;
  END IF;
  DELETE FROM media_comments WHERE id = _comment_id;
  RETURN true;
END;
$$;

-- =============================================
-- toggle_media_comment_reaction
-- =============================================
CREATE OR REPLACE FUNCTION public.toggle_media_comment_reaction(
  _comment_id uuid,
  _user_id uuid,
  _emoji text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  media_channel_id uuid;
  existing_id uuid;
BEGIN
  SELECT mi.channel_id INTO media_channel_id
  FROM media_comments mc
  JOIN media_items mi ON mi.id = mc.media_id
  WHERE mc.id = _comment_id;
  IF media_channel_id IS NULL THEN
    RAISE EXCEPTION 'Comment not found';
  END IF;
  IF NOT check_user_permission(_user_id, media_channel_id, 'add_reactions') THEN
    RAISE EXCEPTION 'Permission denied: you do not have permission to add reactions';
  END IF;
  SELECT id INTO existing_id FROM media_comment_reactions 
  WHERE comment_id = _comment_id AND user_id = _user_id AND emoji = _emoji;
  IF existing_id IS NOT NULL THEN
    DELETE FROM media_comment_reactions WHERE id = existing_id;
  ELSE
    INSERT INTO media_comment_reactions (comment_id, user_id, emoji) VALUES (_comment_id, _user_id, _emoji);
  END IF;
  RETURN true;
END;
$$;

-- =============================================
-- insert_announcement_comment
-- =============================================
CREATE OR REPLACE FUNCTION public.insert_announcement_comment(
  _message_id uuid,
  _user_id uuid,
  _content text,
  _reply_to_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  msg_channel_id uuid;
  new_comment announcement_comments%ROWTYPE;
BEGIN
  SELECT channel_id INTO msg_channel_id FROM messages WHERE id = _message_id;
  IF msg_channel_id IS NULL THEN
    RAISE EXCEPTION 'Message not found';
  END IF;
  IF NOT check_user_permission(_user_id, msg_channel_id, 'send_messages') THEN
    RAISE EXCEPTION 'Permission denied: you do not have permission to comment';
  END IF;
  INSERT INTO announcement_comments (message_id, user_id, content, reply_to_id)
  VALUES (_message_id, _user_id, _content, _reply_to_id)
  RETURNING * INTO new_comment;
  RETURN row_to_json(new_comment);
END;
$$;

-- =============================================
-- edit_announcement_comment
-- =============================================
CREATE OR REPLACE FUNCTION public.edit_announcement_comment(
  _comment_id uuid,
  _user_id uuid,
  _content text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  comment_owner_id uuid;
BEGIN
  SELECT user_id INTO comment_owner_id FROM announcement_comments WHERE id = _comment_id;
  IF comment_owner_id IS NULL THEN
    RAISE EXCEPTION 'Comment not found';
  END IF;
  IF comment_owner_id != _user_id THEN
    RAISE EXCEPTION 'Permission denied: you can only edit your own comments';
  END IF;
  UPDATE announcement_comments SET content = _content, edited_at = now() WHERE id = _comment_id;
  RETURN true;
END;
$$;

-- =============================================
-- delete_announcement_comment
-- =============================================
CREATE OR REPLACE FUNCTION public.delete_announcement_comment(
  _comment_id uuid,
  _user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  comment_owner_id uuid;
  msg_channel_id uuid;
BEGIN
  SELECT ac.user_id, m.channel_id INTO comment_owner_id, msg_channel_id
  FROM announcement_comments ac
  JOIN messages m ON m.id = ac.message_id
  WHERE ac.id = _comment_id;
  IF comment_owner_id IS NULL THEN
    RAISE EXCEPTION 'Comment not found';
  END IF;
  IF comment_owner_id != _user_id THEN
    IF NOT check_user_permission(_user_id, msg_channel_id, 'manage_messages') THEN
      RAISE EXCEPTION 'Permission denied: you can only delete your own comments';
    END IF;
  END IF;
  DELETE FROM announcement_comments WHERE id = _comment_id;
  RETURN true;
END;
$$;

-- =============================================
-- toggle_announcement_comment_reaction
-- =============================================
CREATE OR REPLACE FUNCTION public.toggle_announcement_comment_reaction(
  _comment_id uuid,
  _user_id uuid,
  _emoji text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  msg_channel_id uuid;
  existing_id uuid;
BEGIN
  SELECT m.channel_id INTO msg_channel_id
  FROM announcement_comments ac
  JOIN messages m ON m.id = ac.message_id
  WHERE ac.id = _comment_id;
  IF msg_channel_id IS NULL THEN
    RAISE EXCEPTION 'Comment not found';
  END IF;
  IF NOT check_user_permission(_user_id, msg_channel_id, 'add_reactions') THEN
    RAISE EXCEPTION 'Permission denied: you do not have permission to add reactions';
  END IF;
  SELECT id INTO existing_id FROM announcement_comment_reactions 
  WHERE comment_id = _comment_id AND user_id = _user_id AND emoji = _emoji;
  IF existing_id IS NOT NULL THEN
    DELETE FROM announcement_comment_reactions WHERE id = existing_id;
  ELSE
    INSERT INTO announcement_comment_reactions (comment_id, user_id, emoji) VALUES (_comment_id, _user_id, _emoji);
  END IF;
  RETURN true;
END;
$$;

-- =============================================
-- PHASE 6: upload_server_emoji
-- =============================================
CREATE OR REPLACE FUNCTION public.upload_server_emoji(
  _server_id uuid,
  _user_id uuid,
  _name text,
  _file_path text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_emoji server_emojis%ROWTYPE;
BEGIN
  IF NOT check_user_server_permission(_user_id, _server_id, 'manage_emojis') THEN
    RAISE EXCEPTION 'Permission denied: you do not have permission to manage emojis';
  END IF;
  INSERT INTO server_emojis (server_id, name, file_path, created_by)
  VALUES (_server_id, _name, _file_path, _user_id)
  RETURNING * INTO new_emoji;
  RETURN row_to_json(new_emoji);
END;
$$;

-- =============================================
-- delete_server_emoji
-- =============================================
CREATE OR REPLACE FUNCTION public.delete_server_emoji(
  _emoji_id uuid,
  _user_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  emoji_server_id uuid;
  emoji_file_path text;
BEGIN
  SELECT server_id, file_path INTO emoji_server_id, emoji_file_path FROM server_emojis WHERE id = _emoji_id;
  IF emoji_server_id IS NULL THEN
    RAISE EXCEPTION 'Emoji not found';
  END IF;
  IF NOT check_user_server_permission(_user_id, emoji_server_id, 'manage_emojis') THEN
    RAISE EXCEPTION 'Permission denied: you do not have permission to manage emojis';
  END IF;
  DELETE FROM server_emojis WHERE id = _emoji_id;
  RETURN emoji_file_path;
END;
$$;
