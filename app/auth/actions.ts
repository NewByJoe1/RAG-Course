"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/auth/routes";

export type AuthState = { error?: string; message?: string };

const credentials = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address.")),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = credentials
    .extend({ display_name: z.string().trim().max(80).optional() })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { email, password, display_name } = parsed.data;
  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${siteUrl()}/auth/callback?next=/`,
      data: display_name ? { full_name: display_name } : undefined,
    },
  });
  if (error) return { error: error.message };

  // Email confirmation disabled in the project: the user is signed in already.
  if (data.session) redirect("/");

  // Same message whether or not the email was already registered, so the form
  // doesn't reveal which addresses have accounts.
  return { message: `Check ${email} for a confirmation link, then come back and log in.` };
}

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = credentials.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (error.code === "email_not_confirmed") return { error: "Confirm your email first. Check your inbox for the link." };
    return { error: "Invalid email or password." };
  }

  redirect(safeNextPath(formData.get("next")?.toString()));
}

export async function signOut() {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
