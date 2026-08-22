create or replace function public.is_admin(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where profiles.id = p_user_id
      and profiles.role = 'admin'
  );
$$;

create or replace function public.can_admin_collaborate_on_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin((select auth.uid()))
    and exists (
      select 1
      from public.projects
      where projects.id = p_project_id
        and public.is_admin(projects.user_id)
    );
$$;

create or replace function public.is_admin_id_text(p_user_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where profiles.id::text = p_user_id
      and profiles.role = 'admin'
  );
$$;

create policy "Admins can read admin projects"
on public.projects for select
to authenticated
using (
  public.is_admin((select auth.uid()))
  and public.is_admin(user_id)
);

create policy "Admins can update admin projects"
on public.projects for update
to authenticated
using (
  public.is_admin((select auth.uid()))
  and public.is_admin(user_id)
)
with check (
  public.is_admin((select auth.uid()))
  and public.is_admin(user_id)
);

create or replace function public.keep_project_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.user_id <> old.user_id then
    raise exception 'Project ownership cannot be changed'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger projects_keep_owner
before update of user_id on public.projects
for each row execute function public.keep_project_owner();

create policy "Admins can read progress for admin projects"
on public.build_progress for select
to authenticated
using (public.can_admin_collaborate_on_project(project_id));

create policy "Admins can update progress for admin projects"
on public.build_progress for update
to authenticated
using (public.can_admin_collaborate_on_project(project_id))
with check (
  public.can_admin_collaborate_on_project(project_id)
  and user_id = (
    select projects.user_id
    from public.projects
    where projects.id = build_progress.project_id
  )
);

create or replace function public.save_project_progress(
  p_project_id uuid,
  p_step_index integer,
  p_speed_ms integer,
  p_voice_enabled boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  project_owner_id uuid;
  project_line_count integer;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  select projects.user_id, projects.line_count
    into project_owner_id, project_line_count
  from public.projects
  where projects.id = p_project_id
    and (
      projects.user_id = (select auth.uid())
      or (
        public.is_admin((select auth.uid()))
        and public.is_admin(projects.user_id)
      )
    );

  if project_owner_id is null then
    raise exception 'Project was not found' using errcode = 'P0002';
  end if;

  if p_step_index < 0 or p_step_index > project_line_count then
    raise exception 'Build step is outside the project range' using errcode = '22023';
  end if;

  if p_speed_ms < 500 or p_speed_ms > 5000 then
    raise exception 'Build speed is outside the allowed range' using errcode = '22023';
  end if;

  insert into public.build_progress (
    project_id,
    user_id,
    step_index,
    speed_ms,
    voice_enabled
  ) values (
    p_project_id,
    project_owner_id,
    p_step_index,
    p_speed_ms,
    p_voice_enabled
  )
  on conflict (project_id) do update set
    user_id = excluded.user_id,
    step_index = excluded.step_index,
    speed_ms = excluded.speed_ms,
    voice_enabled = excluded.voice_enabled,
    updated_at = now();
end;
$$;

create policy "Admins can read admin preview files"
on storage.objects for select
to authenticated
using (
  bucket_id = 'project-previews'
  and public.is_admin((select auth.uid()))
  and public.is_admin_id_text((storage.foldername(name))[1])
);

revoke execute on function public.is_admin(uuid) from public, anon, authenticated;
grant execute on function public.is_admin(uuid) to authenticated;

revoke execute on function public.can_admin_collaborate_on_project(uuid) from public, anon, authenticated;
grant execute on function public.can_admin_collaborate_on_project(uuid) to authenticated;

revoke execute on function public.is_admin_id_text(text) from public, anon, authenticated;
grant execute on function public.is_admin_id_text(text) to authenticated;

revoke execute on function public.keep_project_owner() from public, anon, authenticated;

revoke execute on function public.save_project_progress(uuid, integer, integer, boolean)
from public, anon, authenticated;
grant execute on function public.save_project_progress(uuid, integer, integer, boolean)
to authenticated;
