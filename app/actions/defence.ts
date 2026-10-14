"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { type DefenceInput } from "@/lib/capstone/defence";
import { defenceSchema } from "@/lib/capstone/defence-schema";
import { allCriteriaMet, CRITERIA } from "@/supabase/functions/_shared/capstone";

export type DefenceResult =
  | { status: "error"; error: string }
  | { status: "saved"; passed: boolean; metCount: number; allMet: boolean; recordedAt: string };

/**
 * Record a defence for a learner. A plain insert as the signed-in reviewer:
 * RLS decides who may record (reviewers, never for themselves) and the
 * database sets the reviewer, timestamp and result, then updates the defence
 * criterion on main and records mastery if that makes 6/6.
 */
export async function recordDefence(learnerId: string, input: DefenceInput): Promise<DefenceResult> {
  if (!z.uuid().safeParse(learnerId).success) return { status: "error", error: "Unknown learner." };
  const parsed = defenceSchema.safeParse(input);
  if (!parsed.success) return { status: "error", error: parsed.error.issues[0].message };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", error: "Your session has expired. Log in again." };
  if (user.id === learnerId) return { status: "error", error: "You can't record your own defence." };

  const { data, error } = await supabase
    .from("capstone_defences")
    .insert({ learner_id: learnerId, ...parsed.data })
    .select("passed, recorded_at")
    .single();
  if (error) {
    if (error.code === "42501") return { status: "error", error: "Only reviewers can record a defence, and never their own." };
    if (error.code === "23514") return { status: "error", error: "The defence is incomplete. Fill in all six questions." };
    return { status: "error", error: "Couldn't save the defence. Try again." };
  }

  const { data: main } = await supabase
    .from("capstone_checks")
    .select("criteria_met")
    .eq("user_id", learnerId)
    .eq("check_key", "main")
    .maybeSingle();
  const met = main?.criteria_met ?? [];

  revalidatePath("/reviewer");
  revalidatePath(`/reviewer/${learnerId}`);
  return {
    status: "saved",
    passed: data.passed,
    metCount: CRITERIA.filter((c) => met.includes(c)).length,
    allMet: allCriteriaMet(met),
    recordedAt: data.recorded_at,
  };
}
