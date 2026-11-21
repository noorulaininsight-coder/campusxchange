begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('listing-images','listing-images',false,358400,array['image/webp']),('avatars','avatars',false,358400,array['image/webp']) on conflict(id) do nothing;
create function private.can_write_image(path text) returns boolean language sql stable security definer set search_path='' as $$ select private.member_active(auth.uid()) and exists(select 1 from public.listings where user_id=auth.uid() and status='ACTIVE' and path ~ ('^'||user_id::text||'/'||id::text||'/[123]\.webp$')); $$;
create function private.can_read_image(path text) returns boolean language sql stable security definer set search_path='' as $$ select private.is_admin() or exists(select 1 from public.listings l where (path=any(l.image_paths)) and ((l.status='ACTIVE' and private.member_active(l.user_id)) or l.user_id=auth.uid())); $$;
create function private.can_write_avatar(path text) returns boolean language sql stable security definer set search_path='' as $$ select auth.uid() is not null and path=auth.uid()::text||'/avatar.webp' and (private.member_active(auth.uid()) or (not exists(select 1 from public.user_accounts where user_id=auth.uid()) and exists(select 1 from auth.users u join public.allowed_email_domains d on d.domain=lower(split_part(u.email,'@',2)) join public.campuses c on c.id=d.campus_id join public.universities v on v.id=c.university_id where u.id=auth.uid() and u.email_confirmed_at is not null and d.is_active and c.is_active and v.is_active))); $$;
revoke all on function private.can_write_image(text),private.can_read_image(text),private.can_write_avatar(text) from public;
grant execute on function private.can_read_image(text) to anon,authenticated;
grant execute on function private.can_write_image(text),private.can_write_avatar(text) to authenticated;
create policy listing_images_read on storage.objects for select to anon,authenticated using(bucket_id='listing-images' and private.can_read_image(name));
create policy listing_images_insert on storage.objects for insert to authenticated with check(bucket_id='listing-images' and private.can_write_image(name));
create policy listing_images_update on storage.objects for update to authenticated using(bucket_id='listing-images' and private.can_write_image(name)) with check(bucket_id='listing-images' and private.can_write_image(name));
create policy listing_images_delete on storage.objects for delete to authenticated using(bucket_id='listing-images' and private.can_write_image(name));
create policy avatars_read on storage.objects for select to anon,authenticated using(bucket_id='avatars' and (name=auth.uid()::text||'/avatar.webp' or private.is_admin() or exists(select 1 from public.profiles where avatar_path=name and private.member_active(id))));
create policy avatars_insert on storage.objects for insert to authenticated with check(bucket_id='avatars' and private.can_write_avatar(name));
create policy avatars_update on storage.objects for update to authenticated using(bucket_id='avatars' and private.can_write_avatar(name)) with check(bucket_id='avatars' and private.can_write_avatar(name));
create policy avatars_delete on storage.objects for delete to authenticated using(bucket_id='avatars' and private.can_write_avatar(name));
-- The only permitted object names are slots 1, 2 and 3: at most 3 files per listing.
-- Uploads to unreferenced slots are not publicly readable; the cleanup job removes stale slots.
commit;
