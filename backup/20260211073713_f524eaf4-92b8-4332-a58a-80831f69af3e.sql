
-- Fix reorder_channels to normalize positions before shifting
-- This ensures channels with duplicate positions (e.g., all 0) are properly handled
CREATE OR REPLACE FUNCTION public.reorder_channels(
  _server_id UUID,
  _user_id UUID,
  _channel_id UUID,
  _new_category_id UUID,
  _new_position INTEGER
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _old_category_id UUID;
  _old_position INTEGER;
  _rec RECORD;
  _pos INTEGER;
BEGIN
  -- Verify user is admin/owner
  IF NOT EXISTS (
    SELECT 1 FROM server_members
    WHERE server_id = _server_id AND user_id = _user_id
      AND role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  -- Get current channel info
  SELECT category_id, position INTO _old_category_id, _old_position
  FROM channels
  WHERE id = _channel_id AND server_id = _server_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Channel not found';
  END IF;

  -- Normalize positions in the old category (fix duplicate positions like all-zeros)
  _pos := 0;
  FOR _rec IN
    SELECT id FROM channels
    WHERE server_id = _server_id
      AND category_id IS NOT DISTINCT FROM _old_category_id
    ORDER BY position, created_at
  LOOP
    UPDATE channels SET position = _pos WHERE id = _rec.id;
    _pos := _pos + 1;
  END LOOP;

  -- If moving to a different category, also normalize the target category
  IF NOT (_old_category_id IS NOT DISTINCT FROM _new_category_id) THEN
    _pos := 0;
    FOR _rec IN
      SELECT id FROM channels
      WHERE server_id = _server_id
        AND category_id IS NOT DISTINCT FROM _new_category_id
      ORDER BY position, created_at
    LOOP
      UPDATE channels SET position = _pos WHERE id = _rec.id;
      _pos := _pos + 1;
    END LOOP;
  END IF;

  -- Re-read the channel's position after normalization
  SELECT position INTO _old_position
  FROM channels
  WHERE id = _channel_id AND server_id = _server_id;

  -- If moving within the same category
  IF (_old_category_id IS NOT DISTINCT FROM _new_category_id) THEN
    IF _new_position > _old_position THEN
      UPDATE channels
      SET position = position - 1
      WHERE server_id = _server_id
        AND category_id IS NOT DISTINCT FROM _new_category_id
        AND position > _old_position AND position <= _new_position
        AND id != _channel_id;
    ELSIF _new_position < _old_position THEN
      UPDATE channels
      SET position = position + 1
      WHERE server_id = _server_id
        AND category_id IS NOT DISTINCT FROM _new_category_id
        AND position >= _new_position AND position < _old_position
        AND id != _channel_id;
    END IF;
  ELSE
    -- Moving to different category: close gap in old category
    UPDATE channels
    SET position = position - 1
    WHERE server_id = _server_id
      AND category_id IS NOT DISTINCT FROM _old_category_id
      AND position > _old_position;

    -- Make room in new category
    UPDATE channels
    SET position = position + 1
    WHERE server_id = _server_id
      AND category_id IS NOT DISTINCT FROM _new_category_id
      AND position >= _new_position;
  END IF;

  -- Set the channel's new category and position
  UPDATE channels
  SET category_id = _new_category_id, position = _new_position
  WHERE id = _channel_id AND server_id = _server_id;
END;
$$;
