import { SignIn } from "@clerk/nextjs";

export const dynamic = "force-dynamic";

export default function SignInPage() {
  return (
    <div className="relative z-1 flex min-h-screen items-center justify-center p-4">
      <SignIn />
    </div>
  );
}
