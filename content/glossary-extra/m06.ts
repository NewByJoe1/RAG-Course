import type { GlossaryTerm } from "../glossary";

// Glossary terms first needed by Module 6. Shared terms live in content/glossary.ts.
export const terms: GlossaryTerm[] = [
  {
    id: "base-model",
    term: "Base model",
    aliases: ["base model"],
    definition: "The ready-made model you download, before any fine-tuning. Keep it, so you can compare against it and switch back.",
    stage: null,
  },
  {
    id: "epoch",
    term: "Epoch",
    aliases: ["epoch", "epochs"],
    definition: "One full pass through all the training pairs. Training usually runs for a few epochs.",
    stage: null,
  },
  {
    id: "loss-curve",
    term: "Loss curve",
    aliases: ["loss curve", "loss curves"],
    definition: "A chart of the model's mistakes as training goes on. When the held-out line stops falling and starts rising, stop training.",
    stage: null,
  },
  {
    id: "feature-flag",
    term: "Feature flag",
    aliases: ["feature flag", "feature flags"],
    definition: "A setting that switches between two versions of something, like the base or the fine-tuned re-ranker, without changing code.",
    stage: null,
  },
  {
    id: "data-leakage",
    term: "Leakage",
    aliases: ["leakage", "data leakage"],
    definition: "When test examples also turn up in the training data, so the test score looks better than the model really is.",
    stage: null,
  },
];
