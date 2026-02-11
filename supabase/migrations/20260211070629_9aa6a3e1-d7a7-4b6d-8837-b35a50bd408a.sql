
-- Reorder categories: update position for each category in the given order
CREATE OR REPLACE FUNCTION public.reorder_categories(
  _server_id UUID,
  _user_id UUID,
  _category_ids UUID[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  i INTEGER;
BEGIN
  -- Verify user is admin/owner of the server
  IF NOT EXISTS (
    SELECT 1 FROM server_members
    WHERE server_id = _server_id AND user_id = _user_id
      AND role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  -- Update positions
  FOR i IN 1..array_length(_category_ids, 1) LOOP
    UPDATE channel_categories
    SET position = i - 1
    WHERE id = _category_ids[i] AND server_id = _server_id;
  END LOOP;
END;
$$;

-- Reorder channels: move a channel to a new category and/or position
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

  -- If moving within the same category
  IF (_old_category_id IS NOT DISTINCT FROM _new_category_id) THEN
    -- Shift positions in the same category
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
