
import type { Metadata } from "next";
import { plusJakartaSans } from "./fonts/plus-jakarta-sans";
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
        className={`${plusJakartaSans.variable} antialiased bg-background text-foreground overflow-x-hidden`}
      >
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}