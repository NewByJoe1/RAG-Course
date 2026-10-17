"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type CompleteSetupResult = { status: "done"; at: string } | { status: "error"; error: string };

/** "My setup works": marks Module 0 passed (public.complete_setup()), which unlocks Module 1. */
export async function completeSetup(): Promise<CompleteSetupResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", error: "Your session has expired. Log in again." };

  const { data, error } = await supabase.rpc("complete_setup");
  if (error || !data) return { status: "error", error: "Couldn't save that. Try again in a moment." };
  revalidatePath("/", "layout");
  return { status: "done", at: data as string };
}
