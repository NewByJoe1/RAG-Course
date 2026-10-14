"use client";

import { useEffect, useMemo, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { updateReviewSettings } from "@/app/actions/settings";

function Save() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="rounded-md bg-neutral-900 px-4 py-2 font-medium text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900">
      {pending ? "Saving…" : "Save"}
    </button>
  );
}

const hourLabel = (h: number) => new Date(Date.UTC(2000, 0, 1, h)).toLocaleTimeString("en-US", { hour: "numeric", timeZone: "UTC" });
const field = "rounded-md border border-neutral-300 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900";

export function ReminderSettings({ timezone, reminderHour, enabled }: { timezone: string; reminderHour: number; enabled: boolean }) {
  const [state, action] = useFormState(updateReviewSettings, {});
  const [detected, setDetected] = useState<string | null>(null);
  const zones = useMemo(() => {
    try {
      return Intl.supportedValuesOf("timeZone");
    } catch {
      return [timezone];
    }
  }, [timezone]);

  useEffect(() => setDetected(Intl.DateTimeFormat().resolvedOptions().timeZone), []);

  return (
    <form action={action} className="space-y-4 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <label className="flex items-center gap-2">
        <input type="checkbox" name="review_reminders" defaultChecked={enabled} />
        <span>Email me once a day when cards are due</span>
      </label>
      <div className="flex flex-wrap gap-4">
        <label className="space-y-1">
          <span className="block text-sm font-medium">Send at</span>
          <select name="reminder_hour" defaultValue={reminderHour} className={field}>
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>{hourLabel(h)}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="block text-sm font-medium">Timezone</span>
          <select name="timezone" defaultValue={zones.includes(timezone) ? timezone : "UTC"} className={field}>
            {!zones.includes("UTC") && <option value="UTC">UTC</option>}
            {zones.map((z) => (
              <option key={z} value={z}>{z}</option>
            ))}
          </select>
        </label>
      </div>
      {detected && detected !== timezone && (
        <p className="text-sm text-neutral-600 dark:text-neutral-400">Your browser reports {detected}. Pick it above if that&apos;s where you are.</p>
      )}
      {state.error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{state.error}</p>}
      {state.message && <p role="status" className="text-sm text-green-700 dark:text-green-300">{state.message}</p>}
      <Save />
    </form>
  );
}
