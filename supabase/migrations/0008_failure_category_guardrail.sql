-- 0008_failure_category_guardrail.sql
-- Module 9 adds failures in the production harness's safety layer:
--   guardrail  a gate, kill switch or isolation rule that fails open, or
--              blocks correct answers (whitespace-tripped citation gates,
--              kill switches that don't stop queued work)

alter table public.failure_cases drop constraint failure_cases_category_check;

alter table public.failure_cases add constraint failure_cases_category_check check (category in (
  'retrieval_miss', 'chunking', 'ranking', 'context_overflow',
  'hallucination', 'stale_index', 'prompt',
  'evaluation', 'monitoring', 'guardrail'
));
