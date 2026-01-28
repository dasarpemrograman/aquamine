import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { plusJakartaSans } from "./fonts/plus-jakarta-sans";
import Sidebar from "./components/Sidebar";
import TopBar from "./components/TopBar";
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
    <ClerkProvider>
      <html lang="en">
        <body
          className={`${plusJakartaSans.variable} antialiased text-slate-900 bg-slate-50`}
        >
          <div className="flex min-h-screen">
            <Sidebar />
            
            <div className="flex-1 flex flex-col md:ml-72 transition-all duration-300 relative">
              <TopBar />
              
              <main className="flex-1 w-full">
                {children}
              </main>
            </div>
          </div>
        </body>
      </html>
    </ClerkProvider>
  );
}
