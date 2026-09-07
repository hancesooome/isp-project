create extension if not exists btree_gist with schema extensions;

alter table public.installation_orders
add constraint installation_orders_technician_schedule_exclusion
exclude using gist (
  technician_id with =,
  tstzrange(scheduled_start_at, scheduled_end_at, '[)') with &&
)
where (
  technician_id is not null
  and status in ('assigned', 'in_progress')
);

create table public.installation_assignment_history (
  id uuid primary key default gen_random_uuid(),
  installation_order_id uuid not null
    references public.installation_orders(id) on delete restrict,
  previous_technician_id uuid
    references public.profiles(id) on delete restrict,
  technician_id uuid not null
    references public.profiles(id) on delete restrict,
  assigned_by uuid not null
    references public.profiles(id) on delete restrict,
  assignment_reason text check (
    assignment_reason is null or btrim(assignment_reason) <> ''
  ),
  assigned_at timestamptz not null default now(),
  check (
    previous_technician_id is null
    or previous_technician_id <> technician_id
  ),
  check (
    previous_technician_id is null
    or assignment_reason is not null
  )
);

create index installation_assignment_history_order_idx
on public.installation_assignment_history(installation_order_id, assigned_at desc);

create index installation_assignment_history_technician_idx
on public.installation_assignment_history(technician_id, assigned_at desc);

alter table public.installation_assignment_history enable row level security;
revoke all on table public.installation_assignment_history from anon, authenticated;

create function public.assign_installation_technician(
  p_installation_order_id uuid,
  p_technician_id uuid,
  p_assigner_id uuid,
  p_assignment_reason text default null
)
returns table (
  id uuid,
  status text,
  technician_id uuid,
  technician_name text,
  assignment_changed boolean,
  was_reassigned boolean,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_order public.installation_orders%rowtype;
  selected_technician_name text;
  assignment_time timestamptz := now();
  normalized_reason text := nullif(btrim(p_assignment_reason), '');
  is_reassignment boolean;
begin
  if not exists (
    select 1
    from public.profiles
    where profiles.id = p_assigner_id
      and profiles.role = 'admin'
  ) then
    raise exception using errcode = '42501', message = 'Admin access required';
  end if;

  select *
  into selected_order
  from public.installation_orders
  where installation_orders.id = p_installation_order_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Installation order not found';
  end if;

  if selected_order.status not in ('scheduled', 'assigned')
    or selected_order.scheduled_start_at is null
    or selected_order.scheduled_end_at is null
    or selected_order.scheduled_end_at <= assignment_time
  then
    raise exception using errcode = 'P0001', message = 'Installation order is not assignable';
  end if;

  select profiles.full_name
  into selected_technician_name
  from public.technician_profiles
  join public.profiles on profiles.id = technician_profiles.profile_id
  where technician_profiles.profile_id = p_technician_id
    and profiles.role = 'technician'
    and technician_profiles.is_active = true
    and technician_profiles.availability_status = 'available';

  if not found then
    raise exception using errcode = 'P0001', message = 'Technician is not available';
  end if;

  if selected_order.technician_id = p_technician_id then
    return query select
      selected_order.id,
      selected_order.status,
      selected_order.technician_id,
      selected_technician_name,
      false,
      false,
      selected_order.updated_at;
    return;
  end if;

  if exists (
    select 1
    from public.installation_orders conflicting_order
    where conflicting_order.technician_id = p_technician_id
      and conflicting_order.id <> selected_order.id
      and conflicting_order.status in ('assigned', 'in_progress')
      and conflicting_order.scheduled_start_at < selected_order.scheduled_end_at
      and conflicting_order.scheduled_end_at > selected_order.scheduled_start_at
  ) then
    raise exception using errcode = 'P0001', message = 'Technician has a scheduling conflict';
  end if;

  is_reassignment := selected_order.technician_id is not null;

  if is_reassignment and normalized_reason is null then
    raise exception using errcode = 'P0001', message = 'A reassignment reason is required';
  end if;

  insert into public.installation_assignment_history (
    installation_order_id,
    previous_technician_id,
    technician_id,
    assigned_by,
    assignment_reason,
    assigned_at
  ) values (
    selected_order.id,
    selected_order.technician_id,
    p_technician_id,
    p_assigner_id,
    normalized_reason,
    assignment_time
  );

  update public.installation_orders
  set
    technician_id = p_technician_id,
    status = 'assigned',
    updated_at = assignment_time
  where installation_orders.id = selected_order.id
  returning * into selected_order;

  return query select
    selected_order.id,
    selected_order.status,
    selected_order.technician_id,
    selected_technician_name,
    true,
    is_reassignment,
    selected_order.updated_at;
end;
$$;

revoke all on function public.assign_installation_technician(
  uuid,
  uuid,
  uuid,
  text
) from public;

grant execute on function public.assign_installation_technician(
  uuid,
  uuid,
  uuid,
  text
) to service_role;
