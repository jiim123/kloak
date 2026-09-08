-- Display Name Style: switch fonts from unicode character transforms to real
-- web fonts (Google Fonts) applied via CSS font-family.
--
-- 1. Remap saved unicode fonts to the closest real-font equivalents.
-- 2. Update name_style_is_valid with the new font id whitelist (legacy ids kept
--    valid so styles saved by older clients still pass validation).

-- 1. Remap legacy unicode font ids -------------------------------------------

UPDATE public.users
SET name_style = jsonb_set(name_style, '{font}', to_jsonb(
  CASE name_style->>'font'
    WHEN 'doubleStruck' THEN 'display'   -- outlined -> tall display face
    WHEN 'sans'         THEN 'rounded'   -- math sans -> rounded sans
    WHEN 'sansBold'     THEN 'bold'      -- bold sans -> CSS bold
    WHEN 'fullwidth'    THEN 'wide'      -- ｗｉｄｅ -> letter-spaced wide
    ELSE name_style->>'font'
  END
))
WHERE name_style IS NOT NULL
  AND name_style ? 'font'
  AND name_style->>'font' IN ('doubleStruck', 'sans', 'sansBold', 'fullwidth');

-- 2. Validator with the real-font whitelist ------------------------------------

CREATE OR REPLACE FUNCTION public.name_style_is_valid(_style jsonb)
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
  _key text;
  _value jsonb;
BEGIN
  IF _style IS NULL THEN
    RETURN true;
  END IF;
  IF jsonb_typeof(_style) <> 'object' THEN
    RETURN false;
  END IF;
  IF _style = '{}'::jsonb THEN
    RETURN true;
  END IF;

  FOR _key, _value IN SELECT * FROM jsonb_each(_style)
  LOOP
    IF _key NOT IN ('font', 'effect', 'color') THEN
      RETURN false;
    END IF;
    IF jsonb_typeof(_value) <> 'string' THEN
      RETURN false;
    END IF;

    IF _key = 'font' AND (_value #>> '{}') NOT IN (
      -- Current real-font ids (see src/lib/nameStyle.ts)
      'default', 'script', 'boldScript', 'elegant', 'fantasy', 'fraktur',
      'display', 'pixel', 'calligraphy', 'rounded', 'futuristic', 'mono',
      'bold', 'italic', 'wide', 'smallCaps',
      -- Legacy unicode-transform ids, still accepted for older clients
      'doubleStruck', 'sans', 'sansBold', 'fullwidth'
    ) THEN
      RETURN false;
    END IF;

    IF _key = 'effect' AND (_value #>> '{}') NOT IN (
      'solid', 'gradient', 'neon', 'toon', 'pop', 'gummy', 'prism'
    ) THEN
      RETURN false;
    END IF;

    IF _key = 'color' AND (_value #>> '{}') !~ '^#[0-9A-Fa-f]{6}$' THEN
      RETURN false;
    END IF;
  END LOOP;

  RETURN true;
END;
$function$;
