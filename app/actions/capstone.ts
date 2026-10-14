"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { normalizeGithubRepo } from "@/supabase/functions/_shared/capstone";

export type RepoState = { error?: string; message?: string };

/** Link (or unlink, with an empty value) the learner's capstone repo. */
export async function setGithubRepo(_prev: RepoState, formData: FormData): Promise<RepoState> {
  const raw = String(formData.get("github_repo") ?? "").trim();
  const repo = raw ? normalizeGithubRepo(raw) : null;
  if (raw && !repo) return { error: "Enter your repo as owner/name, e.g. octocat/rag-capstone." };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session has expired. Log in again." };

  const { error } = await supabase.from("profiles").update({ github_repo: repo }).eq("id", user.id);
  if (error) {
    if (error.code === "23505") return { error: "That repo is already linked to another learner." };
    if (error.code === "23514") return { error: "That doesn't look like a valid GitHub repo name." };
    return { error: "Couldn't save your repo. Try again." };
  }

  revalidatePath("/capstone");
  return { message: repo ? `Linked ${repo}. CI results appear within 15 minutes.` : "Repo unlinked." };
}
