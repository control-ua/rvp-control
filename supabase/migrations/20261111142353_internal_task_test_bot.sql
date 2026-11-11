-- Isolated internal communication pilot. No RPV/customer tables or policies change.
create table public.gidra_internal_tasks (
 id uuid primary key default gen_random_uuid(),
 number bigint generated always as identity unique,
 chat_id bigint not null, thread_id bigint not null default 1,
 source_message_id bigint not null, card_message_id bigint,
 creator_id bigint not null, creator_name text not null,
 body text not null check(length(body) between 3 and 2500),
 assignee_id bigint, assignee_name text,
 state text not null default 'new' check(state in ('new','working','blocked','done')),
 reason text not null default '', version integer not null default 0,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(chat_id,source_message_id)
);
create index gidra_internal_tasks_queue on public.gidra_internal_tasks(chat_id,thread_id,state,created_at);
create table public.gidra_internal_task_events (
 update_id bigint primary key, task_id uuid not null references public.gidra_internal_tasks(id),
 actor_id bigint not null, action text not null, details jsonb not null default '{}',
 created_at timestamptz not null default now()
);
create index gidra_internal_task_events_task on public.gidra_internal_task_events(task_id);
create table public.gidra_internal_topics (
 chat_id bigint not null, name text not null, thread_id bigint not null,
 primary key(chat_id,name), unique(chat_id,thread_id)
);
alter table public.gidra_internal_tasks enable row level security;
alter table public.gidra_internal_task_events enable row level security;
alter table public.gidra_internal_topics enable row level security;
revoke all on public.gidra_internal_tasks,public.gidra_internal_task_events,public.gidra_internal_topics from anon,authenticated;
grant all on public.gidra_internal_tasks,public.gidra_internal_task_events,public.gidra_internal_topics to service_role;
grant usage,select on sequence public.gidra_internal_tasks_number_seq to service_role;

create function public.gidra_internal_task_action(p_task uuid,p_chat bigint,p_thread bigint,p_actor bigint,p_name text,p_action text,p_version integer,p_update bigint,p_admin boolean default false,p_reason text default '') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare t public.gidra_internal_tasks%rowtype;
begin
 select * into strict t from public.gidra_internal_tasks where id=p_task and chat_id=p_chat and thread_id=p_thread for update;
 if exists(select 1 from public.gidra_internal_task_events where update_id=p_update and task_id=t.id and actor_id=p_actor) then return to_jsonb(t);end if;
 if t.version<>p_version then raise exception 'stale' using errcode='40001';end if;
 if p_action='take' then
  if t.state<>'new' then raise exception 'already assigned' using errcode='40001';end if;
  t.assignee_id:=p_actor;t.assignee_name:=left(p_name,100);t.state:='working';
 elsif p_action in ('block','done') then
  if p_actor is distinct from t.assignee_id and p_actor<>t.creator_id and not p_admin then raise exception 'not responsible' using errcode='42501';end if;
  if t.state not in ('working','blocked') then raise exception 'take first' using errcode='22023';end if;
  if p_action='block' and length(btrim(p_reason)) not between 3 and 1000 then raise exception 'reason required' using errcode='22023';end if;
  t.state:=case when p_action='block' then 'blocked' else 'done' end;
  t.reason:=case when p_action='block' then btrim(p_reason) else '' end;
 elsif p_action='resume' then
  if p_actor is distinct from t.assignee_id and p_actor<>t.creator_id and not p_admin then raise exception 'not responsible' using errcode='42501';end if;
  if t.state<>'blocked' then raise exception 'not blocked' using errcode='22023';end if;t.state:='working';t.reason:='';
 elsif p_action='reopen' then
  if p_actor<>t.creator_id and not p_admin then raise exception 'creator only' using errcode='42501';end if;
  if t.state<>'done' then raise exception 'not done' using errcode='22023';end if;t.state:='new';t.assignee_id:=null;t.assignee_name:=null;t.reason:='';
 else raise exception 'invalid action' using errcode='22023';end if;
 update public.gidra_internal_tasks set state=t.state,assignee_id=t.assignee_id,assignee_name=t.assignee_name,reason=t.reason,version=version+1,updated_at=now() where id=t.id returning * into t;
 insert into public.gidra_internal_task_events(update_id,task_id,actor_id,action,details) values(p_update,t.id,p_actor,p_action,jsonb_build_object('state',t.state,'version',t.version));
 return to_jsonb(t);
end $$;
revoke all on function public.gidra_internal_task_action(uuid,bigint,bigint,bigint,text,text,integer,bigint,boolean,text) from public,anon,authenticated;
grant execute on function public.gidra_internal_task_action(uuid,bigint,bigint,bigint,text,text,integer,bigint,boolean,text) to service_role;
