import type { Metadata } from "next";
import { plusJakartaSans } from "./fonts/plus-jakarta-sans";
import "./globals.css";
import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";

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
        className={`${plusJakartaSans.variable} antialiased bg-background text-foreground overflow-x-hidden`}
      >
        <div className="flex min-h-screen bg-background">
          <Sidebar />

          <div className="flex-1 flex flex-col lg:pl-64 transition-all duration-300">
            <TopBar />
            
            <main className="flex-1 p-6 lg:p-10 max-w-7xl mx-auto w-full">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
