"use client";

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import type { AuthState } from "@/app/auth/actions";

type Props = {
  mode: "login" | "signup";
  action: (prev: AuthState, formData: FormData) => Promise<AuthState>;
  next?: string;
  initialError?: string;
};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-md bg-neutral-900 px-4 py-2 font-medium text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900"
    >
      {pending ? "Working…" : label}
    </button>
  );
}

const input =
  "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100";

export function AuthForm({ mode, action, next, initialError }: Props) {
  const [state, formAction] = useFormState(action, { error: initialError });
  const isSignup = mode === "signup";

  return (
    <form action={formAction} className="space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
      {isSignup && (
        <label className="block space-y-1">
          <span className="text-sm font-medium">Display name (optional)</span>
          <input name="display_name" autoComplete="name" className={input} />
        </label>
      )}
      <label className="block space-y-1">
        <span className="text-sm font-medium">Email</span>
        <input name="email" type="email" required autoComplete="email" className={input} />
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-medium">Password</span>
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete={isSignup ? "new-password" : "current-password"}
          className={input}
        />
      </label>

      {state.error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
          {state.error}
        </p>
      )}
      {state.message && (
        <p role="status" className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800 dark:bg-green-950 dark:text-green-200">
          {state.message}
        </p>
      )}

      <SubmitButton label={isSignup ? "Create account" : "Log in"} />

      <p className="text-center text-sm text-neutral-600 dark:text-neutral-400">
        {isSignup ? (
          <>Already have an account? <Link href="/login" className="underline">Log in</Link></>
        ) : (
          <>New here? <Link href="/signup" className="underline">Create an account</Link></>
        )}
      </p>
    </form>
  );
}
