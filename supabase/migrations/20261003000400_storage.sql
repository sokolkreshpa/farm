-- =============================================================================
-- Storage: product images and farm logos (D-41).
-- Objects live at "{tenant_id}/{uuid}.{ext}". Public read; only members of the
-- tenant can write inside their tenant's folder.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5 * 1024 * 1024,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- First path segment as uuid, or null if it is not a uuid.
create function private.storage_tenant_id(p_name text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_folder text := (storage.foldername(p_name))[1];
begin
  return v_folder::uuid;
exception when invalid_text_representation then
  return null;
end;
$$;

grant execute on function private.storage_tenant_id(text) to anon, authenticated, service_role;

create policy product_images_insert_member on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'product-images'
    and private.is_tenant_member(private.storage_tenant_id(name))
  );

create policy product_images_update_member on storage.objects
  for update to authenticated
  using (
    bucket_id = 'product-images'
    and private.is_tenant_member(private.storage_tenant_id(name))
  )
  with check (
    bucket_id = 'product-images'
    and private.is_tenant_member(private.storage_tenant_id(name))
  );

create policy product_images_delete_member on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'product-images'
    and private.is_tenant_member(private.storage_tenant_id(name))
  );
