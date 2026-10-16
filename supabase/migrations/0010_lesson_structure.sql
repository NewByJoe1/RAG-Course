-- 0010_lesson_structure.sql
-- Lesson restructure for beginners. Additive only: quiz_items, progress,
-- module_gate, submit_module_quiz and unlocking are unchanged.
--
--   modules            hook (one-line stakes), pipeline_stages ("you are
--                      here"), explain_back_prompt, video (pilot seam; null)
--   lesson_steps       new kind 'warm_up' (rendered right after the hook)
--   worked_example_steps  the step-through worked example
--   glossary_terms + module_glossary   one shared glossary, per-module subsets
--   study_guide_points must-recall points, each with a narration paragraph
--   explain_back_responses  the learner's own "explain it back" answers,
--                      private, append-only (feeds spaced review later)

-- ---------------------------------------------------------------------------
-- modules
-- ---------------------------------------------------------------------------

alter table public.modules
  add column hook                text,
  add column pipeline_stages     text[] not null default '{}'
    check (pipeline_stages <@ array['pre-retrieval', 'routing', 'hybrid-retrieval', 'post-retrieval', 're-rank', 'generation', 'eval-guardrails']::text[]),
  add column explain_back_prompt text,
  -- Pilot seam: { "src": url, "poster"?: url, "captions"?: url, "title": text }.
  add column video               jsonb check (video is null or (jsonb_typeof(video) = 'object' and video ? 'src' and video ? 'title'));

-- ---------------------------------------------------------------------------
-- lesson_steps: warm-up kind
-- ---------------------------------------------------------------------------

alter table public.lesson_steps drop constraint lesson_steps_kind_check;
alter table public.lesson_steps add constraint lesson_steps_kind_check
  check (kind in ('warm_up', 'concept', 'example', 'exercise', 'reflection'));

-- ---------------------------------------------------------------------------
-- Content tables (written by the seed; readable when the module is)
-- ---------------------------------------------------------------------------

create table public.worked_example_steps (
  id            text primary key,
  module_id     text not null references public.modules (id) on delete cascade,
  order_index   integer not null,
  title         text not null,
  body_md       text not null,
  code_snippet  text,
  code_language text,
  stage         text check (stage in ('pre-retrieval', 'routing', 'hybrid-retrieval', 'post-retrieval', 're-rank', 'generation', 'eval-guardrails')),
  -- What the running example ("Can we share this with a subcontractor?") looks like at this step.
  query_state   text,
  unique (module_id, order_index)
);

create table public.glossary_terms (
  id          text primary key,
  term        text not null,
  definition  text not null,
  stage       text check (stage in ('pre-retrieval', 'routing', 'hybrid-retrieval', 'post-retrieval', 're-rank', 'generation', 'eval-guardrails'))
);

create table public.module_glossary (
  module_id   text not null references public.modules (id) on delete cascade,
  term_id     text not null references public.glossary_terms (id) on delete cascade,
  order_index integer not null,
  primary key (module_id, term_id),
  unique (module_id, order_index)
);

create table public.study_guide_points (
  id          text primary key,
  module_id   text not null references public.modules (id) on delete cascade,
  order_index integer not null,
  point       text not null,
  narration   text not null,
  unique (module_id, order_index)
);

create index worked_example_steps_module_idx on public.worked_example_steps (module_id);
create index study_guide_points_module_idx on public.study_guide_points (module_id);

alter table public.worked_example_steps enable row level security;
alter table public.glossary_terms enable row level security;
alter table public.module_glossary enable row level security;
alter table public.study_guide_points enable row level security;

revoke all on public.worked_example_steps, public.glossary_terms, public.module_glossary, public.study_guide_points from anon, authenticated;
grant select on public.worked_example_steps, public.glossary_terms, public.module_glossary, public.study_guide_points to anon, authenticated;

create policy "worked_example_steps: read when module published"
  on public.worked_example_steps for select to anon, authenticated
  using (exists (select 1 from public.modules m where m.id = module_id and (m.is_published or public.is_admin())));

create policy "module_glossary: read when module published"
  on public.module_glossary for select to anon, authenticated
  using (exists (select 1 from public.modules m where m.id = module_id and (m.is_published or public.is_admin())));

create policy "study_guide_points: read when module published"
  on public.study_guide_points for select to anon, authenticated
  using (exists (select 1 from public.modules m where m.id = module_id and (m.is_published or public.is_admin())));

create policy "glossary_terms: readable"
  on public.glossary_terms for select to anon, authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- Explain it back: private, append-only
-- ---------------------------------------------------------------------------

create table public.explain_back_responses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  module_id   text not null references public.modules (id) on delete cascade,
  response    text not null check (length(btrim(response)) between 1 and 4000),
  created_at  timestamptz not null default now()
);

create index explain_back_responses_user_module_idx on public.explain_back_responses (user_id, module_id, created_at desc);

alter table public.explain_back_responses enable row level security;

revoke all on public.explain_back_responses from anon, authenticated;
grant select on public.explain_back_responses to authenticated;
grant insert (module_id, response) on public.explain_back_responses to authenticated;

create policy "explain_back_responses: read own"
  on public.explain_back_responses for select to authenticated
  using (user_id = (select auth.uid()));

create policy "explain_back_responses: write own"
  on public.explain_back_responses for insert to authenticated
  with check (user_id = (select auth.uid()));
