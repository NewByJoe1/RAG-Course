import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/auth/actions";

export async function SiteHeader() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="border-b border-neutral-200 dark:border-neutral-800">
      <nav className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 text-sm">
        <Link href="/" className="font-semibold">RAG Course</Link>
        <Link href="/review">Review</Link>
        <Link href="/streak">Streak</Link>
        <Link href="/mastery">Mastery</Link>
        <Link href="/failures">Failure gallery</Link>
        <Link href="/capstone">Capstone</Link>
        <span className="ml-auto flex items-center gap-3">
          {user ? (
            <>
              <span className="hidden text-neutral-500 sm:inline">{user.email}</span>
              <form action={signOut}>
                <button type="submit" className="underline">Log out</button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login">Log in</Link>
              <Link href="/signup" className="rounded-md bg-neutral-900 px-3 py-1 text-white dark:bg-white dark:text-neutral-900">Sign up</Link>
            </>
          )}
        </span>
      </nav>
    </header>
  );
}
