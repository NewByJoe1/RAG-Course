import type { ModuleContent } from "../types";

// The capstone has no lessons or quiz: it's assessed from the learner's repo
// CI on /capstone (the module page redirects there). Published, so it's listed
// and unlocks after Module 11; progress.mastered_at records the pass.
const m12: ModuleContent = {
  id: "m12",
  slug: "capstone",
  order_index: 12,
  title: "Capstone",
  summary:
    "Build a production-grade legal-domain RAG system across 12 branches and prove it with CI: recall, citations, tenant isolation, nightly evals, a kill switch, and a reviewed defence.",
  learning_objectives: [
    "Reach recall@3 ≥ 0.85 and citation accuracy ≥ 0.95 on the course eval set",
    "Show zero cross-tenant leaks under 100+ concurrent users",
    "Keep nightly evals green and a tested kill switch in place",
    "Defend your design choices to a reviewer",
  ],
  estimated_minutes: 0,
  is_published: true,
  lesson_steps: [],
  quiz_items: [],
  failure_cases: [],
};

export default m12;
