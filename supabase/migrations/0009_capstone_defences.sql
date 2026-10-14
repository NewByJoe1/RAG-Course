-- 0009_capstone_defences.sql
-- Reviewer-recorded oral defences for the capstone (Module 12, Day 5).
--
--   * profiles.is_reviewer: a capability separate from role, so an admin can
--     also be a reviewer. Learners can't set it (not in their column grants).
--   * capstone_defences: append-only history. Reviewers insert directly under
--     RLS; a reviewer can never record their own defence. Triggers set the
--     reviewer, timestamp and pass/fail result (clients can't supply them),
--     then apply the result to the 'defence' criterion on main and record
--     mastery through the same function the capstone page uses.
--   * A defence passes only if all six questions pass with a verified
--     citation AND the closing question passes. The latest defence counts.
--   * set_capstone_defence() (admin shortcut from 0004) is dropped: defence
--     now changes only by recording a defence.

-- ---------------------------------------------------------------------------
-- Reviewers
-- ---------------------------------------------------------------------------

alter table public.profiles add column is_reviewer boolean not null default false;

create or replace function public.is_reviewer()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_reviewer);
$$;

revoke all on function public.is_reviewer() from public, anon;
grant execute on function public.is_reviewer() to authenticated;

-- Reviewers can see learners who've linked a capstone repo, and other reviewers.
create policy "profiles: reviewers read capstone learners"
  on public.profiles for select to authenticated
  using (public.is_reviewer() and (github_repo is not null or is_reviewer));

create policy "capstone_checks: reviewers read"
  on public.capstone_checks for select to authenticated
  using (public.is_reviewer());

-- ---------------------------------------------------------------------------
-- Mastery: one path for both the capstone page and recorded defences
-- ---------------------------------------------------------------------------

-- Internal: records mastery for p_user if main meets all six criteria. Keeps
-- the first mastered_at. Returns it, or null if not met.
create or replace function public.grant_capstone_mastery(p_user uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_at timestamptz;
begin
  if not exists (
    select 1 from public.capstone_checks cc
    where cc.user_id = p_user
      and cc.check_key = 'main'
      and cc.criteria_met @> array['recall', 'citation', 'isolation', 'nightly', 'kill_switch', 'defence']::text[]
  ) then
    return null;
  end if;

  insert into public.progress as pr (user_id, module_id, status, started_at, completed_at, mastered_at)
  values (p_user, public.capstone_module_id(), 'completed', now(), now(), now())
  on conflict (user_id, module_id) do update
    set status       = 'completed',
        completed_at = coalesce(pr.completed_at, excluded.completed_at),
        mastered_at  = coalesce(pr.mastered_at, excluded.mastered_at)
  returning mastered_at into v_at;

  return v_at;
end;
$$;

revoke all on function public.grant_capstone_mastery(uuid) from public, anon, authenticated;

-- The capstone page's entry point, now delegating to the shared function.
create or replace function public.claim_capstone_mastery()
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  return public.grant_capstone_mastery(auth.uid());
end;
$$;

drop function public.set_capstone_defence(uuid, boolean);

-- ---------------------------------------------------------------------------
-- Defences
-- ---------------------------------------------------------------------------

-- Six objects: { question: non-empty text, citation_verified: bool,
-- passed: bool, note?: text|null }. IS DISTINCT FROM so a missing key fails
-- the check instead of evaluating to NULL (which a CHECK treats as passing).
create or replace function public.capstone_defence_questions_valid(q jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when jsonb_typeof(q) is distinct from 'array' then false
    when jsonb_array_length(q) <> 6 then false
    else not exists (
      select 1
      from jsonb_array_elements(q) e
      where jsonb_typeof(e) is distinct from 'object'
         or jsonb_typeof(e -> 'question') is distinct from 'string'
         or length(btrim(e ->> 'question')) = 0
         or jsonb_typeof(e -> 'citation_verified') is distinct from 'boolean'
         or jsonb_typeof(e -> 'passed') is distinct from 'boolean'
         or coalesce(jsonb_typeof(e -> 'note'), 'null') not in ('string', 'null')
    )
  end;
$$;

create table public.capstone_defences (
  id              uuid primary key default gen_random_uuid(),
  learner_id      uuid not null references public.profiles (id) on delete cascade,
  reviewer_id     uuid not null default auth.uid() references public.profiles (id),
  recorded_at     timestamptz not null default now(),
  questions       jsonb not null check (public.capstone_defence_questions_valid(questions)),
  closing_passed  boolean not null,
  closing_note    text,
  passed          boolean not null default false,
  constraint capstone_defences_not_self check (reviewer_id <> learner_id)
);

create index capstone_defences_learner_recorded_idx on public.capstone_defences (learner_id, recorded_at desc);

-- Server-set fields: who recorded it, when, and whether it passed.
create or replace function public.capstone_defence_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null then
    new.reviewer_id := auth.uid();
  end if;
  new.recorded_at := now();
  -- Malformed questions are rejected by the table's CHECK, which runs after
  -- this trigger; don't try to read them here.
  if not public.capstone_defence_questions_valid(new.questions) then
    new.passed := false;
    return new;
  end if;
  new.passed := new.closing_passed and not exists (
    select 1 from jsonb_array_elements(new.questions) e
    where not ((e ->> 'passed')::boolean and (e ->> 'citation_verified')::boolean)
  );
  return new;
end;
$$;

create trigger capstone_defences_before_insert
  before insert on public.capstone_defences
  for each row execute function public.capstone_defence_before_insert();

-- Apply the newest defence to main's 'defence' criterion, then record
-- mastery if that completes all six.
create or replace function public.capstone_defence_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_met text[];
begin
  insert into public.capstone_checks as cc (user_id, check_key, criteria_met)
  values (new.learner_id, 'main', case when new.passed then array['defence'] else '{}' end)
  on conflict (user_id, check_key) do update
    set criteria_met = case
          when new.passed then
            case when 'defence' = any (cc.criteria_met) then cc.criteria_met else array_append(cc.criteria_met, 'defence') end
          else array_remove(cc.criteria_met, 'defence')
        end
  returning criteria_met into v_met;

  if new.passed then
    perform public.grant_capstone_mastery(new.learner_id);
  end if;
  return null;
end;
$$;

create trigger capstone_defences_after_insert
  after insert on public.capstone_defences
  for each row execute function public.capstone_defence_after_insert();

revoke all on function public.capstone_defence_after_insert() from public, anon, authenticated;

-- Append-only, reviewers only. Clients may supply just the answers; the
-- reviewer, timestamp and result come from the triggers above.
alter table public.capstone_defences enable row level security;

revoke all on public.capstone_defences from anon, authenticated;
grant select on public.capstone_defences to authenticated;
grant insert (learner_id, questions, closing_passed, closing_note) on public.capstone_defences to authenticated;

create policy "capstone_defences: reviewers read"
  on public.capstone_defences for select to authenticated
  using (public.is_reviewer());

create policy "capstone_defences: reviewers record other learners"
  on public.capstone_defences for insert to authenticated
  with check (
    public.is_reviewer()
    and reviewer_id = (select auth.uid())
    and learner_id <> (select auth.uid())
    and exists (select 1 from public.profiles p where p.id = learner_id and p.github_repo is not null)
  );
