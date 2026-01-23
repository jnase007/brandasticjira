-- Backfill missing slugs so client URLs can be human-friendly
-- Uses "<slugified-name>-<id-prefix>" to avoid collisions.
update clients
set slug = regexp_replace(lower(coalesce(name, 'client')), '[^a-z0-9]+', '-', 'g')
  || '-' || left(id::text, 8)
where slug is null or slug = '';

