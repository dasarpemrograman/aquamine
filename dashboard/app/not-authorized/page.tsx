import Link from "next/link";
import { ShieldAlert } from "lucide-react";

export default function NotAuthorizedPage() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in duration-500">
      <div className="rounded-full bg-red-100 p-6 mb-6">
        <ShieldAlert className="h-12 w-12 text-red-600" />
      </div>
      
      <h1 className="text-3xl font-bold text-slate-900 mb-3">
        Access Denied
      </h1>
      
      <p className="text-slate-500 max-w-md mb-8 text-lg">
        You do not have permission to view this page. Please contact your administrator if you believe this is an error.
      </p>
      
      <Link 
        href="/"
        className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 transition-all duration-200"
      >
        Return to Dashboard
      </Link>
    </div>
  );
}
