-- Run ONCE after migrations 001–004. Atomic upgrade; no accounts/listings dropped.
begin;
alter table public.listings add column contact_mode text not null default 'CHAT' check(contact_mode in ('CHAT','WHATSAPP','CALL','BOTH'));
alter table public.listings add column deleted_at timestamptz;
alter table public.listings add column deleted_by uuid references auth.users;
alter table public.listings add column deletion_reason text;

create table private.conversations (
 id uuid primary key default gen_random_uuid(), listing_id uuid not null references public.listings on delete cascade,
 buyer_id uuid not null references auth.users on delete cascade, seller_id uuid not null references auth.users on delete cascade,
 buyer_read_id bigint not null default 0, seller_read_id bigint not null default 0,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(listing_id,buyer_id), check(buyer_id<>seller_id)
);
create table private.messages (
 id bigint generated always as identity primary key, conversation_id uuid not null references private.conversations on delete cascade,
 sender_id uuid not null references auth.users on delete cascade, body text not null check(length(btrim(body)) between 1 and 2000),
 client_id uuid not null, created_at timestamptz not null default now(), unique(conversation_id,sender_id,client_id)
);
create index messages_thread on private.messages(conversation_id,id desc);
create index messages_sender_time on private.messages(sender_id,created_at);
create index conversations_buyer on private.conversations(buyer_id,updated_at desc);
create index conversations_seller on private.conversations(seller_id,updated_at desc);
create table private.chat_blocks (
 blocker uuid not null references auth.users on delete cascade, blocked uuid not null references auth.users on delete cascade,
 created_at timestamptz not null default now(), primary key(blocker,blocked), check(blocker<>blocked)
);
alter table private.conversations enable row level security;
alter table private.messages enable row level security;
alter table private.chat_blocks enable row level security;
revoke all on private.conversations,private.messages,private.chat_blocks from public,anon,authenticated;
create function private.pair_blocked(a uuid,b uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.chat_blocks where (blocker=a and blocked=b) or (blocker=b and blocked=a)); $$;
create function private.lock_chat_pair(a uuid,b uuid) returns void language sql volatile security definer set search_path='' as $$
 select pg_advisory_xact_lock(hashtextextended(least(a,b)::text||greatest(a,b)::text,0)); $$;
