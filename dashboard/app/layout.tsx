import type { Metadata } from "next";
import { plusJakartaSans } from "./fonts/plus-jakarta-sans";
import Link from "next/link";
import "./globals.css";



export const metadata: Metadata = {
  title: "AquaMine Dashboard",
  description: "Acid Mine Drainage Monitoring and Analysis",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
          className={`${plusJakartaSans.variable} antialiased bg-white text-zinc-900`}
      >
        <nav className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[95vw] max-w-6xl border-b border-transparent bg-gradient-to-r from-slate-100 via-blue-100 to-blue-200 rounded-4xl shadow-lg backdrop-blur-md">
          <div className="px-4">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center space-x-8">
                <Link href="/" className="text-xl font-bold tracking-tight text-blue-700 rounded-lg px-3 py-1">
                  AquaMine
                </Link>
                <div className="hidden md:flex space-x-2">
                  <Link 
                    href="/" 
                    className="text-sm font-medium text-zinc-700 hover:text-blue-700 transition-colors rounded-lg px-3 py-2"
                  >
                    Dashboard
                  </Link>
                  <Link 
                    href="/forecast" 
                    className="text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors rounded-lg px-3 py-2"
                  >
                    Forecast
                  </Link>
                  <Link 
                    href="/recipients" 
                    className="text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors rounded-lg px-3 py-2"
                  >
                    Recipients
                  </Link>
                  <Link 
                    href="/cv" 
                    className="text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors rounded-lg px-3 py-2"
                  >
                    CV Analysis
                  </Link>
                  <Link 
                    href="/chat" 
                    className="text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors rounded-lg px-3 py-2"
                  >
                    AI Assistant
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </nav>
        <main className="pt-20">
          {children}
        </main>
      </body>
    </html>
  );
}
