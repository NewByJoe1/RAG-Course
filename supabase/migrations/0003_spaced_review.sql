-- 0003_spaced_review.sql
-- Sprint 3: spaced review, daily reminder emails, streaks.
--
--   * Cards are created when a module is first passed: one per quiz item and
--     one per failure case, all first due in 2 days (interval_days = 2).
--     Wrong answers no longer create cards.
--   * Scheduling (again/hard/good/easy) lives in lib/scheduler.ts. Learners
--     write their own review_cards rows (RLS "review_cards: own") and log each
--     rating in review_log.
--   * Streak days = days with a quiz attempt or a review, in the learner's
--     timezone.
--   * profiles gains timezone, reminder opt-out and reminder hour.
--     last_review_reminder_at is written only by the reminder job.

-- ---------------------------------------------------------------------------
-- profiles: reminder + streak settings
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column timezone                text not null default 'UTC',
  add column review_reminders        boolean not null default true,
  add column reminder_hour           smallint not null default 9 check (reminder_hour between 0 and 23),
  add column last_review_reminder_at timestamptz;

grant update (timezone, review_reminders, reminder_hour) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- review_cards: a card is either a quiz item or a failure case
-- ---------------------------------------------------------------------------

alter table public.review_cards
  alter column quiz_item_id drop not null,
  add column failure_case_id text references public.failure_cases (id) on delete cascade,
  add constraint review_cards_one_source check (num_nonnulls(quiz_item_id, failure_case_id) = 1),
  add constraint review_cards_user_id_failure_case_id_key unique (user_id, failure_case_id);

-- ---------------------------------------------------------------------------
-- review_log: one row per rating (streak history + audit)
-- ---------------------------------------------------------------------------

create table public.review_log (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  card_id        uuid not null references public.review_cards (id) on delete cascade,
  rating         text not null check (rating in ('again', 'hard', 'good', 'easy')),
  interval_days  integer not null check (interval_days >= 0),
  reviewed_at    timestamptz not null default now()
);

create index review_log_user_reviewed_idx on public.review_log (user_id, reviewed_at desc);

alter table public.review_log enable row level security;

revoke all on public.review_log from anon, authenticated;
grant select, insert on public.review_log to authenticated;

create policy "review_log: read own"
  on public.review_log for select to authenticated
  using (user_id = (select auth.uid()));

create policy "review_log: insert own card"
  on public.review_log for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.review_cards rc where rc.id = card_id and rc.user_id = (select auth.uid()))
  );

-- ---------------------------------------------------------------------------
-- Enrol a learner's cards for a module (idempotent)
-- ---------------------------------------------------------------------------

