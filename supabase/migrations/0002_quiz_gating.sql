-- 0002_quiz_gating.sql
-- Sprint 2: module quizzes, the 80% pass gate, and module unlocking.
--
--   * progress gains score + pass columns. Clients can no longer write the
--     pass/score columns; only submit_module_quiz() sets them, so the gate
--     can't be forged from the browser.
--   * grade_quiz_response() is the single grading routine, shared by
--     submit_quiz_attempt() (single item, review deck) and
--     submit_module_quiz() (whole module, pass gate).
--   * A module is unlocked when it is the first published module, or the
--     learner has passed the previous published module (by order_index).

-- ---------------------------------------------------------------------------
-- progress: score + pass state
-- ---------------------------------------------------------------------------

alter table public.progress
  add column last_score          numeric(5, 4) check (last_score between 0 and 1),
  add column best_score          numeric(5, 4) check (best_score between 0 and 1),
  add column passed_at           timestamptz,
  add column quiz_attempt_count  integer not null default 0 check (quiz_attempt_count >= 0);

-- Clients keep control of lesson position, but not of scores or pass state.
revoke insert, update on public.progress from authenticated;
grant insert (user_id, module_id, status, current_step_id, completed_step_ids, started_at)
  on public.progress to authenticated;
grant update (status, current_step_id, completed_step_ids, started_at)
  on public.progress to authenticated;

-- ---------------------------------------------------------------------------
-- Pass threshold (single source of truth; the app reads it via the RPC result)
-- ---------------------------------------------------------------------------

create or replace function public.quiz_pass_threshold()
returns numeric
language sql
immutable
as $$ select 0.80::numeric $$;

-- ---------------------------------------------------------------------------
-- Grading
-- ---------------------------------------------------------------------------

create or replace function public.grade_quiz_response(
  p_kind      text,
  p_answer    jsonb,
  p_response  jsonb
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case p_kind
    when 'single_choice' then
      coalesce(p_response ->> 'choice' = p_answer ->> 'choice', false)
    when 'multi_choice' then
      coalesce(
        (select array_agg(distinct x order by x)
           from jsonb_array_elements_text(
             case when jsonb_typeof(p_response -> 'choices') = 'array'
                  then p_response -> 'choices' else '[]'::jsonb end) x)
        =
        (select array_agg(distinct x order by x)
           from jsonb_array_elements_text(p_answer -> 'choices') x),
        false
      )
    when 'short_answer' then
      exists (
        select 1
        from jsonb_array_elements_text(p_answer -> 'accepted') a
        where lower(btrim(a)) = lower(btrim(coalesce(p_response ->> 'text', '')))
      )
    else false
  end;
$$;

-- Re-point the single-item RPC at the shared grader.
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

  if not v_correct then
    insert into public.review_cards (user_id, quiz_item_id, due_at)
    values (v_user_id, v_item.id, now())
    on conflict (user_id, quiz_item_id) do update
      set due_at = least(public.review_cards.due_at, excluded.due_at);
  end if;

  return query select v_correct, v_item.answer, v_item.explanation;
end;
$$;

-- ---------------------------------------------------------------------------
-- Gating
-- ---------------------------------------------------------------------------

-- Unlock state for the current user. SECURITY DEFINER so it sees unpublished
-- modules only to skip them; it never returns their content.
create or replace function public.module_gate(p_slug text)
returns table (
  module_id       text,
  slug            text,
  unlocked        boolean,
  prev_module_id  text,
  prev_slug       text,
  prev_title      text
)
language sql
stable
security definer
set search_path = ''
as $$
  with target as (
    select m.id, m.slug, m.order_index
    from public.modules m
    where m.slug = p_slug and (m.is_published or public.is_admin())
  ),
  prev as (
    select m.id, m.slug, m.title
    from public.modules m, target t
    where m.is_published and m.order_index < t.order_index
    order by m.order_index desc
    limit 1
  )
  select
    t.id,
    t.slug,
    (p.id is null) or exists (
      select 1 from public.progress pr
      where pr.user_id = auth.uid()
        and pr.module_id = p.id
        and pr.passed_at is not null
    ),
    p.id,
    p.slug,
    p.title
  from target t
  left join prev p on true;
$$;

-- ---------------------------------------------------------------------------
-- Whole-module quiz submission
--   p_responses: { "<quiz_item_id>": <response>, ... } using the same response
--   shapes as submit_quiz_attempt. Unanswered items count as incorrect.
-- ---------------------------------------------------------------------------

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
  v_user_id    uuid := auth.uid();
  v_slug       text;
  v_unlocked   boolean;
  v_item       public.quiz_items%rowtype;
  v_response   jsonb;
  v_correct    boolean;
  v_total      integer := 0;
  v_right      integer := 0;
  v_score      numeric(5, 4);
  v_passed     boolean;
  v_results    jsonb := '[]'::jsonb;
  v_progress   public.progress%rowtype;
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

      if not v_correct then
        insert into public.review_cards (user_id, quiz_item_id, due_at)
        values (v_user_id, v_item.id, now())
        on conflict (user_id, quiz_item_id) do update
          set due_at = least(public.review_cards.due_at, excluded.due_at);
      end if;
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

  return jsonb_build_object(
    'module_id',    p_module_id,
    'correct',      v_right,
    'total',        v_total,
    'score',        v_score,
    'threshold',    public.quiz_pass_threshold(),
    'passed',       v_passed,
    'best_score',   v_progress.best_score,
    'passed_at',    v_progress.passed_at,
    'results',      v_results
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Function privileges (Postgres grants EXECUTE to PUBLIC by default)
-- ---------------------------------------------------------------------------

revoke all on function public.grade_quiz_response(text, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.module_gate(text) from public, anon;
revoke all on function public.submit_module_quiz(text, jsonb) from public, anon;
grant execute on function public.module_gate(text) to authenticated;
grant execute on function public.submit_module_quiz(text, jsonb) to authenticated;
grant execute on function public.quiz_pass_threshold() to anon, authenticated;
