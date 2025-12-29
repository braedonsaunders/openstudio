-- Fix avatar component URLs that have expired presigned signatures
-- This migration extracts R2 keys from presigned URLs and stores them as plain keys
-- The application will generate fresh signed URLs when fetching components

-- Update image_url to just the R2 key (remove presigned URL params)
UPDATE avatar_components
SET
  image_url = CASE
    -- If it contains X-Amz-Signature, it's a presigned URL - extract the path
    WHEN image_url LIKE '%X-Amz-Signature%' THEN
      -- Extract everything before the '?' query string and after the bucket domain
      REGEXP_REPLACE(
        SPLIT_PART(image_url, '?', 1),
        '^https?://[^/]+/',
        ''
      )
    ELSE image_url
  END,
  thumbnail_url = CASE
    WHEN thumbnail_url LIKE '%X-Amz-Signature%' THEN
      REGEXP_REPLACE(
        SPLIT_PART(thumbnail_url, '?', 1),
        '^https?://[^/]+/',
        ''
      )
    ELSE thumbnail_url
  END,
  -- Also ensure r2_key is set correctly from the image_url
  r2_key = CASE
    WHEN image_url LIKE '%X-Amz-Signature%' THEN
      REGEXP_REPLACE(
        SPLIT_PART(image_url, '?', 1),
        '^https?://[^/]+/',
        ''
      )
    WHEN r2_key IS NULL OR r2_key = '' THEN
      -- If r2_key not set, try to extract from image_url
      CASE
        WHEN image_url LIKE 'avatars/%' THEN image_url
        ELSE REGEXP_REPLACE(
          SPLIT_PART(image_url, '?', 1),
          '^https?://[^/]+/',
          ''
        )
      END
    ELSE r2_key
  END,
  updated_at = NOW()
WHERE
  image_url LIKE '%X-Amz-Signature%'
  OR thumbnail_url LIKE '%X-Amz-Signature%'
  OR (r2_key IS NULL AND image_url IS NOT NULL);

-- Verify the fix - this should show components with clean R2 keys
-- SELECT id, name, image_url, thumbnail_url, r2_key FROM avatar_components LIMIT 5;
