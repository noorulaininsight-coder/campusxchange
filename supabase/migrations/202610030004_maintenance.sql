begin;
-- The owner must be able to replace a staged slot before attaching it to the listing.
create or replace function private.can_read_image(path text) returns boolean language sql stable security definer set search_path='' as $$ select private.is_admin() or exists(select 1 from public.listings l where (path ~ ('^'||l.user_id::text||'/'||l.id::text||'/[123]\.webp$') and l.user_id=auth.uid() and private.member_active(auth.uid())) or (path=any(l.image_paths) and l.status='ACTIVE' and private.member_active(l.user_id))); $$;
create function public.cleanup_candidates() returns table(bucket_id text,name text) language sql stable security definer set search_path='' as $$
 select o.bucket_id,o.name from storage.objects o where
 (o.bucket_id='listing-images' and ((o.updated_at<now()-interval '1 day' and not exists(select 1 from public.listings l where o.name=any(l.image_paths))) or exists(select 1 from public.listings l where o.name=any(l.image_paths) and l.status<>'ACTIVE' and l.archived_at<now()-interval '90 days')))
 or (o.bucket_id='avatars' and o.updated_at<now()-interval '1 day' and not exists(select 1 from public.profiles p where p.avatar_path=o.name))
 order by o.updated_at limit 500;
$$;
revoke all on function public.cleanup_candidates() from public,anon,authenticated;
grant execute on function public.cleanup_candidates() to service_role;
-- All settings writes are audited; prevent locking the acting administrator out.
create function private.protect_admin_config() returns trigger language plpgsql security definer set search_path='' as $$ begin
 if new.is_active=false and private.is_admin() and (
 (tg_table_name='universities' and exists(select 1 from public.user_accounts a join public.campuses c on c.id=a.campus_id where a.user_id=auth.uid() and c.university_id=new.id)) or
 (tg_table_name='campuses' and exists(select 1 from public.user_accounts where user_id=auth.uid() and campus_id=new.id)) or
 (tg_table_name='allowed_email_domains' and exists(select 1 from public.user_accounts a join public.allowed_email_domains d on d.domain=a.email_domain where a.user_id=auth.uid() and d.id=new.id))) then raise exception 'You cannot disable your own administrator access. Use a different active campus administrator.'; end if;return new;end $$;
revoke all on function private.protect_admin_config() from public,anon,authenticated;
create trigger protect_university before update on public.universities for each row execute function private.protect_admin_config();
create trigger protect_campus before update on public.campuses for each row execute function private.protect_admin_config();
create trigger protect_domain before update on public.allowed_email_domains for each row execute function private.protect_admin_config();
create function public.profile_is_verified(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$ select private.member_active(p_id); $$;
revoke all on function public.profile_is_verified(uuid) from public;
grant execute on function public.profile_is_verified(uuid) to anon,authenticated;
commit;
