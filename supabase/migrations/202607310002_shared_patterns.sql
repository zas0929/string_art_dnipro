create table public.shared_patterns (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.projects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  public_token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  name text not null,
  sequence integer[] not null check (cardinality(sequence) >= 2),
  point_count integer not null check (point_count between 60 and 600),
  line_count integer not null check (line_count = cardinality(sequence) - 1),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index shared_patterns_owner_idx
  on public.shared_patterns(owner_id, updated_at desc);

create trigger shared_patterns_set_updated_at
before update on public.shared_patterns
for each row execute function public.set_updated_at();

alter table public.shared_patterns enable row level security;

create policy "Owners can read their shared patterns"
on public.shared_patterns for select
to authenticated
using ((select auth.uid()) = owner_id);

create policy "Owners can update their shared patterns"
on public.shared_patterns for update
to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

create policy "Owners can delete their shared patterns"
on public.shared_patterns for delete
to authenticated
using ((select auth.uid()) = owner_id);

create or replace function public.publish_shared_pattern(p_project_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  published_token text;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  insert into public.shared_patterns (
    project_id,
    owner_id,
    name,
    sequence,
    point_count,
    line_count,
    active
  )
  select
    projects.id,
    projects.user_id,
    projects.name,
    projects.sequence,
    projects.point_count,
    projects.line_count,
    true
  from public.projects
  where projects.id = p_project_id
    and projects.user_id = (select auth.uid())
  on conflict (project_id) do update set
    name = excluded.name,
    sequence = excluded.sequence,
    point_count = excluded.point_count,
    line_count = excluded.line_count,
    active = true,
    updated_at = now()
  returning public_token into published_token;

  if published_token is null then
    raise exception 'Project was not found' using errcode = 'P0002';
  end if;

  return published_token;
end;
$$;

create or replace function public.get_shared_pattern(p_public_token text)
returns table (
  project_id uuid,
  name text,
  sequence integer[],
  point_count integer,
  line_count integer,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    shared_patterns.project_id,
    shared_patterns.name,
    shared_patterns.sequence,
    shared_patterns.point_count,
    shared_patterns.line_count,
    shared_patterns.updated_at
  from public.shared_patterns
  where shared_patterns.public_token = p_public_token
    and shared_patterns.active = true
  limit 1;
$$;

revoke all on table public.shared_patterns from anon, authenticated;
grant select, update, delete on table public.shared_patterns to authenticated;

revoke execute on function public.publish_shared_pattern(uuid) from public, anon, authenticated;
grant execute on function public.publish_shared_pattern(uuid) to authenticated;

revoke execute on function public.get_shared_pattern(text) from public, anon, authenticated;
grant execute on function public.get_shared_pattern(text) to anon, authenticated;
