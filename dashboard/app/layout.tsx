
import type { Metadata } from "next";
import { plusJakartaSans } from "./fonts/plus-jakarta-sans";
import Sidebar from "./components/Sidebar";
import TopBar from "./components/TopBar";
import "./globals.css";

import ClientLayout from "./ClientLayout";

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
        className={`${plusJakartaSans.variable} antialiased text-slate-900 bg-slate-50`}
      >
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}