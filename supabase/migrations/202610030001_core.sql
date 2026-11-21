begin;
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

create table public.universities(id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 2 and 160), short_name text not null, is_active boolean not null default true, created_at timestamptz not null default now());
create table public.campuses(id uuid primary key default gen_random_uuid(), university_id uuid not null references public.universities, name text not null, city text not null, is_active boolean not null default true, created_at timestamptz not null default now());
create table public.allowed_email_domains(id uuid primary key default gen_random_uuid(), campus_id uuid not null references public.campuses, domain text unique not null check(domain=lower(domain) and domain ~ '^[a-z0-9][a-z0-9.-]+\.[a-z]{2,}$'), is_active boolean not null default true, created_at timestamptz not null default now());
create table public.categories(id text primary key, name text unique not null, is_active boolean not null default true);
create table public.meetup_spots(id uuid primary key default gen_random_uuid(), campus_id uuid not null references public.campuses, name text not null, is_active boolean not null default true);
create table public.marketplace_rules(id uuid primary key default gen_random_uuid(), title text not null, description text not null, is_active boolean not null default true);
create table public.profiles(id uuid primary key references auth.users on delete cascade, campus_id uuid not null references public.campuses, full_name text not null check(length(full_name) between 2 and 100), department text not null check(length(department) between 2 and 100), avatar_path text, verified_at timestamptz not null, created_at timestamptz not null default now());
create table public.user_accounts(user_id uuid primary key references auth.users on delete cascade, campus_id uuid not null references public.campuses, email_domain text not null references public.allowed_email_domains(domain), role text not null default 'STUDENT' check(role in ('STUDENT','ADMIN')), status text not null default 'ACTIVE' check(status in ('ACTIVE','SUSPENDED','REJECTED','DEACTIVATED')), registration_number text not null check(length(registration_number) between 2 and 80), graduation_year integer not null check(graduation_year between 2000 and 2100), status_reason text, status_changed_at timestamptz, status_changed_by uuid references auth.users, created_at timestamptz not null default now(), unique(campus_id,registration_number));
create table public.user_private_contacts(user_id uuid primary key references auth.users on delete cascade, phone_number text not null check(phone_number ~ '^\+[1-9][0-9]{7,14}$'), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.listings(id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles, campus_id uuid not null references public.campuses, type text not null check(type in ('SALE','RENT','REQUEST')), title text not null check(length(title) between 5 and 120), description text not null check(length(description) between 20 and 4000), category text not null references public.categories, condition text check(condition in ('NEW','LIKE_NEW','USED','FAIR')), price numeric(12,2), rental_rate_daily numeric(12,2), deposit numeric(12,2), offered_budget numeric(12,2), need_type text check(need_type in ('BUY','RENT','EITHER')), preferred_meetup_spot text not null check(length(preferred_meetup_spot) between 2 and 160), image_paths text[] not null default '{}', status text not null default 'ACTIVE' check(status in ('ACTIVE','COMPLETED','ARCHIVED','REMOVED_BY_ADMIN')), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), completed_at timestamptz, archived_at timestamptz,
search_document tsvector generated always as (to_tsvector('english',coalesce(title,'')||' '||coalesce(description,'')||' '||coalesce(category,''))) stored,
amount numeric generated always as (coalesce(price,rental_rate_daily,offered_budget)) stored,
check(cardinality(image_paths)<=3), check(price>=0 and rental_rate_daily>=0 and deposit>=0 and offered_budget>=0),
check((type='SALE' and price is not null and condition is not null and rental_rate_daily is null and deposit is null and offered_budget is null and need_type is null) or (type='RENT' and rental_rate_daily is not null and condition is not null and price is null and offered_budget is null and need_type is null) or (type='REQUEST' and offered_budget is not null and need_type is not null and condition is null and price is null and rental_rate_daily is null and deposit is null and cardinality(image_paths)=0)));
create index listings_search_idx on public.listings using gin(search_document);
create index listings_feed_idx on public.listings(campus_id,type,status,created_at desc);
create index listings_owner_idx on public.listings(user_id,status);
create index listings_price_idx on public.listings(type,status,amount);
create table public.wishlist(id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users on delete cascade, listing_id uuid not null references public.listings on delete cascade, created_at timestamptz not null default now(), unique(user_id,listing_id));
create table public.listing_telemetry(id uuid primary key default gen_random_uuid(), listing_id uuid not null references public.listings, user_id uuid not null references auth.users, event_type text not null check(event_type in ('COMPLETED','ARCHIVED')), resolution_reason text not null, comments text check(length(comments)<=1000), created_at timestamptz not null default now());
create table public.reports(id uuid primary key default gen_random_uuid(), reporter_user_id uuid not null references auth.users, reported_user_id uuid references public.profiles, listing_id uuid references public.listings, reason text not null check(reason in ('SCAM_OR_SUSPICIOUS','INCORRECT_INFORMATION','PROHIBITED_ITEM','SPAM','HARASSMENT','DUPLICATE_LISTING','OTHER')), comments text check(length(comments)<=2000), status text not null default 'OPEN' check(status in ('OPEN','REVIEWING','RESOLVED','DISMISSED')), reviewed_by uuid references auth.users, reviewed_at timestamptz, admin_notes text check(length(admin_notes)<=4000), created_at timestamptz not null default now(), check(num_nonnulls(reported_user_id,listing_id)=1));
create index reports_open_idx on public.reports(status,created_at desc);
create table public.admin_audit_logs(id uuid primary key default gen_random_uuid(), admin_user_id uuid not null references auth.users, action_type text not null, target_user_id uuid, target_listing_id uuid, reason text, metadata jsonb, created_at timestamptz not null default now());

