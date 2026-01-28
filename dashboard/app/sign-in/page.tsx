import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center p-8 animate-in fade-in zoom-in duration-500">
      <div className="mb-8 text-center max-w-md">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Welcome Back</h1>
        <p className="text-slate-500">
          Sign in to access the AquaMine real-time monitoring dashboard.
        </p>
      </div>
      <SignIn routing="hash" />
    </div>
  );
}
