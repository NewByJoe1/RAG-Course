import { redirect } from "next/navigation";
import { unsubscribeFromReminders } from "@/lib/unsubscribe";
import { verifyUnsubscribe } from "@/lib/reminders";

export const metadata = { title: "Unsubscribe · RAG Course" };

// GET only shows a confirm button, so link scanners can't unsubscribe people.
export default function UnsubscribePage({ searchParams }: { searchParams: { u?: string; sig?: string; done?: string } }) {
  const { u = null, sig = null } = searchParams;

  if (searchParams.done) {
    return (
      <div className="mx-auto max-w-md py-16">
        <h1 className="text-2xl font-semibold">You&apos;re unsubscribed</h1>
        <p className="mt-2 text-neutral-600 dark:text-neutral-400">
          You won&apos;t get review reminders any more. You can turn them back on from your Streak page.
        </p>
      </div>
    );
  }

  if (!verifyUnsubscribe(u, sig)) {
    return (
      <div className="mx-auto max-w-md py-16">
        <h1 className="text-2xl font-semibold">This link isn&apos;t valid</h1>
        <p className="mt-2 text-neutral-600 dark:text-neutral-400">Log in and turn off reminders from your Streak page instead.</p>
      </div>
    );
  }

  async function confirm() {
    "use server";
    await unsubscribeFromReminders(u, sig);
    redirect("/unsubscribe?done=1");
  }

  return (
    <div className="mx-auto max-w-md space-y-4 py-16">
      <h1 className="text-2xl font-semibold">Stop review reminders?</h1>
      <p className="text-neutral-600 dark:text-neutral-400">We&apos;ll stop emailing you when cards are due.</p>
      <form action={confirm}>
        <button type="submit" className="rounded-md bg-neutral-900 px-4 py-2 font-medium text-white dark:bg-white dark:text-neutral-900">
          Unsubscribe
        </button>
      </form>
    </div>
  );
}
