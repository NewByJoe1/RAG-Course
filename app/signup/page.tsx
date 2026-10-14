import { AuthForm } from "@/components/auth/AuthForm";
import { signUp } from "@/app/auth/actions";

export const metadata = { title: "Sign up · RAG Course" };

export default function SignupPage() {
  return (
    <div className="mx-auto max-w-sm py-12">
      <h1 className="mb-6 text-2xl font-semibold">Create your account</h1>
      <AuthForm mode="signup" action={signUp} />
    </div>
  );
}
