-- 0004_capstone.sql
-- Sprint 4: capstone CI checks.
--
--   * profiles.github_repo: the learner's fork of the course template, as
--     "owner/name". One learner per repo. Changing it clears their checks.
--   * capstone_checks: one row per learner per branch (check_key = branch),
--     written by the poll-ci edge function (service role) and, for the manual
--     'defence' criterion, by a reviewer via set_capstone_defence(). Learners
--     can read their rows but no longer write them (0001 let them).
--   * progress.mastered_at: set for the capstone module (m12) by
--     claim_capstone_mastery() once all six criteria are met on main.

-- ---------------------------------------------------------------------------
-- profiles.github_repo
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column github_repo text
    check (github_repo ~ '^[A-Za-z0-9][A-Za-z0-9-]{0,38}/[A-Za-z0-9._-]{1,100}$' and github_repo !~ '/\.\.?$');

create unique index profiles_github_repo_key on public.profiles (lower(github_repo));

grant update (github_repo) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- capstone_checks: CI state per branch
-- ---------------------------------------------------------------------------

alter table public.capstone_checks
  add column ci_status      text check (ci_status in ('success', 'failure', 'cancelled', 'in_progress', 'queued', 'no_runs', 'error')),
  add column last_run_at    timestamptz,
  add column run_id         bigint,
  add column run_url        text,
  add column head_sha       text,
  add column criteria_met   text[] not null default '{}'
    check (criteria_met <@ array['recall', 'citation', 'isolation', 'nightly', 'kill_switch', 'defence']::text[]),
  add column results        jsonb,
  add column results_run_id bigint,
  add column error          text,
  add column polled_at      timestamptz,
  add constraint capstone_checks_branch check (check_key in (
    'naive-rag', 'pre-retrieval', 'hybrid-retrieval', 'post-retrieval', 'rerank', 'fine-tuned',
    'eval', 'automation', 'harness', 'legal-domain', 'legal-embeddings', 'main'
  )),
  -- Only main carries the manual 'defence' criterion.
  add constraint capstone_checks_defence_on_main check (check_key = 'main' or not ('defence' = any (criteria_met)));

-- Learners: read-only. Writes come from the service role and reviewer RPCs.
revoke insert, update, delete on public.capstone_checks from authenticated;
drop policy "capstone_checks: own" on public.capstone_checks;

create policy "capstone_checks: read own or admin"
  on public.capstone_checks for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

-- Pointing at a different repo invalidates everything recorded for the old one.
create or replace function public.reset_capstone_checks_on_repo_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.github_repo is distinct from old.github_repo then
    delete from public.capstone_checks where user_id = new.id;
  end if;
  return new;
end;
$$;

create trigger profiles_github_repo_changed
  after update of github_repo on public.profiles
  for each row execute function public.reset_capstone_checks_on_repo_change();

revoke all on function public.reset_capstone_checks_on_repo_change() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Reviewer: the manual 'defence' criterion
-- ---------------------------------------------------------------------------

create or replace function public.set_capstone_defence(p_user_id uuid, p_passed boolean)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_met text[];
begin
  if not public.is_admin() then
    raise exception 'only reviewers can set the defence criterion' using errcode = '42501';
  end if;

  insert into public.capstone_checks as cc (user_id, check_key, criteria_met)
  values (p_user_id, 'main', case when p_passed then array['defence'] else '{}' end)
  on conflict (user_id, check_key) do update
    set criteria_met = case
          when p_passed then array(select distinct unnest(cc.criteria_met || array['defence']))
          else array_remove(cc.criteria_met, 'defence')
        end
  returning criteria_met into v_met;

  return v_met;
end;
$$;

revoke all on function public.set_capstone_defence(uuid, boolean) from public, anon;
grant execute on function public.set_capstone_defence(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Capstone mastery (Module 12)
-- ---------------------------------------------------------------------------

alter table public.progress add column mastered_at timestamptz;
-- (Clients already can't write it: 0002 limits their insert/update columns.)

create or replace function public.capstone_module_id()
returns text
language sql
immutable
as $$ select 'm12'::text $$;

-- Records mastery for the current learner if main meets all six criteria.
-- Idempotent: the first mastered_at is kept. Returns it, or null if not met.
create or replace function public.claim_capstone_mastery()
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
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if not exists (
    select 1 from public.capstone_checks cc
    where cc.user_id = v_user
      and cc.check_key = 'main'
      and cc.criteria_met @> array['recall', 'citation', 'isolation', 'nightly', 'kill_switch', 'defence']::text[]
  ) then
    return null;
  end if;

  insert into public.progress as pr (user_id, module_id, status, started_at, completed_at, mastered_at)
  values (v_user, public.capstone_module_id(), 'completed', now(), now(), now())
  on conflict (user_id, module_id) do update
    set status       = 'completed',
        completed_at = coalesce(pr.completed_at, excluded.completed_at),
        mastered_at  = coalesce(pr.mastered_at, excluded.mastered_at)
  returning mastered_at into v_at;

  return v_at;
end;
$$;

revoke all on function public.claim_capstone_mastery() from public, anon;
grant execute on function public.claim_capstone_mastery() to authenticated;
