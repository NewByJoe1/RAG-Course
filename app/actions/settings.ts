"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isValidTimeZone } from "@/lib/streak";

export type SettingsState = { error?: string; message?: string };

export async function updateReviewSettings(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const timezone = String(formData.get("timezone") ?? "");
  const hour = Number(formData.get("reminder_hour"));
  const reminders = formData.get("review_reminders") === "on";

  if (!isValidTimeZone(timezone)) return { error: "Pick a valid timezone." };
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return { error: "Pick an hour between 0 and 23." };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session has expired. Log in again." };

  const { error } = await supabase
    .from("profiles")
    .update({ timezone, reminder_hour: hour, review_reminders: reminders })
    .eq("id", user.id);
  if (error) return { error: "Couldn't save settings. Try again." };

  revalidatePath("/streak");
  return { message: "Saved." };
}
