import { AuthForm } from "@/components/auth/AuthForm";
import { signIn } from "@/app/auth/actions";
import { safeNextPath } from "@/lib/auth/routes";

export const metadata = { title: "Log in · RAG Course" };

export default function LoginPage({ searchParams }: { searchParams: { next?: string; error?: string } }) {
  return (
    <div className="mx-auto max-w-sm py-12">
      <h1 className="mb-6 text-2xl font-semibold">Log in</h1>
      <AuthForm mode="login" action={signIn} next={safeNextPath(searchParams.next)} initialError={searchParams.error} />
    </div>
  );
}
