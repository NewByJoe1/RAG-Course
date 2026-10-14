-- 0007_failure_categories.sql
-- Modules 6–8 add failures that aren't retrieval or generation bugs:
--   evaluation  the measurement itself misleads (leaky test sets, biased
--               judges, unrepresentative eval sets)
--   monitoring  automation misses or buries a regression (noisy alerts,
--               averaged-away tenants, a scheduler that stopped)

alter table public.failure_cases drop constraint failure_cases_category_check;

alter table public.failure_cases add constraint failure_cases_category_check check (category in (
  'retrieval_miss', 'chunking', 'ranking', 'context_overflow',
  'hallucination', 'stale_index', 'prompt',
  'evaluation', 'monitoring'
));
