create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'user' check (role in ('user', 'admin')),
  plan text not null default 'free' check (plan in ('free', 'unlimited')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Untitled project' check (char_length(name) between 1 and 80),
  sequence integer[] not null check (cardinality(sequence) >= 2),
  point_count integer not null check (point_count between 60 and 600),
  line_count integer not null check (line_count = cardinality(sequence) - 1),
  algorithm text not null default 'reference-v7',
  settings jsonb not null default '{}'::jsonb,
  source_preview_path text,
  artwork_preview_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.build_progress (
  project_id uuid primary key references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  step_index integer not null default 0 check (step_index >= 0),
  speed_ms integer not null default 1500 check (speed_ms between 500 and 5000),
  voice_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create index projects_user_updated_idx
  on public.projects(user_id, updated_at desc);
create index build_progress_user_idx
  on public.build_progress(user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger projects_set_updated_at
before update on public.projects
for each row execute function public.set_updated_at();

create trigger build_progress_set_updated_at
before update on public.build_progress
for each row execute function public.set_updated_at();

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger create_profile_after_signup
after insert on auth.users
for each row execute function public.create_profile_for_new_user();

create or replace function public.enforce_project_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  has_unlimited_projects boolean;
  existing_projects integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.user_id::text, 0)
  );

  select (role = 'admin' or plan = 'unlimited')
    into has_unlimited_projects
    from public.profiles
    where id = new.user_id;

  if coalesce(has_unlimited_projects, false) then
    return new;
  end if;

  select count(*) into existing_projects
    from public.projects
    where user_id = new.user_id;

  if existing_projects >= 5 then
    raise exception 'Free accounts can save up to 5 projects'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger enforce_project_limit_before_insert
before insert on public.projects
for each row execute function public.enforce_project_limit();

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.build_progress enable row level security;

create policy "Users can read their profile"
on public.profiles for select
to authenticated
using ((select auth.uid()) = id);

create policy "Users can read their projects"
on public.projects for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create their projects"
on public.projects for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their projects"
on public.projects for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete their projects"
on public.projects for delete
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can read their build progress"
on public.build_progress for select
to authenticated
using (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.projects
    where projects.id = build_progress.project_id
      and projects.user_id = (select auth.uid())
  )
);

create policy "Users can create their build progress"
on public.build_progress for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.projects
    where projects.id = build_progress.project_id
      and projects.user_id = (select auth.uid())
  )
);

create policy "Users can update their build progress"
on public.build_progress for update
to authenticated
using (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.projects
    where projects.id = build_progress.project_id
      and projects.user_id = (select auth.uid())
  )
)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.projects
    where projects.id = build_progress.project_id
      and projects.user_id = (select auth.uid())
  )
);

create policy "Users can delete their build progress"
on public.build_progress for delete
to authenticated
using ((select auth.uid()) = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'project-previews',
  'project-previews',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create policy "Users can read their preview files"
on storage.objects for select
to authenticated
using (
  bucket_id = 'project-previews'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Users can upload their preview files"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'project-previews'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Users can update their preview files"
on storage.objects for update
to authenticated
using (
  bucket_id = 'project-previews'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'project-previews'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Users can delete their preview files"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'project-previews'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.create_profile_for_new_user() from public, anon, authenticated;
revoke execute on function public.enforce_project_limit() from public, anon, authenticated;
