-- Keep applications active until an act is approved.
-- `awaiting_act` is separate from contractor_stage so the Telegram bot can
-- continue showing the application to the contractor while an act is needed.

alter table public.applications
  add column if not exists awaiting_act boolean not null default false;

create or replace function public.rvp_guard_pending_act_completion()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'completed' then
    if exists (
      select 1
      from public.acts a
      where a.application_id = new.id
        and a.status = 'approved'
    ) then
      new.awaiting_act := false;
    else
      new.status := 'in_progress';
      new.awaiting_act := true;
    end if;
  elsif new.status in ('new', 'assigned', 'cancelled') then
    new.awaiting_act := false;
  end if;

  return new;
end;
$$;

drop trigger if exists rvp_guard_pending_act_completion on public.applications;
create trigger rvp_guard_pending_act_completion
before update of status on public.applications
for each row
execute function public.rvp_guard_pending_act_completion();
