import { createAdminClient } from "./supabase/admin";
import { verifyUnsubscribe } from "./reminders";

/** Turn off review reminders for a signed unsubscribe link. */
export async function unsubscribeFromReminders(userId: string | null, sig: string | null): Promise<boolean> {
  if (!verifyUnsubscribe(userId, sig)) return false;
  const { error } = await createAdminClient().from("profiles").update({ review_reminders: false }).eq("id", userId!);
  return !error;
}