create or replace function public.enroll_review_cards(p_user_id uuid, p_module_id text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_due   timestamptz := now() + interval '2 days';
  v_count integer;
  v_more  integer;
begin
  -- Cards left over from the pre-Sprint-3 "card per wrong answer" rule are
  -- reset to the 2-day start only if they were never reviewed.
  insert into public.review_cards (user_id, quiz_item_id, interval_days, due_at)
  select p_user_id, qi.id, 2, v_due
  from public.quiz_items qi
  where qi.module_id = p_module_id
  on conflict (user_id, quiz_item_id) do update
    set interval_days = 2, due_at = excluded.due_at
    where public.review_cards.last_reviewed_at is null;
  get diagnostics v_count = row_count;

  insert into public.review_cards (user_id, failure_case_id, interval_days, due_at)
  select p_user_id, fc.id, 2, v_due
  from public.failure_cases fc
  where fc.module_id = p_module_id
  on conflict (user_id, failure_case_id) do nothing;
  get diagnostics v_more = row_count;

  return v_count + v_more;
end;
$$;

revoke all on function public.enroll_review_cards(uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Grading RPCs: stop creating cards on wrong answers
-- ---------------------------------------------------------------------------

create or replace function public.submit_quiz_attempt(
  p_quiz_item_id text,
  p_response     jsonb
)
returns table (is_correct boolean, correct_answer jsonb, explanation text)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user_id  uuid := auth.uid();
  v_item     public.quiz_items%rowtype;
  v_correct  boolean;
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select qi.* into v_item
  from public.quiz_items qi
  join public.modules m on m.id = qi.module_id
  where qi.id = p_quiz_item_id
    and (m.is_published or public.is_admin());

  if not found then
    raise exception 'quiz item % not found', p_quiz_item_id using errcode = 'P0002';
  end if;

  v_correct := public.grade_quiz_response(v_item.kind, v_item.answer, p_response);

  insert into public.quiz_attempts (user_id, quiz_item_id, response, is_correct)
  values (v_user_id, v_item.id, p_response, v_correct);

  return query select v_correct, v_item.answer, v_item.explanation;
end;
$$;

create or replace function public.submit_module_quiz(
  p_module_id  text,
  p_responses  jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id      uuid := auth.uid();
  v_slug         text;
  v_unlocked     boolean;
  v_item         public.quiz_items%rowtype;
  v_response     jsonb;
  v_correct      boolean;
  v_total        integer := 0;
  v_right        integer := 0;
  v_score        numeric(5, 4);
  v_passed       boolean;
  v_first_pass   boolean;
  v_enrolled     integer := 0;
  v_results      jsonb := '[]'::jsonb;
  v_progress     public.progress%rowtype;
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if p_responses is null or jsonb_typeof(p_responses) <> 'object' then
    raise exception 'responses must be a JSON object keyed by quiz item id' using errcode = '22023';
  end if;

  select m.slug into v_slug
  from public.modules m
  where m.id = p_module_id and (m.is_published or public.is_admin());

  if not found then
    raise exception 'module % not found', p_module_id using errcode = 'P0002';
  end if;

  select g.unlocked into v_unlocked from public.module_gate(v_slug) g;
  if not coalesce(v_unlocked, false) then
    raise exception 'module % is locked', p_module_id using errcode = '42501', hint = 'module_locked';
  end if;

  for v_item in
    select * from public.quiz_items qi
    where qi.module_id = p_module_id
    order by qi.order_index
  loop
    v_total := v_total + 1;
    v_response := p_responses -> v_item.id;

    if v_response is null or jsonb_typeof(v_response) <> 'object' then
      v_correct := false;
    else
      v_correct := public.grade_quiz_response(v_item.kind, v_item.answer, v_response);
      insert into public.quiz_attempts (user_id, quiz_item_id, response, is_correct)
      values (v_user_id, v_item.id, v_response, v_correct);
    end if;

    if v_correct then
      v_right := v_right + 1;
    end if;

    v_results := v_results || jsonb_build_object(
      'quiz_item_id',   v_item.id,
      'answered',       v_response is not null,
      'is_correct',     v_correct,
      'correct_answer', v_item.answer,
      'explanation',    v_item.explanation
    );
  end loop;

  if v_total = 0 then
    raise exception 'module % has no quiz items', p_module_id using errcode = 'P0002';
  end if;

  v_score  := v_right::numeric / v_total;
  v_passed := v_score >= public.quiz_pass_threshold();

  v_first_pass := v_passed and not exists (
    select 1 from public.progress pr
    where pr.user_id = v_user_id and pr.module_id = p_module_id and pr.passed_at is not null
  );

  insert into public.progress as pr (
    user_id, module_id, status, started_at, last_score, best_score,
    passed_at, completed_at, quiz_attempt_count
  )
  values (
    v_user_id, p_module_id,
    case when v_passed then 'completed' else 'in_progress' end,
    now(), v_score, v_score,
    case when v_passed then now() end,
    case when v_passed then now() end,
    1
  )
  on conflict (user_id, module_id) do update set
    last_score         = excluded.last_score,
    best_score         = greatest(coalesce(pr.best_score, 0), excluded.best_score),
    passed_at          = coalesce(pr.passed_at, excluded.passed_at),
    completed_at       = coalesce(pr.completed_at, excluded.completed_at),
    status             = case
                           when coalesce(pr.passed_at, excluded.passed_at) is not null then 'completed'
                           else 'in_progress'
                         end,
    started_at         = coalesce(pr.started_at, excluded.started_at),
    quiz_attempt_count = pr.quiz_attempt_count + 1
  returning * into v_progress;

  if v_first_pass then
    v_enrolled := public.enroll_review_cards(v_user_id, p_module_id);
  end if;

  return jsonb_build_object(
    'module_id',      p_module_id,
    'correct',        v_right,
    'total',          v_total,
    'score',          v_score,
    'threshold',      public.quiz_pass_threshold(),
    'passed',         v_passed,
    'best_score',     v_progress.best_score,
    'passed_at',      v_progress.passed_at,
    'cards_enrolled', v_enrolled,
    'results',        v_results
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Reminder job: learners with reminders on and at least one card due.
-- Called with the service role from /api/cron/review-reminders.
-- ---------------------------------------------------------------------------

create or replace function public.review_reminder_candidates(p_now timestamptz default now())
returns table (
  user_id                 uuid,
  email                   text,
  display_name            text,
  timezone                text,
  reminder_hour           smallint,
  due_count               integer,
  last_review_reminder_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.email, p.display_name, p.timezone, p.reminder_hour,
         count(rc.id)::integer, p.last_review_reminder_at
  from public.profiles p
  join public.review_cards rc on rc.user_id = p.id and rc.due_at <= p_now
  where p.review_reminders
    and p.email is not null
  group by p.id;
$$;

revoke all on function public.review_reminder_candidates(timestamptz) from public, anon, authenticated;
grant execute on function public.review_reminder_candidates(timestamptz) to service_role;

-- ---------------------------------------------------------------------------
-- Streak history: days with a quiz attempt or a review, bucketed in the
-- learner's profile timezone. Unknown timezones fall back to UTC.
-- ---------------------------------------------------------------------------

create or replace function public.my_activity_days(p_since date default null)
returns table (day date, events integer)
language sql
stable
set search_path = ''
as $$
  with tz as (
    select coalesce(
      (select n.name from pg_catalog.pg_timezone_names n
        join public.profiles p on p.timezone = n.name
        where p.id = auth.uid()),
      'UTC'
    ) as name
  ),
  events as (
    select qa.attempted_at as at from public.quiz_attempts qa where qa.user_id = auth.uid()
    union all
    select rl.reviewed_at from public.review_log rl where rl.user_id = auth.uid()
  )
  select (e.at at time zone tz.name)::date as day, count(*)::integer
  from events e, tz
  where p_since is null or (e.at at time zone tz.name)::date >= p_since
  group by 1
  order by 1;
$$;

revoke all on function public.my_activity_days(date) from public, anon;
grant execute on function public.my_activity_days(date) to authenticated;

-- ---------------------------------------------------------------------------
-- Backfill: learners who passed modules before this migration get their
-- review deck now, first due 2 days from when the migration runs. Idempotent.
-- ---------------------------------------------------------------------------

do $$
declare
  r record;
begin
  for r in select pr.user_id, pr.module_id from public.progress pr where pr.passed_at is not null loop
    perform public.enroll_review_cards(r.user_id, r.module_id);
  end loop;
end;
$$;
