-- Share the same buyer QR lifecycle across collaborators on admin-owned projects.
-- Ordinary users retain owner-only access; public token reads remain unchanged.
create policy "Admins can read shared patterns for admin projects"
on public.shared_patterns for select
to authenticated
using (public.can_admin_collaborate_on_project(project_id));

create policy "Admins can update shared patterns for admin projects"
on public.shared_patterns for update
to authenticated
using (public.can_admin_collaborate_on_project(project_id))
with check (
  public.can_admin_collaborate_on_project(project_id)
  and owner_id = (
    select projects.user_id
    from public.projects
    where projects.id = shared_patterns.project_id
  )
);

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
    and (
      projects.user_id = (select auth.uid())
      or public.can_admin_collaborate_on_project(projects.id)
    )
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

revoke execute on function public.publish_shared_pattern(uuid) from public, anon, authenticated;
grant execute on function public.publish_shared_pattern(uuid) to authenticated;
