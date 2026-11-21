begin;
create function public.admin_overview() returns jsonb language plpgsql stable security definer set search_path='' as $$ begin perform private.require_admin(); return jsonb_build_object(
 'Total registered users',(select count(*) from auth.users),
 'Active students',(select count(*) from public.user_accounts where status='ACTIVE' and role='STUDENT'),
 'Suspended users',(select count(*) from public.user_accounts where status='SUSPENDED'),
 'Rejected users',(select count(*) from public.user_accounts where status='REJECTED'),
 'Total listings',(select count(*) from public.listings),
 'Active listings',(select count(*) from public.listings where status='ACTIVE'),
 'Sale listings',(select count(*) from public.listings where type='SALE'),
 'Rental listings',(select count(*) from public.listings where type='RENT'),
 'Open requests',(select count(*) from public.listings where type='REQUEST' and status='ACTIVE'),
 'Completed listings',(select count(*) from public.listings where status='COMPLETED'),
 'Open reports',(select count(*) from public.reports where status in ('OPEN','REVIEWING')),
 'Removed listings',(select count(*) from public.listings where status='REMOVED_BY_ADMIN'));
end $$;
create function public.admin_analytics() returns jsonb language plpgsql stable security definer set search_path='' as $$ begin perform private.require_admin(); return jsonb_build_object(
 'resolutions',(select coalesce(jsonb_agg(x),'[]') from (select resolution_reason as label,count(*) as count from public.listing_telemetry group by resolution_reason order by count(*) desc) x),
 'categories',(select coalesce(jsonb_agg(x),'[]') from (select category as label,count(*) as count from public.listings group by category order by count(*) desc) x),
 'modules',(select coalesce(jsonb_agg(x),'[]') from (select type as label,count(*) as count from public.listings group by type order by count(*) desc) x));
end $$;
-- Live eligibility includes configuration changes; no stale JWT role claims are trusted.
create function public.my_eligibility() returns boolean language sql stable security definer set search_path='' as $$ select private.member_active(auth.uid()); $$;
revoke all on function public.admin_overview(),public.admin_analytics(),public.my_eligibility() from public,anon;
grant execute on function public.admin_overview(),public.admin_analytics(),public.my_eligibility() to authenticated;
commit;
