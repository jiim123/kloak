-- Enforce server-side media URL allowlist for direct RPC inserts.
-- Allow only:
-- 1) YouTube links for videos (media_type = youtube)
-- 2) Direct image links with extension: jpg, jpeg, png, gif, webp (media_type = image/gif)
-- 3) Video URLs only when they are from this project's attachments bucket

CREATE OR REPLACE FUNCTION public.insert_media_item(
  _channel_id uuid,
  _user_id uuid,
  _title text DEFAULT NULL,
  _description text DEFAULT NULL,
  _media_url text DEFAULT '',
  _media_type text DEFAULT 'image',
  _thumbnail_url text DEFAULT NULL,
  _youtube_video_id text DEFAULT NULL,
  _width integer DEFAULT NULL,
  _height integer DEFAULT NULL,
  _file_size integer DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_item media_items%ROWTYPE;
  _headers json;
  _request_host text;
  _allowed_upload_prefix text;
  _is_project_attachment_url boolean := false;
  _normalized_media_url text;
  _normalized_media_type text;
  _url_path text;
  _url_extension text;
  _youtube_id text;
BEGIN
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF NOT check_rate_limit(_user_id::text, 'insert_media_item', 10, 60) THEN
    RAISE EXCEPTION 'You are uploading media too fast. Please slow down.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM users u
    WHERE u.id = _user_id
      AND u.created_at <= (now() - interval '5 minutes')
  ) THEN
    RAISE EXCEPTION 'Media uploads are temporarily restricted for new accounts';
  END IF;

  _normalized_media_url := NULLIF(trim(_media_url), '');
  IF _normalized_media_url IS NULL THEN
    RAISE EXCEPTION 'Media URL is required';
  END IF;

  IF length(_normalized_media_url) > 2048 THEN
    RAISE EXCEPTION 'Media URL is too long';
  END IF;

  IF _normalized_media_url !~* '^https?://[^[:space:]]+$' THEN
    RAISE EXCEPTION 'Media URL must be a valid http(s) URL';
  END IF;

  IF _normalized_media_url !~ '^[ -~]+$' THEN
    RAISE EXCEPTION 'Media URL must use ASCII characters only';
  END IF;

  _normalized_media_type := lower(COALESCE(NULLIF(trim(_media_type), ''), 'image'));

  BEGIN
    _headers := current_setting('request.headers', true)::json;
  EXCEPTION WHEN OTHERS THEN
    _headers := '{}'::json;
  END;

  _request_host := lower(
    split_part(
      COALESCE(NULLIF(trim(_headers->>'x-forwarded-host'), ''), NULLIF(trim(_headers->>'host'), '')),
      ':',
      1
    )
  );

  IF _request_host IS NOT NULL AND _request_host <> '' THEN
    _allowed_upload_prefix := 'https://' || _request_host || '/storage/v1/object/public/attachments/';
    _is_project_attachment_url := strpos(lower(_normalized_media_url), lower(_allowed_upload_prefix)) = 1;
  END IF;

  IF _title IS NOT NULL AND length(_title) > 200 THEN
    RAISE EXCEPTION 'Title cannot exceed 200 characters';
  END IF;

  IF _description IS NOT NULL AND length(_description) > 2000 THEN
    RAISE EXCEPTION 'Description cannot exceed 2000 characters';
  END IF;

  IF NOT check_user_permission(_user_id, _channel_id, 'send_messages') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  IF NOT check_user_permission(_user_id, _channel_id, 'attach_files') THEN
    RAISE EXCEPTION 'Permission denied: attach_files';
  END IF;

  _url_path := regexp_replace(_normalized_media_url, '^https?://[^/]+', '', 'i');
  _url_path := split_part(split_part(_url_path, '?', 1), '#', 1);

  IF _url_path IS NULL OR _url_path = '' THEN
    _url_path := '/';
  END IF;

  -- Block dangerous/double-extension payloads like file.php.jpg.
  IF EXISTS (
    SELECT 1
    FROM regexp_split_to_table(lower(_url_path), '[./]+') AS seg
    WHERE seg IN (
      'php','php3','php4','php5','php7','phtml','phar',
      'asp','aspx','ascx','ashx','asmx','jsp','jspx','jsw','jsv','jspf',
      'cfm','cfml','cfc','pl','pm','cgi','rb','py','pyc','pyo',
      'sh','bash','zsh','fish','ksh','csh','bat','cmd','ps1','psm1','psd1','vbs','vbe','wsf','wsh',
      'ini','env','cfg','conf','config','htaccess','htpasswd',
      'exe','dll','so','dylib','bin','elf','com','scr','pif',
      'zip','tar','gz','tgz','bz2','rar','7z','xz',
      'svg','xml','html','htm','xhtml','js','mjs','ts','jar','war','ear','swf'
    )
  ) THEN
    RAISE EXCEPTION 'Unsupported media URL format';
  END IF;

  IF _normalized_media_type = 'youtube' THEN
    _youtube_id := substring(
      _normalized_media_url
      FROM '(?i)(?:youtube\.com/watch\?v=|youtu\.be/|youtube\.com/embed/|youtube\.com/shorts/)([A-Za-z0-9_-]{11})'
    );

    IF _youtube_id IS NULL THEN
      RAISE EXCEPTION 'Only YouTube links are accepted for video media';
    END IF;

    IF _youtube_video_id IS NOT NULL
       AND trim(_youtube_video_id) <> ''
       AND trim(_youtube_video_id) <> _youtube_id THEN
      RAISE EXCEPTION 'youtube_video_id does not match URL';
    END IF;

    _youtube_video_id := _youtube_id;
    _thumbnail_url := 'https://img.youtube.com/vi/' || _youtube_id || '/maxresdefault.jpg';

  ELSIF _normalized_media_type = 'video' THEN
    _url_extension := substring(lower(_url_path) FROM '\.([a-z0-9]{1,16})$');

    IF NOT _is_project_attachment_url THEN
      RAISE EXCEPTION 'Direct video URLs are not allowed. Use a YouTube link or upload to attachments.';
    END IF;

    IF _url_extension IS NULL OR _url_extension NOT IN ('mp4', 'webm', 'mov', 'avi') THEN
      RAISE EXCEPTION 'Uploaded videos must use mp4, webm, mov, or avi extensions';
    END IF;

    IF _youtube_video_id IS NOT NULL AND trim(_youtube_video_id) <> '' THEN
      RAISE EXCEPTION 'youtube_video_id is only allowed for YouTube media';
    END IF;

    _thumbnail_url := NULL;
    _youtube_video_id := NULL;

  ELSIF _normalized_media_type IN ('image', 'gif') THEN
    _url_extension := substring(lower(_url_path) FROM '\.([a-z0-9]{1,16})$');

    IF _url_extension IS NULL OR _url_extension NOT IN ('jpg', 'jpeg', 'png', 'gif', 'webp') THEN
      RAISE EXCEPTION 'Only direct image URLs (jpg, jpeg, png, gif, webp) are accepted';
    END IF;

    IF _youtube_video_id IS NOT NULL AND trim(_youtube_video_id) <> '' THEN
      RAISE EXCEPTION 'youtube_video_id is only allowed for YouTube media';
    END IF;

    IF _url_extension = 'gif' THEN
      _normalized_media_type := 'gif';
    ELSE
      _normalized_media_type := 'image';
    END IF;

    _thumbnail_url := NULL;
    _youtube_video_id := NULL;

  ELSE
    RAISE EXCEPTION 'Only YouTube video links and direct image URLs are allowed';
  END IF;

  INSERT INTO media_items (
    channel_id,
    user_id,
    title,
    description,
    media_url,
    media_type,
    thumbnail_url,
    youtube_video_id,
    width,
    height,
    file_size
  )
  VALUES (
    _channel_id,
    _user_id,
    _title,
    _description,
    _normalized_media_url,
    _normalized_media_type,
    _thumbnail_url,
    _youtube_video_id,
    _width,
    _height,
    _file_size
  )
  RETURNING * INTO new_item;

  RETURN row_to_json(new_item);
END;
$$;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
  PERFORM pg_notify('pgrst', 'reload config');
END $$;
