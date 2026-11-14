-- Office-uploaded acts can belong to an application with no assigned contractor.
-- Keep the actual NULL identity; do not fabricate a contractor or skip work history.
alter table public.work_history alter column contractor_id drop not null;
comment on column public.work_history.contractor_id is
 'Assigned contractor, when present. NULL for office-confirmed work without an assigned contractor.';
