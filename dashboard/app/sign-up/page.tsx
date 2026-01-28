import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center p-8 animate-in fade-in zoom-in duration-500">
      <div className="mb-8 text-center max-w-md">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Create Account</h1>
        <p className="text-slate-500">
          Join the AquaMine network to monitor and analyze water quality data.
        </p>
      </div>
      <SignUp routing="hash" />
    </div>
  );
}
