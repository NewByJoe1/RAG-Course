-- 0001_init.sql
-- Core schema for the RAG course: authored content (modules, lesson_steps,
-- quiz_items, failure_cases) and per-learner state (profiles, quiz_attempts,
-- review_cards, progress, capstone_checks).
--
-- Conventions
--   * Authored content uses stable text ids (e.g. 'm01', 'm01-s03', 'm01-q02')
--     so scripts/seed.ts can upsert idempotently and learner rows keep pointing
--     at the same content across reseeds.
--   * Learner tables are keyed to profiles.id (= auth.users.id) and locked to
--     the owner via RLS.
--   * Quiz answer keys are never readable by clients. Grading happens in
--     public.submit_quiz_attempt(), which also records the attempt, so
--     is_correct cannot be forged.
--   * The seed script uses the service-role key, which bypasses RLS.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  email         text,
  display_name  text,
  avatar_url    text,
  role          text not null default 'learner' check (role in ('learner', 'admin')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Defined after profiles because it reads from it. SECURITY DEFINER so it can
-- be called from RLS policies on profiles without recursing into them.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------------
-- Content: modules
-- ---------------------------------------------------------------------------

create table public.modules (
  id                   text primary key,
  slug                 text not null unique,
  order_index          integer not null unique,
  title                text not null,
  summary              text not null default '',
  learning_objectives  text[] not null default '{}',
  estimated_minutes    integer not null default 0 check (estimated_minutes >= 0),
  is_published         boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create trigger modules_set_updated_at
  before update on public.modules
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Content: lesson_steps
-- ---------------------------------------------------------------------------

create table public.lesson_steps (
  id            text primary key,
  module_id     text not null references public.modules (id) on delete cascade,
  order_index   integer not null,
  kind          text not null check (kind in ('concept', 'example', 'exercise', 'reflection')),
  title         text not null,
  body_md       text not null,
  code_snippet  text,
  code_language text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (module_id, order_index)
);

create index lesson_steps_module_id_idx on public.lesson_steps (module_id);

create trigger lesson_steps_set_updated_at
  before update on public.lesson_steps
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Content: quiz_items
--   choices: [{ "id": "a", "text": "..." }, ...]   (null for short_answer)
--   answer:  single_choice -> { "choice": "b" }
--            multi_choice  -> { "choices": ["a", "c"] }
--            short_answer  -> { "accepted": ["cosine similarity", "cosine"] }
--   `answer` and `explanation` are hidden from clients by column grants below.
-- ---------------------------------------------------------------------------

create table public.quiz_items (
  id              text primary key,
  module_id       text not null references public.modules (id) on delete cascade,
  lesson_step_id  text references public.lesson_steps (id) on delete set null,
  order_index     integer not null,
  kind            text not null check (kind in ('single_choice', 'multi_choice', 'short_answer')),
  prompt          text not null,
  choices         jsonb,
  answer          jsonb not null,
  explanation     text not null default '',
  difficulty      smallint not null default 1 check (difficulty between 1 and 3),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (module_id, order_index),
  check (
    (kind = 'short_answer' and choices is null)
    or (kind <> 'short_answer' and jsonb_typeof(choices) = 'array')
  )
);

create index quiz_items_module_id_idx on public.quiz_items (module_id);
create index quiz_items_lesson_step_id_idx on public.quiz_items (lesson_step_id);

create trigger quiz_items_set_updated_at
  before update on public.quiz_items
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Content: failure_cases (worked examples of RAG pipelines going wrong)
-- ---------------------------------------------------------------------------

create table public.failure_cases (
  id                 text primary key,
  module_id          text not null references public.modules (id) on delete cascade,
  order_index        integer not null,
  title              text not null,
  category           text not null check (category in (
                       'retrieval_miss', 'chunking', 'ranking', 'context_overflow',
                       'hallucination', 'stale_index', 'prompt'
                     )),
  user_query         text not null,
  retrieved_context  jsonb not null default '[]'::jsonb,
  bad_output         text not null,
  symptom            text not null,
  root_cause         text not null,
  fix                text not null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (module_id, order_index)
);

create index failure_cases_module_id_idx on public.failure_cases (module_id);

create trigger failure_cases_set_updated_at
  before update on public.failure_cases
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Learner: quiz_attempts (insert only via submit_quiz_attempt)
-- ---------------------------------------------------------------------------

create table public.quiz_attempts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  quiz_item_id  text not null references public.quiz_items (id) on delete cascade,
  response      jsonb not null,
  is_correct    boolean not null,
  attempted_at  timestamptz not null default now()
);

create index quiz_attempts_user_item_idx on public.quiz_attempts (user_id, quiz_item_id, attempted_at desc);

-- ---------------------------------------------------------------------------
-- Learner: review_cards (spaced repetition, SM-2 style fields)
-- ---------------------------------------------------------------------------

create table public.review_cards (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  quiz_item_id      text not null references public.quiz_items (id) on delete cascade,
  ease_factor       numeric(4, 2) not null default 2.50 check (ease_factor >= 1.30),
  interval_days     integer not null default 0 check (interval_days >= 0),
  repetitions       integer not null default 0 check (repetitions >= 0),
  lapses            integer not null default 0 check (lapses >= 0),
  due_at            timestamptz not null default now(),
  last_reviewed_at  timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (user_id, quiz_item_id)
);

create index review_cards_user_due_idx on public.review_cards (user_id, due_at);

create trigger review_cards_set_updated_at
  before update on public.review_cards
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Learner: progress (one row per learner per module)
-- ---------------------------------------------------------------------------

create table public.progress (
  user_id             uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  module_id           text not null references public.modules (id) on delete cascade,
  status              text not null default 'not_started'
                        check (status in ('not_started', 'in_progress', 'completed')),
  current_step_id     text references public.lesson_steps (id) on delete set null,
  completed_step_ids  text[] not null default '{}',
  started_at          timestamptz,
  completed_at        timestamptz,
  updated_at          timestamptz not null default now(),
  primary key (user_id, module_id)
);

create trigger progress_set_updated_at
  before update on public.progress
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Learner: capstone_checks (per-learner checklist for the capstone project)
--   check_key identifies the requirement (e.g. 'eval-harness', 'citations').
-- ---------------------------------------------------------------------------

create table public.capstone_checks (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  check_key     text not null,
  status        text not null default 'pending' check (status in ('pending', 'pass', 'fail')),
  evidence_url  text,
  notes         text,
  details       jsonb not null default '{}'::jsonb,
  checked_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, check_key)
);

