import type { SupabaseClient } from "@supabase/supabase-js";

/** The signed-in user and whether they're a reviewer (RLS still enforces it). */
export async function getReviewer(supabase: SupabaseClient) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, isReviewer: false };
  const { data } = await supabase.from("profiles").select("is_reviewer").eq("id", user.id).single();
  return { user, isReviewer: Boolean(data?.is_reviewer) };
}

export const learnerName = (p: { display_name: string | null; email: string | null }) => p.display_name || p.email || "Learner";
