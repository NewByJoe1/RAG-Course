-- Module 0, "Set up your workshop".
--
-- Module 0 has no quiz. A learner finishes it by ticking "My setup works",
-- which records it as passed through public.complete_setup(). module_gate
-- needs no change: Module 0 has order_index 0, so once it is published it is
-- Module 1's previous module, and Module 1 unlocks when it is passed.

-- The row exists before the seed fills it in (unpublished, so the gate ignores
-- it until then), so the backfill below can reference it. The seed publishes it.
insert into public.modules (id, slug, order_index, title, is_published)
values ('m00', 'setup', 0, 'Set up your workshop', false)
on conflict (id) do nothing;

-- Learners who have already started the course keep Module 1 open.
insert into public.progress (user_id, module_id, status, started_at, completed_at, passed_at)
select distinct p.user_id, 'm00', 'completed', now(), now(), now()
from public.progress p
where p.module_id <> 'm00'
on conflict (user_id, module_id) do nothing;

-- "My setup works": marks Module 0 passed for the signed-in learner. Clients
-- can't write progress directly (0002), so this is the only way in.
create or replace function public.complete_setup()
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_at   timestamptz;
begin
  if v_user is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.modules where id = 'm00' and is_published) then
    raise exception 'The set-up module is not published.' using errcode = 'P0002';
  end if;

  insert into public.progress as pr (user_id, module_id, status, started_at, completed_at, passed_at)
  values (v_user, 'm00', 'completed', now(), now(), now())
  on conflict (user_id, module_id) do update
    set status       = 'completed',
        completed_at = coalesce(pr.completed_at, excluded.completed_at),
        passed_at    = coalesce(pr.passed_at, excluded.passed_at)
  returning pr.passed_at into v_at;

  return v_at;
end;
$$;

revoke all on function public.complete_setup() from public, anon;
grant execute on function public.complete_setup() to authenticated;
