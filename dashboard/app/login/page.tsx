"use client";

import { SignIn, useAuth } from "@clerk/nextjs";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const { isSignedIn } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isSignedIn) {
      router.push("/");
    }
  }, [isSignedIn, router]);

  if (isSignedIn) {
    return null; 
  }

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center p-4 relative overflow-hidden bg-slate-50">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-400/20 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-teal-400/20 rounded-full blur-[80px] pointer-events-none mix-blend-overlay" />

      <div className="w-full max-w-[440px] relative z-10 flex flex-col items-center gap-6 animate-in fade-in zoom-in duration-700 slide-in-from-bottom-4">
        
        <div className="text-center space-y-2 mb-2">
            <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-white/80 shadow-lg shadow-cyan-500/25 mb-4 group transform transition-all hover:scale-105">
                <img 
                  src="/aquamine-icon.png" 
                  alt="AquaMine Logo"
                  className="w-16 h-16 object-contain"
                />
            </div>
            <h1 className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-600 tracking-tight">
                AquaMine AI
            </h1>
            <p className="text-slate-500 font-medium">
                Advanced AMD Monitoring System
            </p>
        </div>

        <SignIn 
            appearance={{
                layout: {
                  socialButtonsPlacement: "bottom",
                },
                elements: {
                    rootBox: "w-full",
                    card: "bg-white/60 backdrop-blur-xl border border-white/50 shadow-xl shadow-slate-200/40 rounded-3xl px-8 py-10 w-full",
                    headerTitle: "text-xl font-bold text-slate-800",
                    headerSubtitle: "text-slate-500",
                    formButtonPrimary: "bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 text-white shadow-lg shadow-cyan-500/25 border-none normal-case text-base py-2.5 rounded-xl transition-all hover:shadow-cyan-500/40",
                    formFieldInput: "bg-white/80 border-slate-200 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 transition-all rounded-xl py-2.5 text-slate-800",
                    formFieldLabel: "text-slate-600 font-medium",
                    footer: "hidden",
                    footerAction: "hidden",
                    footerActionLink: "hidden",
                    identityPreviewText: "text-slate-700 font-medium",
                    dividerLine: "bg-slate-200",
                    dividerText: "text-slate-400 font-medium",
                    socialButtonsBlockButton: "bg-white border-slate-200 hover:bg-slate-50 text-slate-600 font-medium rounded-xl transition-all hover:border-slate-300 shadow-sm",
                    socialButtonsBlockButtonText: "text-slate-600 font-medium",
                    formFieldAction: "text-cyan-600 hover:text-teal-600 font-semibold"
                }
            }}
            routing="hash"
        />
        
        <div className="flex gap-6 text-sm text-slate-400 font-medium">
            <a 
              href="mailto:arqilasp@gmail.com?subject=AquaMine Support Request&body=Hello AquaMine Team,%0D%0A%0D%0AI need help with:%0D%0A%0D%0A"
              className="hover:text-cyan-600 transition-colors cursor-pointer"
            >
              Help & Support
            </a>
            <Link 
              href="/privacy-policy"
              className="hover:text-cyan-600 transition-colors cursor-pointer"
            >
              Privacy Policy
            </Link>
        </div>
      </div>
    </div>
  );
}
