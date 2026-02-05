import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { plusJakartaSans } from "./fonts/plus-jakarta-sans";
import "./globals.css";
import "leaflet/dist/leaflet.css";

import { bootstrapSuperadmin } from "@/lib/bootstrap";
import { FieldModeProvider } from "./context/FieldModeContext";
import { ThemeProvider } from "./context/ThemeContext";

export const metadata: Metadata = {
  title: "AquaMine Dashboard",
  description: "Acid Mine Drainage Monitoring and Analysis",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  try {
    await bootstrapSuperadmin();
  } catch (error) {
    console.error("Bootstrap error:", error);
  }

  return (
    <ClerkProvider
      appearance={{
        elements: {
          footer: "hidden",
          footerAction: "hidden",
          footerActionText: "hidden",
          footerActionLink: "hidden",
        },
      }}
    >
      <html lang="en">
        <body
          className={`${plusJakartaSans.variable} antialiased text-slate-900 bg-slate-50`}
        >
          <FieldModeProvider>
            <ThemeProvider>
              {children}
            </ThemeProvider>
          </FieldModeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
