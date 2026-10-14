-- 0006_failure_cause_options.sql
-- Failure cases can offer multiple-choice causes. Learners pick one in the
-- failure gallery and on failure-case review cards before the root cause and
-- fix are revealed.
--
--   cause_options: [{ "id": "a", "text": "..." }, ...]   (2+ options)
--   correct_cause: the id of the correct option
--
-- Both are null for cases without options (they keep the plain reveal).
-- These are self-check practice, not graded: like root_cause and fix, they're
-- readable by anyone who can read the case.

alter table public.failure_cases
  add column cause_options jsonb,
  add column correct_cause text,
  add constraint failure_cases_cause_options_shape check (
    (cause_options is null and correct_cause is null)
    or (
      cause_options is not null
      and correct_cause is not null
      -- CASE so a non-array is rejected (false) rather than erroring, and no
      -- branch can evaluate to NULL (a NULL check counts as passing).
      and case
            when jsonb_typeof(cause_options) = 'array' then
              jsonb_array_length(cause_options) >= 2
              -- the correct id must be one of the options
              and cause_options @> jsonb_build_array(jsonb_build_object('id', correct_cause))
            else false
          end
    )
  );