create function private.member_active(uid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.user_accounts a join public.allowed_email_domains d on d.domain=a.email_domain join public.campuses c on c.id=a.campus_id join public.universities u on u.id=c.university_id join auth.users au on au.id=a.user_id where a.user_id=uid and a.status='ACTIVE' and d.is_active and c.is_active and u.is_active and d.campus_id=a.campus_id and lower(split_part(au.email,'@',2))=a.email_domain and au.email_confirmed_at is not null);
$$;
create function private.is_admin() returns boolean language sql stable security definer set search_path='' as $$ select private.member_active(auth.uid()) and exists(select 1 from public.user_accounts where user_id=auth.uid() and role='ADMIN'); $$;
create function private.require_member() returns uuid language plpgsql stable security definer set search_path='' as $$ begin if not private.member_active(auth.uid()) then raise exception 'An active verified account is required.'; end if; return auth.uid(); end $$;
create function private.require_admin() returns uuid language plpgsql stable security definer set search_path='' as $$ begin if not private.is_admin() then raise exception 'Administrator access required.'; end if; return auth.uid(); end $$;

create function public.before_user_created(event jsonb) returns jsonb language plpgsql stable security definer set search_path='' as $$ begin
 if not exists(select 1 from public.allowed_email_domains d join public.campuses c on c.id=d.campus_id join public.universities u on u.id=c.university_id where d.domain=lower(split_part(event->'user'->>'email','@',2)) and d.is_active and c.is_active and u.is_active) then return jsonb_build_object('error',jsonb_build_object('http_code',403,'message','Use an approved university email address.')); end if; return '{}'::jsonb; end $$;

create function public.save_profile(p_name text,p_department text,p_registration text,p_year integer,p_phone text,p_avatar text default null) returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); cid uuid; domain_name text; confirmed timestamptz; begin
 if uid is null then raise exception 'Sign in first.'; end if;
 select lower(split_part(email,'@',2)),email_confirmed_at into domain_name,confirmed from auth.users where id=uid;
 select d.campus_id into cid from public.allowed_email_domains d join public.campuses c on c.id=d.campus_id join public.universities u on u.id=c.university_id where d.domain=domain_name and d.is_active and c.is_active and u.is_active;
 if cid is null or confirmed is null then raise exception 'University email verification required.'; end if;
 if exists(select 1 from public.user_accounts where user_id=uid and status<>'ACTIVE') then raise exception 'Your account is restricted.'; end if;
 if p_avatar is not null and p_avatar<>uid::text||'/avatar.webp' then raise exception 'Invalid avatar path.'; end if;
 insert into public.user_accounts(user_id,campus_id,email_domain,registration_number,graduation_year) values(uid,cid,domain_name,upper(trim(p_registration)),p_year) on conflict(user_id) do update set registration_number=excluded.registration_number,graduation_year=excluded.graduation_year;
 insert into public.profiles(id,campus_id,full_name,department,avatar_path,verified_at) values(uid,cid,trim(p_name),trim(p_department),p_avatar,confirmed) on conflict(id) do update set full_name=excluded.full_name,department=excluded.department,avatar_path=excluded.avatar_path;
 insert into public.user_private_contacts(user_id,phone_number) values(uid,p_phone) on conflict(user_id) do update set phone_number=excluded.phone_number,updated_at=now();