create or replace function public.save_listing(p_data jsonb,p_id uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=private.require_member(); lid uuid:=coalesce(p_id,gen_random_uuid()); cid uuid; images text[]; begin
 select campus_id into cid from public.user_accounts where user_id=uid;
 if p_id is not null then perform 1 from public.listings where id=p_id and user_id=uid and status='ACTIVE' and deleted_at is null for update; if not found then raise exception 'Only your active listings can be edited.'; end if; end if;
 if p_id is null and (select count(*) from public.listings where user_id=uid and created_at>now()-interval '1 hour')>=10 then raise exception 'Posting limit reached. Try again later.'; end if;
 if not exists(select 1 from public.categories where id=p_data->>'category' and is_active) then raise exception 'Choose an active category.'; end if;
 select coalesce(array_agg(value),'{}') into images from jsonb_array_elements_text(coalesce(p_data->'image_paths','[]'));
 if cardinality(images)>3 or cardinality(images)<>(select count(distinct x) from unnest(images) x) or exists(select 1 from unnest(images) x where x !~ ('^'||uid::text||'/'||lid::text||'/[123]\.webp$')) then raise exception 'Invalid image paths.'; end if;
 if exists(select 1 from unnest(images) x where not exists(select 1 from storage.objects where bucket_id='listing-images' and name=x)) then raise exception 'An image has not finished uploading.'; end if;
 insert into public.listings(id,user_id,campus_id,type,title,description,category,condition,price,rental_rate_daily,deposit,offered_budget,need_type,preferred_meetup_spot,image_paths,contact_mode)
 values(lid,uid,cid,p_data->>'type',trim(p_data->>'title'),trim(p_data->>'description'),p_data->>'category',p_data->>'condition',(p_data->>'price')::numeric,(p_data->>'rental_rate_daily')::numeric,(p_data->>'deposit')::numeric,(p_data->>'offered_budget')::numeric,p_data->>'need_type',trim(p_data->>'preferred_meetup_spot'),images,coalesce(p_data->>'contact_mode','CHAT'))
 on conflict(id) do update set title=excluded.title,description=excluded.description,category=excluded.category,condition=excluded.condition,price=excluded.price,rental_rate_daily=excluded.rental_rate_daily,deposit=excluded.deposit,offered_budget=excluded.offered_budget,need_type=excluded.need_type,preferred_meetup_spot=excluded.preferred_meetup_spot,image_paths=excluded.image_paths,contact_mode=excluded.contact_mode,updated_at=now();
 return lid;
end $$;


create or replace function public.get_listing_contact(p_id uuid) returns text language plpgsql security definer set search_path='' as $$
declare uid uuid:=private.require_member(); phone text; begin
 select c.phone_number into phone from public.listings l join public.user_private_contacts c on c.user_id=l.user_id
 where l.id=p_id and l.status='ACTIVE' and l.deleted_at is null and l.contact_mode<>'CHAT'
 and private.member_active(l.user_id) and not private.pair_blocked(uid,l.user_id);
 if phone is null then raise exception 'Contact unavailable. Use in-app chat.'; end if; return phone; end $$;

create function public.delete_listing(p_id uuid,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=private.require_member(); l public.listings; adm boolean:=private.is_admin(); begin
 if length(btrim(coalesce(p_reason,''))) not between 5 and 2000 then raise exception 'Provide a reason of 5–2000 characters.'; end if;
 select * into l from public.listings where id=p_id for update;
 if not found or l.deleted_at is not null or (l.user_id<>uid and not adm) then raise exception 'Listing unavailable or access denied.'; end if;
 update public.listings set deleted_at=now(),deleted_by=uid,deletion_reason=btrim(p_reason),
 status=case when adm and l.user_id<>uid then 'REMOVED_BY_ADMIN' else 'ARCHIVED' end,archived_at=now(),updated_at=now() where id=p_id;
 -- Cascade physically deletes every message in the ad's conversations.
 delete from private.conversations where listing_id=p_id;
 delete from public.wishlist where listing_id=p_id;
 insert into public.admin_audit_logs(admin_user_id,action_type,target_user_id,target_listing_id,reason)
 values(uid,case when adm then 'LISTING_DELETED_BY_ADMIN' else 'LISTING_DELETED_BY_OWNER' end,l.user_id,p_id,btrim(p_reason));
end $$;
-- Old clients calling admin_moderate also receive the new deletion semantics.
create or replace function public.admin_moderate(p_kind text,p_id uuid,p_status text,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare aid uuid:=private.require_admin(); begin
 if length(trim(coalesce(p_reason,'')))<5 or length(p_reason)>2000 then raise exception 'Provide a reason of 5–2000 characters.'; end if;
 if p_kind='LISTING' then
  if p_status is distinct from 'REMOVED_BY_ADMIN' then raise exception 'Invalid listing state.'; end if;
  perform public.delete_listing(p_id,p_reason); return;
 elsif p_kind='USER' then
  if p_status is null or p_status not in ('ACTIVE','SUSPENDED','REJECTED') then raise exception 'Invalid user state.'; end if;
  update public.user_accounts set status=p_status,status_reason=p_reason,status_changed_at=now(),status_changed_by=aid where user_id=p_id and role<>'ADMIN';
 else raise exception 'Invalid moderation target.'; end if;
 if not found then raise exception 'Target unavailable or protected administrator.'; end if;
 insert into public.admin_audit_logs(admin_user_id,action_type,target_user_id,reason) values(aid,'USER_'||p_status,p_id,p_reason);
end $$;

create function public.start_chat(p_listing uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=private.require_member(); l public.listings; cid uuid; begin
 select * into l from public.listings where id=p_listing for update;
 if not found or l.deleted_at is not null or l.status<>'ACTIVE' or l.user_id=uid or not private.member_active(l.user_id) then raise exception 'Chat unavailable for this listing.'; end if;
 perform private.lock_chat_pair(uid,l.user_id);
 if private.pair_blocked(uid,l.user_id) then raise exception 'Chat unavailable. A participant has blocked contact.'; end if;
 select id into cid from private.conversations where listing_id=p_listing and buyer_id=uid;
 if cid is not null then return cid; end if;
 -- Serialize a sender's thread creation across different listings.
 perform pg_advisory_xact_lock(hashtextextended('start:'||uid::text,0));
 if (select count(*) from private.conversations where buyer_id=uid and created_at>now()-interval '1 hour')>=20 then raise exception 'New chat limit reached. Try again later.'; end if;
 insert into private.conversations(listing_id,buyer_id,seller_id) values(p_listing,uid,l.user_id) returning id into cid;
 return cid; end $$;

create function public.chat_inbox(p_offset integer default 0) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=private.require_member(); result jsonb; begin
 select coalesce(jsonb_agg(to_jsonb(t) order by t.updated_at desc,t.id),'[]') into result from (
 select c.id,c.listing_id,l.title,c.updated_at,
 case when c.buyer_id=uid then c.seller_id else c.buyer_id end as other_id,
 p.full_name as other_name,
 (select body from private.messages where conversation_id=c.id order by id desc limit 1) as last_message,
 (select count(*) from private.messages m where m.conversation_id=c.id and m.sender_id<>uid and m.id>case when c.buyer_id=uid then c.buyer_read_id else c.seller_read_id end) as unread
 from private.conversations c join public.listings l on l.id=c.listing_id
 join public.profiles p on p.id=case when c.buyer_id=uid then c.seller_id else c.buyer_id end
 where uid in(c.buyer_id,c.seller_id) and l.deleted_at is null
 order by c.updated_at desc,c.id limit 30 offset greatest(coalesce(p_offset,0),0)
 ) t; return result; end $$;

create function public.chat_unread_count() returns bigint language plpgsql security definer set search_path='' as $$
declare uid uuid:=private.require_member(); n bigint; begin
 select count(*) into n from private.messages m join private.conversations c on c.id=m.conversation_id
 where uid in(c.buyer_id,c.seller_id) and m.sender_id<>uid and m.id>case when c.buyer_id=uid then c.buyer_read_id else c.seller_read_id end;
 return n; end $$;

create function public.chat_thread(p_id uuid,p_before bigint default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=private.require_member(); c private.conversations; other uuid; l public.listings; msgs jsonb; begin
 select * into c from private.conversations where id=p_id and uid in(buyer_id,seller_id);
 if not found then raise exception 'Conversation unavailable. The ad may have been deleted.'; end if;
 select * into l from public.listings where id=c.listing_id;
 if l.deleted_at is not null then raise exception 'Conversation unavailable.'; end if;
 other:=case when c.buyer_id=uid then c.seller_id else c.buyer_id end;
 select coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]') into msgs from (
 select id,sender_id,body,created_at from private.messages where conversation_id=p_id and (p_before is null or id<p_before) order by id desc limit 50
 ) t;
 return jsonb_build_object('id',c.id,'listing_id',c.listing_id,'title',l.title,'other_id',other,
 'other_name',(select full_name from public.profiles where id=other),
 'blocked_by_me',exists(select 1 from private.chat_blocks where blocker=uid and blocked=other),
 'can_send',l.status='ACTIVE' and private.member_active(other) and not private.pair_blocked(uid,other), 'messages',msgs);
end $$;

create function public.send_chat_message(p_id uuid,p_body text,p_client_id uuid) returns bigint language plpgsql security definer set search_path='' as $$
declare uid uuid:=private.require_member(); c private.conversations; l public.listings; other uuid; mid bigint; lid uuid; begin
 if p_client_id is null or length(btrim(coalesce(p_body,''))) not between 1 and 2000 then raise exception 'Write a message of 1–2000 characters.'; end if;
 select listing_id into lid from private.conversations where id=p_id and uid in(buyer_id,seller_id);
 if lid is null then raise exception 'Conversation unavailable.'; end if;
 -- Lock the listing first, matching deletion and start_chat lock ordering.
 select * into l from public.listings where id=lid for update;
 if l.deleted_at is not null or l.status<>'ACTIVE' then raise exception 'This listing is closed.'; end if;
 select * into c from private.conversations where id=p_id and uid in(buyer_id,seller_id);
 if not found then raise exception 'Conversation unavailable.'; end if;
 other:=case when c.buyer_id=uid then c.seller_id else c.buyer_id end;
 perform private.lock_chat_pair(uid,other);
 if not private.member_active(other) or private.pair_blocked(uid,other) then raise exception 'Messaging is unavailable for this conversation.'; end if;
 perform pg_advisory_xact_lock(hashtextextended('send:'||uid::text,0));
 select id into mid from private.messages where conversation_id=p_id and sender_id=uid and client_id=p_client_id;
 if mid is not null then return mid; end if;
 if (select count(*) from private.messages where sender_id=uid and created_at>now()-interval '1 minute')>=30
 or (select count(*) from private.messages where sender_id=uid and created_at>now()-interval '1 hour')>=200 then raise exception 'Message limit reached. Try again later.'; end if;
 insert into private.messages(conversation_id,sender_id,body,client_id) values(p_id,uid,btrim(p_body),p_client_id) returning id into mid;
 update private.conversations set updated_at=now() where id=p_id;
 return mid; end $$;

create function public.mark_chat_read(p_id uuid,p_message bigint) returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=private.require_member(); begin
 if not exists(select 1 from private.messages where conversation_id=p_id and id=p_message) then return; end if;
 update private.conversations set buyer_read_id=case when buyer_id=uid then greatest(buyer_read_id,p_message) else buyer_read_id end,
 seller_read_id=case when seller_id=uid then greatest(seller_read_id,p_message) else seller_read_id end
 where id=p_id and uid in(buyer_id,seller_id);
 if not found then raise exception 'Conversation unavailable.'; end if; end $$;

create function public.set_chat_block(p_user uuid,p_block boolean) returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=private.require_member(); begin
 if p_user is null or p_user=uid or p_block is null then raise exception 'Invalid contact.'; end if;
 perform private.lock_chat_pair(uid,p_user);
 if p_block then
 if not exists(select 1 from private.conversations where (buyer_id=uid and seller_id=p_user) or (seller_id=uid and buyer_id=p_user)) then raise exception 'Conversation unavailable.'; end if;
 insert into private.chat_blocks(blocker,blocked) values(uid,p_user) on conflict do nothing;
 else delete from private.chat_blocks where blocker=uid and blocked=p_user; end if;
end $$;
create function public.chat_blocked_users() returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=private.require_member(); result jsonb; begin
 select coalesce(jsonb_agg(jsonb_build_object('id',b.blocked,'name',p.full_name)),'[]') into result
 from private.chat_blocks b join public.profiles p on p.id=b.blocked where b.blocker=uid; return result; end $$;
create function public.report_chat(p_id uuid,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=private.require_member(); c private.conversations; begin
 if length(btrim(coalesce(p_reason,''))) not between 5 and 1500 then raise exception 'Describe the issue in 5–1500 characters.'; end if;
 select * into c from private.conversations where id=p_id and uid in(buyer_id,seller_id);
 if not found then raise exception 'Conversation unavailable.'; end if;
 perform public.submit_report('HARASSMENT','Chat report; listing '||c.listing_id::text||'; conversation '||c.id::text||E'\n'||btrim(p_reason),null,
 case when c.buyer_id=uid then c.seller_id else c.buyer_id end);
end $$;

-- Public visibility remains active-only; owners/admins can see their removal reason.
drop policy listings_read on public.listings;
create policy listings_read on public.listings for select using(
 (deleted_at is null and status='ACTIVE' and private.member_active(user_id)) or
 (user_id=auth.uid() and private.member_active(auth.uid())) or private.is_admin());
create or replace function private.can_read_image(path text) returns boolean language sql stable security definer set search_path='' as $$
 select private.is_admin() or exists(select 1 from public.listings l where l.deleted_at is null and
 ((path ~ ('^'||l.user_id::text||'/'||l.id::text||'/[123]\.webp$') and l.user_id=auth.uid() and private.member_active(auth.uid()))
 or (path=any(l.image_paths) and l.status='ACTIVE' and private.member_active(l.user_id)))); $$;
-- Revoke PostgreSQL's default PUBLIC function execute privilege explicitly.
revoke all on function private.pair_blocked(uuid,uuid),private.lock_chat_pair(uuid,uuid) from public,anon,authenticated;
revoke all on function public.delete_listing(uuid,text),public.start_chat(uuid),public.chat_inbox(integer),public.chat_unread_count(),public.chat_thread(uuid,bigint),public.send_chat_message(uuid,text,uuid),public.mark_chat_read(uuid,bigint),public.set_chat_block(uuid,boolean),public.chat_blocked_users(),public.report_chat(uuid,text) from public,anon,authenticated;
grant execute on function public.delete_listing(uuid,text),public.start_chat(uuid),public.chat_inbox(integer),public.chat_unread_count(),public.chat_thread(uuid,bigint),public.send_chat_message(uuid,text,uuid),public.mark_chat_read(uuid,bigint),public.set_chat_block(uuid,boolean),public.chat_blocked_users(),public.report_chat(uuid,text) to authenticated;
commit;
