import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { activityGrid, addDays, computeStreak, dayKey, isValidTimeZone } from "@/lib/streak";
import { ReminderSettings } from "@/components/review/ReminderSettings";

export const metadata = { title: "Streak · RAG Course" };

const WEEKS = 12;

function shade(count: number) {
  if (count === 0) return "bg-neutral-200 dark:bg-neutral-800";
  if (count < 3) return "bg-green-200 dark:bg-green-900";
  if (count < 8) return "bg-green-400 dark:bg-green-700";
  return "bg-green-600 dark:bg-green-500";
}

export default async function StreakPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone, review_reminders, reminder_hour")
    .eq("id", user!.id)
    .single();
  const tz = isValidTimeZone(profile?.timezone) ? profile!.timezone : "UTC";
  const today = dayKey(new Date(), tz);

  const [{ data: days }, { count: dueCount }] = await Promise.all([
    // Enough history for the grid; longest streak only counts within it.
    supabase.rpc("my_activity_days", { p_since: addDays(today, -366) }),
    supabase.from("review_cards").select("id", { count: "exact", head: true }).lte("due_at", new Date().toISOString()),
  ]);

  const counts = new Map<string, number>((days ?? []).map((d: { day: string; events: number }) => [d.day, d.events]));
  const streak = computeStreak(counts.keys(), today);
  const grid = activityGrid(counts, today, WEEKS);

  const stat = (label: string, value: string | number) => (
    <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <p className="text-sm text-neutral-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );

  return (
    <div className="space-y-8 py-10">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold">Streak</h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          {streak.activeToday
            ? "You've studied today. Nice."
            : streak.current > 0
              ? `Review today to keep your ${streak.current}-day streak.`
              : "Answer one review card or quiz question to start a streak."}
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stat("Current streak", `${streak.current} day${streak.current === 1 ? "" : "s"}`)}
        {stat("Longest streak", `${streak.longest} day${streak.longest === 1 ? "" : "s"}`)}
        {stat("Days studied", streak.totalDays)}
        {stat("Cards due", dueCount ?? 0)}
      </div>

      {(dueCount ?? 0) > 0 && (
        <Link href="/review" className="inline-block rounded-md bg-neutral-900 px-4 py-2 font-medium text-white dark:bg-white dark:text-neutral-900">
          Review now
        </Link>
      )}

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Last {WEEKS} weeks</h2>
        <div className="overflow-x-auto">
          <div className="flex gap-1" role="img" aria-label={`Study activity for the last ${WEEKS} weeks`}>
            {grid.map((col, i) => (
              <div key={i} className="flex flex-col gap-1">
                {col.map((cell, j) =>
                  cell ? (
                    <span
                      key={cell.key}
                      title={`${cell.key}: ${cell.count} answer${cell.count === 1 ? "" : "s"}`}
                      className={`h-4 w-4 rounded-sm ${shade(cell.count)} ${cell.key === today ? "ring-2 ring-neutral-900 dark:ring-white" : ""}`}
                    />
                  ) : (
                    <span key={j} className="h-4 w-4" />
                  ),
                )}
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-neutral-500">Days are counted in {tz}. Columns run Monday to Sunday.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Reminders</h2>
        <ReminderSettings
          timezone={profile?.timezone ?? "UTC"}
          reminderHour={profile?.reminder_hour ?? 9}
          enabled={profile?.review_reminders ?? true}
        />
      </section>
    </div>
  );
}
