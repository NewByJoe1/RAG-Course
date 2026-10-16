"use server";

import { createClient } from "@/lib/supabase/server";

export type ExplainBackResult = { status: "saved"; createdAt: string } | { status: "error"; error: string };

/** Save the learner's "explain it back" answer privately (RLS: own rows only, append-only). */
export async function saveExplainBack(moduleId: string, response: string): Promise<ExplainBackResult> {
  const text = response.trim();
  if (!text) return { status: "error", error: "Write your explanation first." };
  if (text.length > 4000) return { status: "error", error: "Keep it under 4,000 characters." };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", error: "Your session has expired. Log in again." };

  const { data, error } = await supabase
    .from("explain_back_responses")
    .insert({ module_id: moduleId, response: text })
    .select("created_at")
    .single();
  if (error || !data) return { status: "error", error: "Couldn't save your answer. Try again." };
  return { status: "saved", createdAt: data.created_at };
}