end $$;
create function public.save_listing(p_data jsonb,p_id uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=private.require_member(); lid uuid:=coalesce(p_id,gen_random_uuid()); cid uuid; images text[]; begin
 select campus_id into cid from public.user_accounts where user_id=uid;
 if p_id is not null then perform 1 from public.listings where id=p_id and user_id=uid and status='ACTIVE' for update; if not found then raise exception 'Only your active listings can be edited.'; end if; end if;
 if p_id is null and (select count(*) from public.listings where user_id=uid and created_at>now()-interval '1 hour')>=10 then raise exception 'Posting limit reached. Try again later.'; end if;
 if not exists(select 1 from public.categories where id=p_data->>'category' and is_active) then raise exception 'Choose an active category.'; end if;
 select coalesce(array_agg(value),'{}') into images from jsonb_array_elements_text(coalesce(p_data->'image_paths','[]'));
 if cardinality(images)>3 or cardinality(images)<>(select count(distinct x) from unnest(images) x) or exists(select 1 from unnest(images) x where x !~ ('^'||uid::text||'/'||lid::text||'/[123]\.webp$')) then raise exception 'Invalid image paths.'; end if;
 if exists(select 1 from unnest(images) x where not exists(select 1 from storage.objects where bucket_id='listing-images' and name=x)) then raise exception 'An image has not finished uploading.'; end if;
 insert into public.listings(id,user_id,campus_id,type,title,description,category,condition,price,rental_rate_daily,deposit,offered_budget,need_type,preferred_meetup_spot,image_paths)
 values(lid,uid,cid,p_data->>'type',trim(p_data->>'title'),trim(p_data->>'description'),p_data->>'category',p_data->>'condition',(p_data->>'price')::numeric,(p_data->>'rental_rate_daily')::numeric,(p_data->>'deposit')::numeric,(p_data->>'offered_budget')::numeric,p_data->>'need_type',trim(p_data->>'preferred_meetup_spot'),images)
 on conflict(id) do update set title=excluded.title,description=excluded.description,category=excluded.category,condition=excluded.condition,price=excluded.price,rental_rate_daily=excluded.rental_rate_daily,deposit=excluded.deposit,offered_budget=excluded.offered_budget,need_type=excluded.need_type,preferred_meetup_spot=excluded.preferred_meetup_spot,image_paths=excluded.image_paths,updated_at=now();
 return lid;
end $$;

create function public.resolve_listing(p_id uuid,p_status text,p_reason text,p_comments text default null) returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=private.require_member(); typ text; reasons text[]; begin
 select type into typ from public.listings where id=p_id and user_id=uid and status='ACTIVE' for update;
 if not found then raise exception 'Only your active listings can be resolved.'; end if;
 if p_status not in ('COMPLETED','ARCHIVED') then raise exception 'Invalid resolution status.'; end if;
 reasons:=case typ when 'SALE' then array['SOLD_ON_CAMPUSXCHANGE','SOLD_OUTSIDE_PLATFORM','NO_LONGER_NEEDED','CHANGED_MIND','OTHER'] when 'RENT' then array['RENTED_THROUGH_CAMPUSXCHANGE','RENTED_OUTSIDE_PLATFORM','NO_LONGER_AVAILABLE','CHANGED_MIND','OTHER'] else array['RECEIVED_ITEM_THROUGH_CAMPUSXCHANGE','FOUND_ALTERNATIVE','NO_LONGER_NEEDED','OTHER'] end;
 if p_reason is null or not(p_reason=any(reasons)) then raise exception 'Choose a valid resolution reason.'; end if;
 update public.listings set status=p_status,completed_at=case when p_status='COMPLETED' then now() end,archived_at=now(),updated_at=now() where id=p_id;
 insert into public.listing_telemetry(listing_id,user_id,event_type,resolution_reason,comments) values(p_id,uid,p_status,p_reason,p_comments);
end $$;
create function public.get_listing_contact(p_id uuid) returns text language plpgsql security definer set search_path='' as $$
declare uid uuid:=private.require_member(); phone text; begin
 select c.phone_number into phone from public.listings l join public.user_private_contacts c on c.user_id=l.user_id where l.id=p_id and l.status='ACTIVE' and private.member_active(l.user_id);
 if phone is null then raise exception 'Contact unavailable.'; end if; return phone; end $$;
create function public.submit_report(p_reason text,p_comments text default null,p_listing uuid default null,p_user uuid default null) returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=private.require_member(); begin
 if (select count(*) from public.reports where reporter_user_id=uid and created_at>now()-interval '1 hour')>=5 then raise exception 'Report limit reached. Try again later.'; end if;
 if p_listing is not null and not exists(select 1 from public.listings where id=p_listing and user_id<>uid and status='ACTIVE' and private.member_active(user_id)) then raise exception 'Listing cannot be reported.'; end if;
 if p_user is not null and (p_user=uid or not private.member_active(p_user)) then raise exception 'User cannot be reported.'; end if;
 insert into public.reports(reporter_user_id,reported_user_id,listing_id,reason,comments) values(uid,p_user,p_listing,p_reason,p_comments);
end $$;
create function public.deactivate_account() returns void language plpgsql security definer set search_path='' as $$ declare uid uuid:=private.require_member(); begin if private.is_admin() then raise exception 'Administrators cannot self-deactivate.'; end if; update public.user_accounts set status='DEACTIVATED',status_reason='Deactivated by account owner',status_changed_at=now(),status_changed_by=uid where user_id=uid; end $$;

create function public.admin_moderate(p_kind text,p_id uuid,p_status text,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare aid uuid:=private.require_admin(); begin
 if length(trim(coalesce(p_reason,'')))<5 or length(p_reason)>2000 then raise exception 'Provide a reason of 5–2000 characters.'; end if;
 if p_kind='USER' then
 if p_status not in ('ACTIVE','SUSPENDED','REJECTED') then raise exception 'Invalid user state.'; end if;
 update public.user_accounts set status=p_status,status_reason=p_reason,status_changed_at=now(),status_changed_by=aid where user_id=p_id and role<>'ADMIN';
 elsif p_kind='LISTING' then
 if p_status<>'REMOVED_BY_ADMIN' then raise exception 'Invalid listing state.'; end if;
 update public.listings set status=p_status,archived_at=now(),updated_at=now() where id=p_id;
 else raise exception 'Invalid moderation target.'; end if;
 if not found then raise exception 'Target unavailable or protected administrator.'; end if;
 insert into public.admin_audit_logs(admin_user_id,action_type,target_user_id,target_listing_id,reason) values(aid,p_kind||'_'||p_status,case when p_kind='USER' then p_id end,case when p_kind='LISTING' then p_id end,p_reason);
end $$;
create function public.admin_review_report(p_id uuid,p_status text,p_notes text) returns void language plpgsql security definer set search_path='' as $$ declare aid uuid:=private.require_admin(); begin
 update public.reports set status=p_status,admin_notes=p_notes,reviewed_by=aid,reviewed_at=now() where id=p_id; if not found then raise exception 'Report not found.'; end if;
 insert into public.admin_audit_logs(admin_user_id,action_type,reason,metadata) values(aid,'REPORT_'||p_status,p_notes,jsonb_build_object('report_id',p_id)); end $$;
create function public.admin_config(p_kind text,p_data jsonb,p_id uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
declare aid uuid:=private.require_admin(); rid uuid:=coalesce(p_id,gen_random_uuid()); begin
 if p_kind='UNIVERSITY' then insert into public.universities(id,name,short_name,is_active) values(rid,p_data->>'name',p_data->>'short_name',(p_data->>'is_active')::boolean) on conflict(id) do update set name=excluded.name,short_name=excluded.short_name,is_active=excluded.is_active;
 elsif p_kind='CAMPUS' then insert into public.campuses(id,university_id,name,city,is_active) values(rid,(p_data->>'university_id')::uuid,p_data->>'name',p_data->>'city',(p_data->>'is_active')::boolean) on conflict(id) do update set name=excluded.name,city=excluded.city,is_active=excluded.is_active;
 elsif p_kind='DOMAIN' then insert into public.allowed_email_domains(id,campus_id,domain,is_active) values(rid,(p_data->>'campus_id')::uuid,lower(trim(p_data->>'domain')),(p_data->>'is_active')::boolean) on conflict(id) do update set is_active=excluded.is_active;
 elsif p_kind='MEETUP' then insert into public.meetup_spots(id,campus_id,name,is_active) values(rid,(p_data->>'campus_id')::uuid,p_data->>'name',(p_data->>'is_active')::boolean) on conflict(id) do update set name=excluded.name,is_active=excluded.is_active;
 elsif p_kind='RULE' then insert into public.marketplace_rules(id,title,description,is_active) values(rid,p_data->>'title',p_data->>'description',(p_data->>'is_active')::boolean) on conflict(id) do update set title=excluded.title,description=excluded.description,is_active=excluded.is_active;
 else raise exception 'Unknown configuration type.'; end if;
 insert into public.admin_audit_logs(admin_user_id,action_type,metadata) values(aid,p_kind||'_CONFIGURED',jsonb_build_object('id',rid,'data',p_data)); return rid;
end $$;

-- Every table is closed by default; no client may bypass narrow write functions.
do $$ declare t text; begin foreach t in array array['universities','campuses','allowed_email_domains','categories','meetup_spots','marketplace_rules','profiles','user_accounts','user_private_contacts','listings','wishlist','listing_telemetry','reports','admin_audit_logs'] loop execute format('alter table public.%I enable row level security',t); execute format('revoke all on public.%I from anon, authenticated',t); execute format('grant select on public.%I to authenticated',t); end loop; end $$;
grant select on public.universities,public.campuses,public.allowed_email_domains,public.categories,public.meetup_spots,public.marketplace_rules,public.profiles,public.listings to anon;
grant insert(user_id,listing_id),delete on public.wishlist to authenticated;
create policy universities_read on public.universities for select using(is_active or private.is_admin());
create policy campuses_read on public.campuses for select using(is_active or private.is_admin());
create policy domains_read on public.allowed_email_domains for select using(is_active or private.is_admin());
create policy categories_read on public.categories for select using(is_active or private.is_admin());
create policy spots_read on public.meetup_spots for select using(is_active or private.is_admin());
create policy rules_read on public.marketplace_rules for select using(is_active or private.is_admin());
create policy profiles_read on public.profiles for select using(private.member_active(id) or id=auth.uid() or private.is_admin());
create policy accounts_read on public.user_accounts for select using(user_id=auth.uid() or private.is_admin());
create policy contacts_read on public.user_private_contacts for select using(user_id=auth.uid() or private.is_admin());
create policy listings_read on public.listings for select using((status='ACTIVE' and private.member_active(user_id)) or (user_id=auth.uid() and private.member_active(auth.uid())) or private.is_admin());
create policy wishlist_read on public.wishlist for select using(user_id=auth.uid() and private.member_active(auth.uid()));
create policy wishlist_insert on public.wishlist for insert with check(user_id=auth.uid() and private.member_active(auth.uid()) and exists(select 1 from public.listings where id=listing_id and status='ACTIVE' and private.member_active(user_id)));
create policy wishlist_delete on public.wishlist for delete using(user_id=auth.uid() and private.member_active(auth.uid()));
create policy telemetry_read on public.listing_telemetry for select using(private.is_admin());
-- Report notes remain admin-only. Reporters receive success, not internal case records.
create policy reports_read on public.reports for select using(private.is_admin());
create policy audit_read on public.admin_audit_logs for select using(private.is_admin());

revoke all on all functions in schema private from public,anon,authenticated;
grant execute on function private.member_active(uuid),private.is_admin() to anon,authenticated;
revoke all on all functions in schema public from public,anon,authenticated;
grant execute on function public.before_user_created(jsonb) to supabase_auth_admin;
grant usage on schema public to supabase_auth_admin;
grant execute on function public.save_profile(text,text,text,integer,text,text),public.save_listing(jsonb,uuid),public.resolve_listing(uuid,text,text,text),public.get_listing_contact(uuid),public.submit_report(text,text,uuid,uuid),public.deactivate_account(),public.admin_moderate(text,uuid,text,text),public.admin_review_report(uuid,text,text),public.admin_config(text,jsonb,uuid) to authenticated;

insert into public.universities(id,name,short_name) values('10000000-0000-0000-0000-000000000001','COMSATS University Islamabad','COMSATS');
insert into public.campuses(id,university_id,name,city) values('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Lahore Campus','Lahore');
insert into public.allowed_email_domains(campus_id,domain) values('20000000-0000-0000-0000-000000000001','cuilahore.edu.pk');
insert into public.categories(id,name) values('books-notes','Books & Notes'),('calculators','Calculators'),('electronics','Electronics'),('lab-equipment','Lab Equipment'),('hostel-room','Hostel & Room'),('clothing','Clothing'),('sports','Sports'),('accessories','Accessories'),('other','Other');
insert into public.meetup_spots(campus_id,name) values('20000000-0000-0000-0000-000000000001','Library entrance'),('20000000-0000-0000-0000-000000000001','Cafeteria'),('20000000-0000-0000-0000-000000000001','Student center');
insert into public.marketplace_rules(title,description) values('Keep it lawful','No illegal goods, weapons, controlled substances or stolen property.'),('Keep it honest','No counterfeit academic documents, misleading listings or inappropriate content.'),('Meet safely','Meet inside campus during active hours. Inspect items before payment. CampusXchange does not guarantee transactions.');
commit;
