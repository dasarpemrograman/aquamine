import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { plusJakartaSans } from "./fonts/plus-jakarta-sans";
import "./globals.css";


export const metadata: Metadata = {
  title: "AquaMine Dashboard",
  description: "Acid Mine Drainage Monitoring and Analysis",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      appearance={{
        elements: {
          footer: { display: "none" },
          footerAction: { display: "none" },
          footerActionText: { display: "none" },
          footerActionLink: { display: "none" },
        },
      }}
    >
      <html lang="en">
        <body
          className={`${plusJakartaSans.variable} antialiased text-slate-900 bg-slate-50`}
        >
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