create trigger capstone_checks_set_updated_at
  before update on public.capstone_checks
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Signup trigger: create a profile for every new auth user
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'name', ''),
      split_part(coalesce(new.email, ''), '@', 1)
    ),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Grading RPC
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

  v_correct := case v_item.kind
    when 'single_choice' then
      coalesce(p_response ->> 'choice' = v_item.answer ->> 'choice', false)
    when 'multi_choice' then
      coalesce(
        (select array_agg(distinct x order by x)
           from jsonb_array_elements_text(coalesce(p_response -> 'choices', '[]'::jsonb)) x)
        =
        (select array_agg(distinct x order by x)
           from jsonb_array_elements_text(v_item.answer -> 'choices') x),
        false
      )
    when 'short_answer' then
      exists (
        select 1
        from jsonb_array_elements_text(v_item.answer -> 'accepted') a
        where lower(btrim(a)) = lower(btrim(coalesce(p_response ->> 'text', '')))
      )
    else false
  end;

  insert into public.quiz_attempts (user_id, quiz_item_id, response, is_correct)
  values (v_user_id, v_item.id, p_response, v_correct);

  -- Missed questions go into the learner's review deck, due immediately.
  if not v_correct then
    insert into public.review_cards (user_id, quiz_item_id, due_at)
    values (v_user_id, v_item.id, now())
    on conflict (user_id, quiz_item_id) do update
      set due_at = least(public.review_cards.due_at, excluded.due_at);
  end if;

  return query select v_correct, v_item.answer, v_item.explanation;
end;
$$;

revoke all on function public.submit_quiz_attempt(text, jsonb) from public, anon;
grant execute on function public.submit_quiz_attempt(text, jsonb) to authenticated;

revoke all on function public.handle_new_user() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Table privileges (explicit, so behavior doesn't depend on project defaults)
-- ---------------------------------------------------------------------------

grant usage on schema public to anon, authenticated;

-- Content is readable by everyone (RLS restricts to published modules);
-- writes are admin-only via RLS.
grant select on public.modules, public.lesson_steps, public.failure_cases to anon, authenticated;
grant insert, update, delete on public.modules, public.lesson_steps, public.failure_cases to authenticated;

-- quiz_items: hide answer + explanation from clients. Select explicit columns
-- (not `*`) from the client; use submit_quiz_attempt() to grade.
revoke all on public.quiz_items from anon, authenticated;
grant select (id, module_id, lesson_step_id, order_index, kind, prompt, choices, difficulty, created_at, updated_at)
  on public.quiz_items to anon, authenticated;

-- profiles: learners may only change cosmetic fields, never role/email.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name, avatar_url) on public.profiles to authenticated;

-- quiz_attempts: read-only for clients; inserts go through the RPC.
revoke all on public.quiz_attempts from anon, authenticated;
grant select on public.quiz_attempts to authenticated;

revoke all on public.review_cards, public.progress, public.capstone_checks from anon;
grant select, insert, update, delete on public.review_cards, public.progress, public.capstone_checks to authenticated;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.profiles         enable row level security;
alter table public.modules          enable row level security;
alter table public.lesson_steps     enable row level security;
alter table public.quiz_items       enable row level security;
alter table public.failure_cases    enable row level security;
alter table public.quiz_attempts    enable row level security;
alter table public.review_cards     enable row level security;
alter table public.progress         enable row level security;
alter table public.capstone_checks  enable row level security;

-- profiles
create policy "profiles: read own or admin"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.is_admin());

create policy "profiles: update own"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- modules
create policy "modules: read published"
  on public.modules for select to anon, authenticated
  using (is_published or public.is_admin());

create policy "modules: admin write"
  on public.modules for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- lesson_steps / quiz_items / failure_cases: visible when parent module is
create policy "lesson_steps: read when module published"
  on public.lesson_steps for select to anon, authenticated
  using (exists (
    select 1 from public.modules m
    where m.id = module_id and (m.is_published or public.is_admin())
  ));

create policy "lesson_steps: admin write"
  on public.lesson_steps for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "quiz_items: read when module published"
  on public.quiz_items for select to anon, authenticated
  using (exists (
    select 1 from public.modules m
    where m.id = module_id and (m.is_published or public.is_admin())
  ));

create policy "failure_cases: read when module published"
  on public.failure_cases for select to anon, authenticated
  using (exists (
    select 1 from public.modules m
    where m.id = module_id and (m.is_published or public.is_admin())
  ));

create policy "failure_cases: admin write"
  on public.failure_cases for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- quiz_attempts: owner can read; no client insert/update/delete policies
create policy "quiz_attempts: read own"
  on public.quiz_attempts for select to authenticated
  using (user_id = (select auth.uid()));

-- review_cards / progress / capstone_checks: full CRUD on own rows
create policy "review_cards: own"
  on public.review_cards for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "progress: own"
  on public.progress for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "capstone_checks: own"
  on public.capstone_checks for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
